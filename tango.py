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
    This function creates Tango input file (.bat) containing all the proteins in the given database.
    This function takes into account all proteins that have previous Tango result, and dont run them again.
    The Tango input file is saved automatically to TANGO_BAT_FILEPATH in the TANGO_DIRECTORY_PATH
    Shortcuts referred in the function:
        cter - status of the C-terminus of the peptide. amidated Y, free N
        mter - status of the N-terminus of the peptide. acetylated A, succinilated S and free N
        ionic - ionic strength in M
        temp - in kelvin
    :param database:
    :param existed_tango_results:
    :return: Nothing. creates the input file in the TANGO_BAT_FILEPATH in the TANGO_DIRECTORY_PATH
    """
    cter = '"N"'
    nter = '"N"'
    ph = '"7"'
    temp = '"298"'
    ionic = '"0.1"'
    tf = '"0"'
    executable_name = "./tango"
    brac = '"'

    if os.path.isfile(TANGO_BAT_FILEPATH):
        os.remove(TANGO_BAT_FILEPATH)
    tango_input_file = open(TANGO_BAT_FILEPATH, "a")
    for _, row in database.iterrows():
        # TODO: change to address Ntr and Ctr modification if exists and if we want to address them
        if not pd.isna(row["Sequence"]):
            if row[KEY] not in existed_tango_results:
                sequence = auxiliary.get_corrected_sequence(row["Sequence"])
                tango_input_file.write("{} {} nt={} ct={} ph={} te={} io={} tf={} seq={}\n".format(
                    executable_name, row[KEY], cter, nter, ph, temp, ionic, tf, brac + sequence + brac))
    tango_input_file.close()


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
    This function process and analyse the Tango prediction results to the given database

    :param database: Database to work on.
    :return: Changes the database directly
    """
    database_entries = database[KEY].tolist()
    print(database_entries)
    database_tango_results_dict = __get_database_tango_results(database_entries)
    print('Process tango output  - checkpoint 1 is finished')

    tango_result_by_residue = []
    tango_result_score = []
    tango_diff = []
    tango_helix_percentage = []
    tango_beta_percentage = []

    """ Analyse Tango result for each peptide """
    for _, row in database.iterrows():

        peptide_tango_results = database_tango_results_dict.get(row[KEY])

        result_dict = __analyse_tango_results(peptide_tango_results)
        tango_result_by_residue.append(result_dict["SSW_residues"])
        tango_result_score.append(result_dict["SSW_avg_score"])
        tango_diff.append(result_dict["Helix_and_beta_diff"])
        tango_helix_percentage.append(result_dict["Helix_percentage"])
        tango_beta_percentage.append(result_dict["Beta_percentage"])
    
    print('Process tango output  - checkpoint 2 is finished')

    """ Insert results into the database """
    database["SSW fragments"] = tango_result_by_residue
    database["SSW score"] = tango_result_score
    database["SSW diff"] = tango_diff
    database["SSW helix percentage"] = tango_helix_percentage
    database["SSW beta percentage"] = tango_beta_percentage

    print('Process tango output  - checkpoint 3 is finished')


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
    """
    This function runs the Tango prediction tool on the input file saved in TANGO_RUN_DIRECTORY.
    :return: Nothing
    """
    # TODO: print the stdout to a file and not to the run terminal
    permission = subprocess.Popen("chmod 777 Tango_run.bat", cwd=TANGO_RUN_FILEPATH, shell=True)
    stdout, stderr = permission.communicate()
    p = subprocess.Popen("./Tango_run.bat", cwd=TANGO_RUN_FILEPATH, shell=True)
    stdout, stderr = p.communicate()


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
