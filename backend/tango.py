import os
import pandas as pd
import subprocess

import auxiliary

PROJECT_PATH = os.getcwd()
print(PROJECT_PATH)

TANGO_RUN_FILEPATH = PROJECT_PATH + "/Tango"
TANGO_BAT_FILEPATH = "Tango/Tango_run.bat"
TANGO_DIRECTORY_PATH = "Tango/"
TANGO_RESULT_DIRECTORY = PROJECT_PATH + "/Tango"
KEY = "Entry"


def create_tango_input(database: pd.DataFrame, existed_tango_results: set):
    """
    Create Tango input file for Mac/Linux (non-interactive).
    Instead of writing a .bat script, this writes a plain input file
    that Tango can consume with './tango < Tango_input.txt'.

    Parameters:
        database (pd.DataFrame): your peptides DataFrame
        existed_tango_results (set): IDs already calculated, skip them
    """
    cter = '"N"'
    nter = '"N"'
    ph = '"7"'
    temp = '"298"'
    ionic = '"0.1"'
    tf = '"0"'
    brac = '"'

    # Input file path (Mac/Linux friendly)
    TANGO_INPUT_FILEPATH = os.path.join(TANGO_DIRECTORY_PATH, "Tango_input.txt")

    # Delete if exists
    if os.path.isfile(TANGO_INPUT_FILEPATH):
        os.remove(TANGO_INPUT_FILEPATH)

    with open(TANGO_INPUT_FILEPATH, "a") as tango_input_file:
        for _, row in database.iterrows():
            if not pd.isna(row["Sequence"]):
                if row[KEY] not in existed_tango_results:
                    sequence = auxiliary.get_corrected_sequence(row["Sequence"])
                    tango_input_file.write(
                        f"{row[KEY]} nt={nter} ct={cter} ph={ph} te={temp} io={ionic} tf={tf} seq={brac}{sequence}{brac}\n"
                    )
    print(f"[DEBUG] Saving Tango_input.txt at {TANGO_BAT_FILEPATH}")



def __get_peptide_tango_result(filepath: str) -> dict:
    """
    Process Tango result file into dictionary divided by all types of prediction Tango provides.
    :param filepath: filepath to file containing Tango result
    :return: dictionary with tango results, {"Name": ,
                                            "Beta prediction": ,
                                            "Helix prediction": ,
                                            "Turn prediction": ,
                                            "Aggregation prediction": }
    """
    tango_res_df = pd.read_csv(filepath, sep='\t')
    peptide_tango_result_dict = {"Name": filepath.split('.')[0].split('/')[1],
                                 "Beta prediction": tango_res_df["Beta"].tolist(),
                                 "Helix prediction": tango_res_df["Helix"].tolist(),
                                 "Turn prediction": tango_res_df["Turn"].tolist(),
                                 "Aggregation prediction": tango_res_df["Aggregation"].tolist()}
    return peptide_tango_result_dict


def __get_database_tango_results(database_entries: list) -> dict:
    """
    Process tango results into dictionary, keyed by uniprotID
    :return: dictionary, keyed by uniprotID {Key: uniprotID, Value: dictionary of tango result of peptide}
    """
    tango_result_directory = os.fsencode(TANGO_RUN_FILEPATH)
    tango_results_dict = {}
    for file in os.listdir(tango_result_directory):
        filename = os.fsdecode(file)
        if "Tango" not in filename:
            filepath = str(os.path.join(TANGO_DIRECTORY_PATH, filename))
            uniprot_id = filename.split('.')[0]
            if uniprot_id in database_entries:
                tango_results_dict[uniprot_id] = __get_peptide_tango_result(filepath)
    return tango_results_dict


