import os
from statistics import mean
from statistics import median
import numpy as np
import pandas as pd
import warnings

import biochemCalculation

PATH = os.getcwd()
JPRED_INPUT_FILEPATH = "jpred_input.txt"
MINIMAL_PEPTIDE_LENGTH = 40

MIN_LENGTH = 5
MAX_GAP = 3
MIN_JPRED_SCORE = 7
MIN_TANGO_SCORE = 0
MAX_CHAMELEON_DIFFERENCE_TANGO = np.inf

# --- FF-Helix helpers (pure Python; no external tools) ---

# Simple helix propensity (normalized ~0..1) — tweak if you like
_HELIX_PROP = {
    "A": 1.42, "E": 1.51, "L": 1.21, "M": 1.45, "Q": 1.11, "K": 1.14, "R": 0.98,
    "I": 1.08, "V": 1.06, "W": 1.08, "F": 1.13, "T": 0.83, "S": 0.77, "Y": 0.69,
    "H": 1.00, "C": 0.70, "N": 0.67, "D": 1.01, "G": 0.57, "P": 0.57,
}

def _hprop(seq: str):
    """Get helix propensity for each residue in sequence."""
    return [_HELIX_PROP.get(aa, 1.0) for aa in (seq or "").upper()]

def ff_helix_percent(seq: str, core_len: int = 6, thr: float = 1.0) -> float:
    """
    Calculate percentage of residues that belong to ≥core_len window with mean helix propensity ≥ threshold.
    Uses a more realistic threshold of 1.0 (average helix propensity).
    """
    s = (seq or "").upper().strip()
    if len(s) < core_len:
        return 0.0
    
    hp = _hprop(s)
    in_core = [False] * len(s)
    
    # Check each possible window
    for i in range(len(s) - core_len + 1):
        window_props = hp[i:i + core_len]
        window_mean = sum(window_props) / core_len
        
        if window_mean >= thr:
            # Mark all residues in this window as part of a helix core
            for j in range(i, i + core_len):
                in_core[j] = True
    
    if not any(in_core):
        return 0.0
    
    percent = round(100.0 * sum(in_core) / len(s), 1)
    return percent

def ff_helix_cores(seq: str, core_len: int = 6, thr: float = 1.0):
    """
    Find FF-Helix core segments as contiguous regions where sliding windows meet threshold.
    Returns list of [start, end] segments (1-indexed).
    """
    s = (seq or "").upper().strip()
    if len(s) < core_len:
        return []
    
    hp = _hprop(s)
    core_marks = [False] * len(s)
    
    # Mark residues that are part of qualifying windows
    for i in range(len(s) - core_len + 1):
        window_props = hp[i:i + core_len]
        window_mean = sum(window_props) / core_len
        
        if window_mean >= thr:
            for j in range(i, i + core_len):
                core_marks[j] = True
    
    # Convert marks to contiguous segments
    segments = []
    i = 0
    while i < len(s):
        if core_marks[i]:
            start = i
            # Find the end of this contiguous region
            while i < len(s) and core_marks[i]:
                i += 1
            end = i - 1
            # Convert to 1-indexed and add to results
            segments.append([start + 1, end + 1])
        else:
            i += 1
    
    return segments


def get_input_files(run_job: str) -> list:
    """
    This function get all input files for the current job running, by the 'run_job' variable indicating the name of the
    folder to search for databases.
    :param run_job: Name of folder that will contain databases to run
    :return: list of files
    """
    input_files = []
    for root, dirs, files in os.walk(PATH + '/' + run_job + '/Database'):
        for file in files:
            input_files.append(run_job + '/Database/' + file)
    return input_files


def filter_uncertain_and_long_sequences(database: pd.DataFrame):
    """
    This function removes all entries in the database that are longer than MINIMAL_PEPTIDE_LENGTH and all sequences
    that have sequence caution, sequence conflict or sequence uncertainty.
    :param database:
    :return: Nothing. changes the given database
    """
    database_indexes = set(database.index)

    long_sequences_idx = set(database[database["Length"] > MINIMAL_PEPTIDE_LENGTH].index)

    no_caution_sequence_idx = set(database[database["Sequence caution"].isnull()].index)
    no_sequence_conflict_idx = set(database[database["Sequence conflict"].isnull()].index)
    no_sequence_uncertainty_idx = set(database[database["Sequence uncertainty"].isnull()].index)

    caution_sequence_idx = database_indexes.difference(no_caution_sequence_idx)
    sequence_conflict_idx = database_indexes.difference(no_sequence_conflict_idx)
    sequence_uncertainty_idx = database_indexes.difference(no_sequence_uncertainty_idx)

    drop_indexes = list(long_sequences_idx.union(caution_sequence_idx, sequence_conflict_idx, sequence_uncertainty_idx))
    database.drop(drop_indexes, inplace=True)


