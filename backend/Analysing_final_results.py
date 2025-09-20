import pandas as pd
from main import write_to_excel

def analyse_database(filepath: str):
    database = pd.read_csv(filepath)

    duplicated_rows = database.loc[database.Sequence.duplicated(keep=False), :]
    write_to_excel(duplicated_rows, "Duplicated_entries.csv")
    uniq_sequences = duplicated_rows.Sequence.unique()
    print("uniq_sequences length = {}".format(len(uniq_sequences)))
    uniq_sequences_info = {}
    for _, row in database.iterrows():
        if row["Sequence"] in uniq_sequences:
            if row["Sequence"] in uniq_sequences_info.keys():
                if row["Entry"] not in uniq_sequences_info[row["Sequence"]]["Entry"]:
                    print("{} have different entries".format(row["Sequence"]))
                    uniq_sequences_info[row["Sequence"]]["Entry"].append(row["Entry"])
                if row["Entry"] not in uniq_sequences_info[row["Sequence"]]["Function"]:
                    uniq_sequences_info[row["Sequence"]]["Function"].append(row["Keyword"])
            else:
                uniq_sequences_info[row["Sequence"]] = {"Entry": [row["Entry"]], "Function": [row["Keyword"]]}
    print(uniq_sequences_info)

def get_accuracy_statistics():
    ff = ["CAMPST176", "CAMPST438", "CAMPSQ662", "CAMPSQ629", "CAMPSQ2130", "CAMPSQ233", "CAMPSQ3388", "CAMPSQ8220",
          "CAMPST171", "CAMPSQ3844", "CAMPSQ3257", "CAMPSQ367", "CAMPSQ2718", "CAMPSQ255", "CAMPSQ1169", "CAMPSQ868",
          "CAMPSQ672"]
    not_ff = ["CAMPST123", "CAMPST57", "CAMPSQ7558", "CAMPSQ2813", "CAMPST54", "CAMPSQ25", "CAMPSQ608", "CAMPST114",
              "CAMPSQ92", "CAMPSQ3253", "CAMPSQ196", "CAMPSQ114", "CAMPSQ1054", "CAMPSQ842", "CAMPSQ355"]

    campr3_df = pd.read_csv("Final_CAMPR3+.csv")
    tp = []
    tn = []
    fp = []
    fn = []
    for _, row in campr3_df.iterrows():
        peptide_entry = row["Entry"]
        if row["FF-Helix (Jpred)"] == 1 or row["FF-Chameleon"] == 1:
            if row["Entry"] in ff:
                tp.append(peptide_entry)
            elif row["Entry"] in not_ff:
                fp.append(peptide_entry)
        elif row["FF-Helix (Jpred)"] != 1 and row["FF-Chameleon"] != 1:
            if row["Entry"] in ff:
                fn.append(peptide_entry)
            elif row["Entry"] in not_ff:
                tn.append(peptide_entry)
    print("Validation results:\ntp = {}\ntn = {}\nfp = {}\nfn = {}".format(tp, tn, fp, fn))

if __name__ == "__main__":
    analyse_database("Final_merged_databases.csv")
    get_accuracy_statistics()