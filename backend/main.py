import os
import pandas as pd
import warnings

import auxiliary
import biochemCalculation
import jpred
import tango

SEPARATOR = "\n********************************************************************************************************"

LANDAU_LAB_PEPTIDES_FILEPATH = "Landau_lab_peptides_20230119.xlsx"
JPRED_INPUT_FILEPATH = "Jpred/"

MIN_H_CONTENT = 0
MIN_SSW_B_CONTENT = 0
MIN_SSW_H_CONTENT = 0

RUN_ONLY_DATABASE = []
JOB_RUN = 'Uniprot_KB'


def write_to_excel(dataframe: pd.DataFrame, file_name: str, print_index=False):
    if os.path.isfile(file_name):
        os.remove(file_name)
    dataframe.to_excel(file_name, index=print_index)


def create_database(database_filepath: str, statistical_result_dict: dict, database_name: str) -> pd.DataFrame:
    """
    This function creates a dataframe to work on.
    This function eliminates uncertain sequences or sequences that Jpred could not calculate prediction.
    :param database_filepath: filepath to database in .xlsx format
    :param statistical_result_dict: dictionary containing statistical results, and will be updated during the function.
    :param database_name: job name
    :return: dataframe after filtering out uncertain and incalculable entries.
    """
    with warnings.catch_warnings(record=True):
        warnings.simplefilter("always")
        original_database = pd.read_excel(database_filepath, engine="openpyxl")

    statistical_result_dict[database_name]["Original length"] = original_database.shape[0]

    auxiliary.filter_uncertain_and_long_sequences(original_database)

    filtered_database = auxiliary.filter_entries_without_Jpred_result(original_database)

    statistical_result_dict[database_name]["After filter"] = filtered_database.shape[0]

    # write_to_excel(filtered_database, JOB_RUN + "/Filtered_" + database_name + ".xlsx")
    return filtered_database


def calculate_biochemical_features(database: pd.DataFrame):
    """
    This function calculates and adds to the database biochemical features of the sequences:
        "Charge" = total charge at pH 7.4
        "Hydrophobicity" = hydrophobicity
        "Full length uH" = Hydrophobic moment (uH) of the full length as helix
        "Helix (Jpred) uH" = Averaged hydrophobic moment of the segments predicted as helical by Jpred
        "Beta full length uH" = Hydrophobic moment (uH) of the full length as beta

    :param database: Database with sequences
    :return:Updates the database according to description above
    """
    total_charge = []  # at pH=7.4
    hydrophobicity = []
    uH_full_length = []
    uH_helix_jpred = []
    uH_beta_full_length = []

    for _, row in database.iterrows():
        sequence = auxiliary.get_corrected_sequence(row["Sequence"])
        total_charge.append(biochemCalculation.total_charge(sequence))
        hydrophobicity.append(biochemCalculation.hydrophobicity(sequence))
        uH_full_length.append(biochemCalculation.hydrophobic_moment(sequence))
        uH_helix_jpred.append(auxiliary.get_avg_uH_by_segments(sequence, row["Helix fragments (Jpred)"]))
        uH_beta_full_length.append(biochemCalculation.hydrophobic_moment(sequence, angle=160))

    database["Charge"] = total_charge
    database["Hydrophobicity"] = hydrophobicity
    database["Full length uH"] = uH_full_length
    database["Helix (Jpred) uH"] = uH_helix_jpred
    database["Beta full length uH"] = uH_beta_full_length


def run_and_analyse_tango(database: pd.DataFrame, database_name: str, statistical_result_dict: dict,
                          existed_tango_results: set):
    """
    This function running and analysing Tango tool on the given database. The function saves the Tango result in the
    directory: Tango prediction will be performed only on sequences that doesn't have prior Tango result.

    :param database: database containing the sequences.
    :param database_name: database name.
    :param statistical_result_dict: dictionary containing general statistical results of the calculations on the given
            database
    :param existed_tango_results: set of entries that already have Tango prediction calculation, in order to avoid
            re-calculating them.
    :return: Adds columns to the given database
    """
    tango.create_tango_input(database, existed_tango_results)
    tango.run_tango()
    tango.process_tango_output(database)
    tango.filter_by_avg_diff(database, database_name, statistical_result_dict)


def run_and_analyse_jpred(database: pd.DataFrame, database_name: str):
    """
    This function prepers the input for a Jpred run and saves it into a file, and analyses the Jpred results.

    :param database: database containing sequences.
    :param database_name: database name
    :return: Adds columns to the given database
    """
    num_new_peptides_to_run_jpred = jpred.creat_jpred_input(database, database_name)
    if num_new_peptides_to_run_jpred == 0:
        jpred.process_jpred_output(database, database_name)
        # write_to_excel(database, database_name + "After_adding_Jpred_results.xlsx")
    else:
        print('     {} sequences to run Jpred'.format(num_new_peptides_to_run_jpred))