def __check_subsegment_without_the_end(prediction, start, original_end, min_length, min_score):
    cur_end = original_end - 1
    while len(prediction[start:(cur_end + 1)]) >= min_length:
        segment_length = cur_end - start + 1
        good_segment = good_segment = segment_length >= min_length and \
                                      (mean(prediction[start:cur_end + 1]) >= min_score or
                                       median(prediction[start:cur_end + 1]) >= min_score)
        if good_segment:
            return cur_end
        cur_end -= 1
    return -1


def __check_subsegment(prediction: list, start: int, end: int) -> tuple:
    all_possible_length = [i for i in range(MIN_LENGTH, (end - start + 1 + 1))]
    max_start = -1
    max_end = -1
    max_score = -1
    for cur_length in all_possible_length:
        for i in range(start, end - cur_length + 1):
            cur_mean = mean(prediction[i:(i + cur_length)])
            cur_median = median(prediction[i:(i + cur_length)])
            if cur_mean > max_score or cur_median > max_score:
                max_score = max(cur_median, cur_mean)
                max_start = i
                max_end = i + cur_length

    return max_start, max_end, max_score


def get_secondary_structure_segments(prediction: list, prediction_method: str) -> list:
    """
    This function calculates the segments that are predicted to have above the threshold secondary structure prediction.
    For each secondary structure prediction method the threshold is determined different:
    Jpred = MIN_JPRED_SCORE
    Tango = MIN_TANGO_SCORE
    which are global variables that can be manually change.

    :param prediction_method: name of the tool the prediction came from: Tango\Jpred
    :param prediction: list of float numbers indicating the prediction score for each residue
    :return: list of tuples with start and end indexes of segments predicted to have secondary structure
    """
    min_score = - np.inf
    if prediction_method == "Tango":
        min_score = MIN_TANGO_SCORE
    elif prediction_method == "Jpred":
        min_score = MIN_JPRED_SCORE

    segments = []
    i = 0
    while i < len(prediction):
        if prediction[i] > 0:
            start = i
            gap = 0
            i += 1
            while i < len(prediction) and gap <= MAX_GAP:
                if prediction[i] == 0:
                    gap += 1
                else:
                    gap = 0
                i += 1

            end = i - 1 - gap
            segment_length = end - start + 1
            good_segment = segment_length >= MIN_LENGTH and (mean(prediction[start:end]) >= min_score or
                                                             median(prediction[start:end]) >= min_score)
            if good_segment:
                segments.append(tuple((start, end)))
            elif segment_length >= MIN_LENGTH:
                shorter_segment_start, shorter_segment_end, shorter_segment_score = __check_subsegment(prediction,
                                                                                                       start, end)
                if shorter_segment_end != -1 and shorter_segment_start != -1 and shorter_segment_score >= min_score:
                    segments.append(tuple((shorter_segment_start, shorter_segment_end)))

        i += 1
    return segments


def __calc_average_score(prediction: list, structure_prediction_indexes: list) -> float:
    """
    Calculates the average score of the secondary structure prediction by averaging the average score of each segment
    predicted to have secondary structure.

    :param prediction: list of prediction scores
    :param structure_prediction_indexes: list of tuples, each tuple represent the start and end index of segment
    predicted to have secondary structure.
    :return: average prediction score
    """
    if len(structure_prediction_indexes) == 0:
        return -1
    segments_scores = []
    for start, end in structure_prediction_indexes:
        segments_scores.append(mean(prediction[start: end + 1]))
    return mean(segments_scores)


def calc_secondary_structure_switch_difference_and_score(beta_prediction: list, helix_prediction: list,
                                                         structure_prediction_indexes: list) -> tuple:
    """
    Calculate the score of secondary structure switch segments by summing the average score of the helical prediction
    and beta prediction. In addition, it calculates the difference between these averaged scores.

    :param beta_prediction: list of prediction scores
    :param helix_prediction: list of prediction scores
    :param structure_prediction_indexes: list of tuples, each tuple represent the start and end index of segment
    predicted to have secondary structure.
    :return: secondary structure switch score, secondary structure switch difference
    """
    if len(structure_prediction_indexes) == 0:
        return -1, -1

    beta_score = __calc_average_score(beta_prediction, structure_prediction_indexes)
    helix_score = __calc_average_score(helix_prediction, structure_prediction_indexes)
    ssw_score = beta_score + helix_score
    ssw_diff = abs(beta_score - helix_score)
    return ssw_score, ssw_diff