def __analyse_tango_results(peptide_tango_results: dict) -> dict:
    """
    Gets results of tango and calculates the residues, average score, and difference between helix and beta score of
    secondary structure switch (SSW) fragments
    :param peptide_tango_results: dictionary with tango results
                                {"Name": , "Beta prediction": , "Helix prediction": , "Turn prediction": ,
                                "Aggregation prediction": }
    :return: Dictionary of: 1) list of start and end residues predicted to be SSW, if dont exists returns []
                           2) average score of fragments predicted to be SSW, if dont exists returns -1
                           3) difference between helix and beta score of fragments predicted to be SSW,
                                if dont exists returns -1
                           4) percentage of the whole sequence predicted to be helical
                           5) percentage of the whole sequence predicted to be beta
    """
    tango_helix_prediction = peptide_tango_results["Helix prediction"]
    tango_beta_prediction = peptide_tango_results["Beta prediction"]

    result_dict = {"SSW_residues": [], "SSW_avg_score": -1, "Helix_and_beta_diff": -1,
                   "Helix_percentage": auxiliary.check_secondary_structure_prediction_content(tango_helix_prediction),
                   "Beta_percentage": auxiliary.check_secondary_structure_prediction_content(tango_beta_prediction)}

    # TODO: to limit the prediction to a certain percentage of secondary structure prediction of the sequence
    #  remove notes from rows below
    # if auxiliary.check_secondary_structure_prediction_content(tango_helix_prediction) < main.MIN_CHAMELEON_H_CONTENT:
    #     return result_dict
    # if auxiliary.check_secondary_structure_prediction_content(tango_beta_prediction) < main.MIN_CHAMELEON_B_CONTENT:
    #     return result_dict

    tango_helix_segments = auxiliary.get_secondary_structure_segments(tango_helix_prediction, prediction_method="Tango")
    # print("tango_helix_segmnets = {}".format(tango_helix_segments))
    tango_beta_segments = auxiliary.get_secondary_structure_segments(tango_beta_prediction, prediction_method="Tango")
    # print("tango_beta_segmnets = {}".format(tango_beta_segments))
    ssw_fragments = auxiliary.find_secondary_structure_switch_segments(beta_segments=tango_beta_segments,
                                                                       helix_segments=tango_helix_segments)
    # print("tango_chameleon_segmnets = {}".format(chameleon_fragments))
    ssw_score, ssw_diff = auxiliary.calc_secondary_structure_switch_difference_and_score(
        beta_prediction=tango_beta_prediction,
        helix_prediction=tango_helix_prediction,
        structure_prediction_indexes=ssw_fragments)
    result_dict["SSW_residues"] = ssw_fragments
    result_dict["SSW_avg_score"] = ssw_score
    result_dict["Helix_and_beta_diff"] = ssw_diff

    return result_dict


def process_tango_output(database: pd.DataFrame):
    """
    Process Tango prediction results and insert them into the given database.
    Supports both per-sequence files (legacy) and Tango_output.txt (batch mode).
    """

    output_file = os.path.join(TANGO_DIRECTORY_PATH, "Tango_output.txt")

    if os.path.exists(output_file):
        print(f"[DEBUG] Found Tango_output.txt at {output_file}")
        try:
            # Adjust delimiter depending on Tango's output format
            df_out = pd.read_csv(output_file, sep="\t", comment="#")
            print("[DEBUG] Tango output head:")
            print(df_out.head())

            # Prepare containers
            tango_result_by_residue = []
            tango_result_score = []
            tango_diff = []
            tango_helix_percentage = []
            tango_beta_percentage = []

            # Match results back to your database
            for _, row in database.iterrows():
                entry = row[KEY]
                match = df_out[df_out["Name"] == entry] if "Name" in df_out.columns else None
                if match is not None and not match.empty:
                    # Map fields (adjust depending on Tango’s actual column names)
                    tango_result_by_residue.append(match.get("SSW_residues", ["-"]).iloc[0])
                    tango_result_score.append(match.get("SSW", [0]).iloc[0])
                    tango_diff.append(match.get("Helix-Beta_diff", [0]).iloc[0])
                    tango_helix_percentage.append(match.get("Helix_percent", [0]).iloc[0])
                    tango_beta_percentage.append(match.get("Beta_percent", [0]).iloc[0])
                else:
                    # Fallback if no match found
                    tango_result_by_residue.append("-")
                    tango_result_score.append(-1)
                    tango_diff.append(0)
                    tango_helix_percentage.append(0)
                    tango_beta_percentage.append(0)

            # Insert results into database
            database["SSW fragments"] = tango_result_by_residue
            database["SSW score"] = tango_result_score
            database["SSW diff"] = tango_diff
            database["SSW helix percentage"] = tango_helix_percentage
            database["SSW beta percentage"] = tango_beta_percentage

            print("[DEBUG] process_tango_output completed using Tango_output.txt")
            return
        except Exception as e:
            print(f"[WARN] Could not parse Tango_output.txt: {e}, falling back to per-sequence files")

    # --- Legacy per-sequence path (your existing logic) ---
    database_entries = database[KEY].tolist()
    print("[DEBUG] Falling back to per-sequence parsing")
    database_tango_results_dict = __get_database_tango_results(database_entries)
    print('[DEBUG] Process tango output  - checkpoint 1 finished')

    tango_result_by_residue = []
    tango_result_score = []
    tango_diff = []
    tango_helix_percentage = []
    tango_beta_percentage = []

    for _, row in database.iterrows():
        peptide_tango_results = database_tango_results_dict.get(row[KEY])
        result_dict = __analyse_tango_results(peptide_tango_results)
        tango_result_by_residue.append(result_dict["SSW_residues"])
        tango_result_score.append(result_dict["SSW_avg_score"])
        tango_diff.append(result_dict["Helix_and_beta_diff"])
        tango_helix_percentage.append(result_dict["Helix_percentage"])
        tango_beta_percentage.append(result_dict["Beta_percentage"])

    database["SSW fragments"] = tango_result_by_residue
    database["SSW score"] = tango_result_score
    database["SSW diff"] = tango_diff
    database["SSW helix percentage"] = tango_helix_percentage
    database["SSW beta percentage"] = tango_beta_percentage

    print('[DEBUG] Process tango output  - checkpoint 3 finished (legacy mode)')



