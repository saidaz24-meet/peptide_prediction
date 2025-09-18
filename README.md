This project predicts helical or secondary structure switch peptides with potential to form fibrils out of a Uniprot database. The calculations relays on two secondary structure prediction tools: Tango, which run automatically from the code, and Jpred, whose input and output analysis are generated automatically, but the actual run should be performed separately.

The code runs through the main.py but several pre-determined variables should be revied and changed according to the user specific needs.

Python packaged in use:

pandas
numpy
os
subprocess
warnings

Before running the code, there is a need to check and re-define if neccesary the global parameters in:

main.py:

LANDAU_LAB_PEPTIDES_FILEPATH = Path to file comtaining the Landu-lab peptide database
JPRED_INPUT_FILEPATH = filepath to Jpred directory (will contain automatically generated Jpred input and should containd Jpred prediction results)
MIN_H_CONTENT = minimal percentage of helical secondary structure prediction in order to be predicted as a helical peptide. Change only if you want to limit the secondary structure prediction to a certain percentage from the whole sequence.
MIN_SSW_B_CONTENT = minimal percentage of beta secondary structure prediction in order to be predicted as a secondary structure switch peptide. Change only if you want to limit the secondary structure prediction to a certain percentage from the whole sequence.
MIN_SSW_H_CONTENT = minimal percentage of helical secondary structure prediction in order to be predicted as a secondary structure switch peptide. Change only if you want to limit the secondary structure prediction to a certain percentage from the whole sequence.
RUN_ONLY_DATABASE = To run a specific database rather than automatically gathering files from directory add to the list the filepath to that specific database.
JOB_RUN = name of a directory where all databases to run will be.
tango.py:

TANGO_RUN_FILEPATH = Path to the directory where the 'Tango_run.bat' file exists.
TANGO_BAT_FILEPATH = Path to the file 'Tango_run.bat'
TANGO_DIRECTORY_PATH = Path to the Tango directory where input file, run file and results are saved.
TANGO_RESULT_DIRECTORY = Full path to tango result directory.
KEY = Column name in the database describing the unique identity of each column.

jpred.py:

JPRED_INPUT_FILEPATH = Path to directory where Jpred output are saved. Change only if it is not in the project directory.
JPRED_OUTPUT_DIRECTORY_ENDING = ending of the directory generated automatically from the Jpred predictor. Change only if manually changeing the Jpred result automatically generated.
DO NOT CHANGE THESE PARAMETERS:

JPRED_PREDICTION_FILE_ENDING = Ending of the file containing the Jpred prediction result.
JPRED_PREDICTION_TITLE = Saved word to the line describing the secondary structure prediction of Jpred in the result file.
JPRED_PREDICTION_CONF_TITLE = Saved word to the line describing the confidance score of the secondary structure prediction of Jpred in the result file.

auxiliary.py:

PATH = Path to the project directory.
MINIMAL_PEPTIDE_LENGTH = The minimal peptide length
MIN_LENGTH = Minimal length of residues in a sequence that needs to have secondary structure prediction in order to be predicted as such.
MAX_GAP = Maximal number of residues that do not have secondary structure prediction in the middle of a fragments that have a secondary structure predition.
MIN_JPRED_SCORE = Minimal average confidance score for residues to be predicted as helical by Jpred.
MIN_TANGO_SCORE = Minimal average confidance score for residues to be predicted as secondary structure switch (helix or beta) by Tango.