def find_secondary_structure_switch_segments(beta_segments: list, helix_segments: list) -> list:
    """
    Merge segments predicted to be helical and beta to one secondary structure switch (SSW) segment prediction.
    SSW segments are residues that have both helical and beta residues that their length is larger than MIN_LENGTH.

    :param beta_segments: list of tuples where each tuple represent the start and end index of a predicted segment
    :param helix_segments: list of tuples where each tuple represent the start and end index of a predicted segment
    :return: list of tuples where each tuple represent the start and end index of a predicted segment
    """
    merged_segments = []
    helix_ind = 0
    beta_ind = 0
    # print("helix_segments={}, beta_segments={}".format(helix_segments, beta_segments))
    # print("result = {}".format(result))
    while helix_ind < len(helix_segments) and beta_ind < len(beta_segments):
        # print("helix_ind={}, beta_ind={}".format(helix_ind, beta_ind))
        h_start = helix_segments[helix_ind][0]
        h_end = helix_segments[helix_ind][1]
        b_start = beta_segments[beta_ind][0]
        b_end = beta_segments[beta_ind][1]
        # print("h_start={}, h_end={}\nb_start={}, b_end={}".format(h_start, h_end, b_start, b_end))

        ''' [] {} '''
        if h_end <= b_start:
            helix_ind += 1
            continue

        ''' {} [] '''
        if b_end <= h_start:
            beta_ind += 1
            continue

        if b_start < h_start or b_start == h_start:
            merged_segments.append(tuple((h_start, h_end)))
            if h_end == b_end:
                beta_ind += 1
            helix_ind += 1
            continue

        if h_start <= b_start:
            merged_segments.append(tuple((b_start, b_end)))
            if h_end == b_end:
                helix_ind += 1
            beta_ind += 1
            continue

        if b_start < h_start and b_end < h_end:
            merged_segments.append(tuple((h_start, b_end)))
            beta_ind += 1
            continue

        if h_start < b_start and h_end < b_end:
            merged_segments.append(tuple((b_start, h_end)))
            helix_ind += 1
            continue

    # print("merged_segments = {}".format(merged_segments))
    return merged_segments



# Also add this function that's missing from your auxiliary.py:
def get_avg_uH_by_segments(sequence: str, segments: list) -> float:
    """
    Calculate average hydrophobic moment for given segments.
    Returns -1 if no valid segments.
    """
    if not sequence or not segments:
        return -1.0
    
    try:
        total_muH = 0.0
        total_length = 0
        
        for segment in segments:
            if len(segment) >= 2:
                start, end = segment[0] - 1, segment[1]  # Convert to 0-indexed
                if 0 <= start < len(sequence) and start < end <= len(sequence):
                    seg_seq = sequence[start:end]
                    if seg_seq:  # Make sure segment is not empty
                        muH = biochemCalculation.hydrophobic_moment(seg_seq)
                        total_muH += muH * len(seg_seq)
                        total_length += len(seg_seq)
        
        return total_muH / total_length if total_length > 0 else -1.0
        
    except Exception as e:
        print(f"[DEBUG] Error in get_avg_uH_by_segments: {e}")
        return -1.0

def check_secondary_structure_prediction_content(secondary_structure_prediction_conf: list) -> float:
    """
    This function calculates the percentage of secondary structure prediction of the sequence.

    :param secondary_structure_prediction_conf: list of floats with confidence value of secondary structure prediction.
    :return: percentage of secondary structure prediction
    """
    residues_with_secondary_structure_prediction = 0
    for residue_conf_value in secondary_structure_prediction_conf:
        if residue_conf_value > 0:
            residues_with_secondary_structure_prediction += 1
    if residues_with_secondary_structure_prediction == 0:
        return 0
    return (residues_with_secondary_structure_prediction / len(secondary_structure_prediction_conf)) * 100


def get_corrected_sequence(sequence: str) -> str:
    """
    Substitute letters for general amino acid to be compatible to Jpred input requirements:
    "X" -> "A"
    "Z" -> "E"
    "B" -> D
    "U" -> C

    :param sequence: The sequence to modify
    :return: sequence with the substituted amino acids
    """
    s1 = sequence.replace('X', 'A')
    s2 = s1.replace('Z', 'E')
    s3 = s2.replace('U', 'C')
    s4 = s3.replace('B', 'D')
    if '-' in s4:
        return s4.split('-')[0].upper()
    return s4.upper()


def __get_sequence_without_modification(sequence: str) -> str:
    modification_count = sequence.count("-")
    if modification_count == 2:
        return sequence.split("-")[1]
    elif modification_count == 1:
        if sequence.find("-") > len(sequence) / 2:
            return sequence.split("-")[0]
        else:
            return sequence.split("-")[1]
    else:
        return sequence