def filter_by_avg_diff(database: pd.DataFrame, database_name: str, statistical_result_dict: dict):
    """
    This function calculates the avg difference of secondary structure switch (SSW) prediction and applies the
    threshold accordingly, meaning marking all entries that their ssw difference score is lower than the calculated
    average marked as ssw entries, otherwise marked as no-ssw entries.

    :param database_name: Name of the given database
    :param statistical_result_dict: dictionary that contain statistical analysis pf the current database.
    :param database: the database
    :return: Adds coloumn to the database: "SSW prediction": 1 if an entry passed all the thresholds, and -1 otherwise
    """
    avg_diff = database[database["SSW diff"] != -1]["SSW diff"].mean()
    statistical_result_dict[database_name]['4 SSW helix and beta difference threshold'] = avg_diff
    ssw_predictions = []
    for _, row in database.iterrows():
        if row["SSW diff"] > avg_diff or row["SSW diff"] == -1:
            ssw_predictions.append(-1)
        else:
            ssw_predictions.append(1)
    database["SSW prediction"] = ssw_predictions


def run_tango():
    input_file = os.path.join(TANGO_DIRECTORY_PATH, "Tango_input.txt")
    output_file = os.path.join(TANGO_DIRECTORY_PATH, "Tango_output.txt")

    cmd = f'echo "Y" | ./tango < "{input_file}" > "{output_file}"'
    print(f"[DEBUG] Running Tango with command: {cmd}")
    process = subprocess.Popen(cmd, cwd=TANGO_DIRECTORY_PATH, shell=True)
    process.communicate()

    if process.returncode != 0:
        raise RuntimeError("Tango execution failed. Check Tango installation and input file.")

    if not os.path.exists(output_file):
        raise RuntimeError("Tango_output.txt not created. Check Tango binary output.")
    print(f"[DEBUG] Tango finished, output at {output_file}")




def get_all_existed_tango_results_entries() -> set:
    """
    This function return a set of all uniprot_id entries that already have a Tango result,
    so there is no need to re-run Tango on them.
    :return: Set of uniprot_id entries
    """
    tango_existing_result = set()
    for file in os.listdir(TANGO_RESULT_DIRECTORY):
        filename = os.fsdecode(file)
        if "Tango" not in filename:
            uniprot_id = filename.split('.')[0]
            tango_existing_result.add(uniprot_id)
    return tango_existing_result