def perform_fibril_formation_prediction(database: pd.DataFrame, database_name: str, statistical_result_dict: dict):
    """
    The function preforms the fibril-formation prediction of the helical and secondary structure switch (ssw) sequences.
    For helical peptides - the fibril formation prediction relays on the average uH of the helical segments.
    For sse peptides - the fibril formation prediction relays on the average H (hydrophobicity) of the
                             full-length ssw peptides.


    :param database_name: Name of the given database
    :param statistical_result_dict: dictionary that contain statistical analysis of the current database.
    :param database: database containing helical and ssw prediction and uH and H calculations
    :return: No return value. Updates the prediction in the database with columns:
         "FF-Secondary structure switch" = 1 for ff-ssw, -1 otherwise
         "FF-Secondary structure switch score" = ff-ssw score (sum of hydrophobicity, full length beta uH,
                                                              full length helical uH and the ssw score by Tango)
         "FF-Helix (Jpred)" = 1 for ff-helix prediction, -1 otherwise
         "FF-helix score" = ff-helix score (sum of full length helical uH and Jpred averaged score)

         This function also updates the statistical result dictionary with:
         '5 SSW fibril-formation H threshold' = Hydrophobicity threshold determining the ssw fibril-formation prediction
         '6 Helix fibeil-formation uH threshold' = uH threshold determining the helical fibril-formation prediction
    """
    ssw_avg_H = database[database["SSW prediction"] != 1]["Hydrophobicity"].mean()
    statistical_result_dict[database_name]['5 SSW fibril-formation H threshold'] = ssw_avg_H
    jpred_helix_avg_uH = database[database["Helix score (Jpred)"] != -1]["Helix (Jpred) uH"].mean()
    statistical_result_dict[database_name]['6 Helix fibeil-formation uH threshold'] = jpred_helix_avg_uH

    ssw_ff = []
    jpred_helix_ff = []
    ssw_score = []
    helix_score = []

    for _, row in database.iterrows():
        if row["SSW prediction"] == 1 and row["Hydrophobicity"] >= ssw_avg_H:
            ssw_ff.append("1")
            cur_chameleon_score = row["Hydrophobicity"] + row["Beta full length uH"] + row["Full length uH"] + \
                                  row["SSW score"]
            ssw_score.append(cur_chameleon_score)
        else:
            ssw_ff.append(-1)
            ssw_score.append(-1)
        if len(row["Helix fragments (Jpred)"]) != 0 and row["Helix (Jpred) uH"] >= jpred_helix_avg_uH:
            jpred_helix_score = row["Full length uH"] + row["Helix score (Jpred)"]
            jpred_helix_ff.append(1)
            helix_score.append(jpred_helix_score)
        else:
            jpred_helix_ff.append(-1)
            helix_score.append(-1)

    database["FF-Secondary structure switch"] = ssw_ff
    database["FF-Secondary structure switch score"] = ssw_score
    database["FF-Helix (Jpred)"] = jpred_helix_ff
    database["FF-helix score"] = helix_score


def add_database_name(database: pd.DataFrame, database_name: str):
    """
    This function adds a column containing the database name to each row

    :param database:
    :param database_name:
    :return: Modify database
    """
    number_of_peptides_in_database = database.shape[0]
    name_list = [database_name for _ in range(number_of_peptides_in_database)]
    assert len(name_list) == number_of_peptides_in_database, "name list and database number of rows is different"
    database["Keyword"] = name_list


def merge_databases(databases_dict: dict) -> pd.DataFrame:
    """
    This function merges all databases given to the programe to one .xlsx file containing all the results.

    :param databases_dict: Dictionary contaiinng all calculated database by keys as database names and values as
    their pd.Dataframe
    :return: Dataframe containing all the results together
    """
    if len(databases_dict) == 1:
        return list(databases_dict.values())[0]
    final_df = pd.DataFrame()
    for keyword, keyword_df in databases_dict.items():
        final_df = pd.concat([final_df, keyword_df], ignore_index=True)
    return final_df


def add_final_prediction_to_statistical_result_dict(statistical_result_dict: dict, database: pd.DataFrame,
                                                    database_name: str, antimicrobial_entries: list):
    """
    This function adds the final prediction to the statistical results

    :param statistical_result_dict: dictionary who saves the statistical result calculations
    :param database: the database to work on
    :param database_name: database name
    :param antimicrobial_entries: list of entries tagged as antimicrobial
    :return: Updates the statistical_result_dict with two new keys:
            3 Fibril Forming prediction - counts all entries marked as ff-helical or ff-ssw
            Antimicrobial Fibril Forming prediction - counts all ff-predictions that are also tagged as antimicrobial
    """
    count_ff_results = 0
    count_antimicrobial_ff_results = 0
    for _, row in database.iterrows():
        if (row["FF-Secondary structure switch"] == '1') or (row["FF-Helix (Jpred)"] == '1'):
            count_ff_results += 1
            if row["Entry"] in antimicrobial_entries:
                count_antimicrobial_ff_results += 1
    statistical_result_dict[database_name]["3 Fibril Forming prediction"] = count_ff_results
    statistical_result_dict[database_name]["Antimicrobial Fibril Forming prediction"] = count_antimicrobial_ff_results