def get_sequences_without_modifications(peptides_list: list) -> list:
    peptides_without_modifications = []
    for sequence in peptides_list:
        if pd.isna(sequence):
            continue
        peptides_without_modifications.append(__get_sequence_without_modification(sequence))
    return peptides_without_modifications


def list_string_to_float(num_string_list: list):
    """
    converting a list of strings to list of float's
    :param num_string_list: list of strings to convert
    :return: list of floats numbers
    """
    """
    list_string_to_float -  .
        input: l - list of strings.
        output: list of float's.
    """
    float_list = list()
    for i in range(len(num_string_list)):
        if num_string_list[i] == "-1.#IO":
            return list()
        float_list.append(float(num_string_list[i]))
    return float_list


def get_all_antibacterial_entries() -> list:
    with warnings.catch_warnings(record=True):
        warnings.simplefilter("always")
        original_database = pd.read_excel("uniprot-keyword__Antimicrobial+[KW-0929]_.xlsx", engine="openpyxl")
    return list(original_database["Entry"])


def add_duplications_with_antimicrobial_entrys(cur_database: pd.DataFrame, database_name: str,
                                               statistical_result_dict: dict, antimicrobial_entries: list):
    if database_name == "Antimicrobial+":
        statistical_result_dict[database_name]["Antimicrobial entries"] = len(antimicrobial_entries)
        return
    count_antimicrobial_entries = 0
    for _, entry in cur_database["Entry"].items():
        if entry in antimicrobial_entries:
            count_antimicrobial_entries += 1
    statistical_result_dict[database_name]["Antimicrobial entries"] = count_antimicrobial_entries


def add_database_info_to_statistical_results(statistical_result_dict: dict):
    # C:/Users/peleg/PycharmProjects/Alpha_and_Chameleon_Peptides/
    uniprot_kb_databases_info = pd.read_excel('Uniprot_KB/Uniprot_KB_databases_info.xlsx', engine='openpyxl')
    uniprot_kb_info_dict = {}
    for _, row in uniprot_kb_databases_info.iterrows():
        if row['Organism ID'] > 0:
            uniprot_kb_info_dict[str(int(row['Organism ID']))] = {'# Proteins': row['Total number of proteins'],
                                                                  '# 40< Proteins': row['Short proteins (up to 40 aa)']}

    for db in statistical_result_dict.keys():
        cur_db_info = uniprot_kb_info_dict[str(db)]
        statistical_result_dict[str(db)]['1 # Proteins'] = cur_db_info['# Proteins']
        statistical_result_dict[str(db)]['2 # 40< Proteins'] = cur_db_info['# 40< Proteins']
        statistical_result_dict[str(db)].pop('Original length')
        statistical_result_dict[str(db)].pop('After filter')
        statistical_result_dict[str(db)].pop('Antimicrobial Fibril Forming prediction')

        sorted_cur_db_dict = dict(sorted(statistical_result_dict[str(db)].items()))
        statistical_result_dict[str(db)] = sorted_cur_db_dict


def get_database_name_from_file(file_name: str) -> str:
    """
    This function gets a database file name in UniProt format and return the database name.
    :param file_name: The file name from which to extract the database name.
    :return: database name
    """
    database_file_split = file_name.split('_')
    return database_file_split[4] + '_' + database_file_split[5]


def filter_entries_without_Jpred_result(database: pd.DataFrame) -> pd.DataFrame:
    """
    This function filters out of the given database entries that do not have Jpred results, due to Jpred restrictions.
    :param database: database to filter
    :return: new database without Jpred-less result entries
    """
    filtered_database = database.drop(database[database['Entry'] == 'A0A3D2B8F4'].index)
    filtered_database = filtered_database.drop(filtered_database[filtered_database['Entry'] == 'A0A6B2FE55'].index)
    filtered_database = filtered_database.drop(filtered_database[filtered_database['Entry'] == 'A0A1X4JA79'].index)
    filtered_database = filtered_database.drop(filtered_database[filtered_database['Entry'] == 'A0A1X4JF71'].index)
    filtered_database = filtered_database.drop(filtered_database[filtered_database['Entry'] == 'A0A0E1PXY5'].index)
    filtered_database = filtered_database.drop(filtered_database[filtered_database['Entry'] == 'A4NWW5'].index)
    filtered_database = filtered_database.drop(filtered_database[filtered_database['Entry'] == 'A5UHP6'].index)
    filtered_database = filtered_database.drop(filtered_database[filtered_database['Entry'] == 'A0A377Z9E9'].index)
    return filtered_database
