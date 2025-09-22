import { Peptide } from "@/types/peptide";

// Very simple default mapper
export function mapBackendRowToPeptide(row: any, i: number): Peptide {
  const seq: string = String(
    row.Sequence ?? row.sequence ?? row.seq ?? ""
  ).toUpperCase();

  return {
    id: String(row.Entry ?? row.id ?? i + 1),
    name: row["Protein name"] ?? row.Name ?? `Peptide ${i + 1}`,
    sequence: seq,
    length: seq.length,
    species: row.Organism ?? row.species,
    hydrophobicity: Number(row.Hydrophobicity ?? row.hydrophobicity ?? 0),
    charge: Number(row.Charge ?? row.charge ?? 0),
    muH: Number(row.muH ?? row["Hydrophobic moment"] ?? 0),
    chameleonPrediction: row.chameleonPrediction ?? 0,
    ffHelixPercent: Number(row.ffHelixPercent ?? 0),
    jpred: row.helixFragments ? { helixFragments: row.helixFragments } : undefined,
  };
}
