export const CSV_HEADERS = {
  Entry: "Entry",
  Sequence: "Sequence",
  Length: "Length",
  "Protein name": "Protein name",
  Organism: "Organism",
  Hydrophobicity: "Hydrophobicity",
  Charge: "Charge",
  "Full length uH": "Full length uH",
  "SSW prediction": "SSW prediction",
  "SSW score": "SSW score",
  "SSW diff": "SSW diff",
  "SSW helix percentage": "SSW helix percentage",
  "SSW beta percentage": "SSW beta percentage",
  "FF-Helix %": "FF-Helix %",
  "FF Helix fragments": "FF Helix fragments",
} as const;

export type CsvHeader = keyof typeof CSV_HEADERS;

// Map CSV header (exact string) -> frontend camelCase property name (canonical)
export const CSV_TO_FRONTEND: Record<CsvHeader, string> = {
  Entry: "id",
  Sequence: "sequence",
  Length: "length",
  "Protein name": "name",
  Organism: "species",
  Hydrophobicity: "hydrophobicity",
  Charge: "charge",
  "Full length uH": "muH",
  "SSW prediction": "sswPrediction",
  "SSW score": "sswScore",
  "SSW diff": "sswDiff",
  "SSW helix percentage": "sswHelixPercentage",
  "SSW beta percentage": "sswBetaPercentage",
  "FF-Helix %": "ffHelixPercent",
  "FF Helix fragments": "ffHelixFragments",
};