def compare_to_lab_results(database: pd.DataFrame):
    """
    This function compares the fibril-forming predictions of the database to the Landau-lab peptides

    :param database:
    :return:Updates the database for shared entries with the peptide information exists in Landau-lab database
            'LandauID' - the name of the peptide in the landau-lab database
            'TEM Fibrils' - V if fibrils were detected, or X otherwise
            'Fiber diffraction' - results of fiber diffraction if exists
            'ThT' = V if bound ThT, or X otherwise
    """
    landau_lab_peptides = pd.read_excel(LANDAU_LAB_PEPTIDES_FILEPATH, engine='openpyxl')

    true_positive = 0
    true_negative = 0
    false_positive = 0
    false_negative = 0

    for _, land_row in landau_lab_peptides.iterrows():
        for idx, row in database.iterrows():
            cur_sequence = auxiliary.__get_sequence_without_modification(row['Sequence'])
            if pd.isna((row['Sequence'])):
                cur_orig_seq = ""
            else:
                cur_orig_seq = auxiliary.__get_sequence_without_modification(row['Sequence'])
            land_seq = auxiliary.__get_sequence_without_modification(land_row['Sequence'])

            if (land_seq == cur_orig_seq) or (land_seq == cur_sequence):
                database.at[idx, 'LandauID'] = land_row['Full name']
                database.at[idx, 'TEM Fibrils'] = land_row['TEM Fibrils']
                database.at[idx, 'Fiber diffraction'] = land_row['Fiber diffraction']
                database.at[idx, 'ThT'] = land_row['ThT']

                if row['FF-Helix (Jpred)'] == 1 or row['FF-Secondary structure switch'] == 1:
                    if land_row['TEM Fibrils'] == 'V':
                        true_positive += 1
                    else:
                        false_positive += 1
                else:
                    if land_row['TEM Fibrils'] == 'V':
                        false_negative += 1
                    else:
                        true_negative += 1


if __name__ == "__main__":
    print("Gathering input files ...................................................................................\n")
    # TODO: to allow the possibility of automatically downloading data from UniProt by keywords, add it here.
    if len(RUN_ONLY_DATABASE) > 0:
        input_file_list = RUN_ONLY_DATABASE
    else:
        input_file_list = auxiliary.get_input_files(JOB_RUN)
    print(*input_file_list, sep='\n')

    databases_dict = {}
    statistical_result_dict = {}

    # TODO: if we want to find antimicrobial entries inside each database remove note from next line
    # antimicrobial_entries_list = auxiliary.get_all_antibacterial_entries()
    antimicrobial_entries_list = []

    existent_tango_results = tango.get_all_existed_tango_results_entries()

    for file in input_file_list:
        print(SEPARATOR)
        # TODO: if the user gives a job name, than the database_name should be defined to be that job name
        database_name = auxiliary.get_database_name_from_file(file)

        statistical_result_dict[database_name] = {}

        print("Working on {} database..............................................".format(database_name))

        print("     Creating database...........................................................")
        cur_database = create_database(file, statistical_result_dict, database_name)

        print("     Running_and_analysing_tango.................................................")
        run_and_analyse_tango(cur_database, database_name, statistical_result_dict, existent_tango_results)

        print("     Creating_jpred_input........................................................")
        run_and_analyse_jpred(cur_database, database_name)

        print("     Performing biochemical calculations.........................................")
        calculate_biochemical_features(cur_database)

        print("     Preforming prediction.......................................................")
        perform_fibril_formation_prediction(cur_database, database_name, statistical_result_dict)

        print("     Exporting data and predictions")
        add_database_name(cur_database, database_name)

        # auxiliary.add_duplications_with_antimicrobial_entrys(cur_database, database_name, statistical_result_dict,
        #                                                      antimicrobial_entries_list)

        add_final_prediction_to_statistical_result_dict(statistical_result_dict, cur_database, database_name,
                                                        antimicrobial_entries_list)

        #compare_to_lab_results(cur_database)
        if not os.path.exists(JOB_RUN + '/Output'):
            os.mkdir(JOB_RUN + '/Output')
        write_to_excel(cur_database, JOB_RUN + '/Output/Final_' + database_name + '.xlsx')

    merged_database = merge_databases(databases_dict)
    write_to_excel(merged_database, "Final_merged_databases.xlsx")
    write_to_excel(pd.DataFrame(statistical_result_dict), "Final_statistical_result.xlsx", True)
