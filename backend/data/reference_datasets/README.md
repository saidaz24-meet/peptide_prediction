# PVL — Reference Datasets

Curated reference datasets shipped with PVL for benchmarks, paper case studies, and the "Try example" UX flow on the homepage.

Each dataset is a versioned JSON artifact whose schema is stable across PVL releases (`schema_version`).

---

## Available datasets

### `peleg_118_fibril_validated.json`

- **N**: 118 peptides.
- **Length**: ≤ 40 aa.
- **Curator**: Dr. Peleg Ragonis-Bachar (Technion).
- **Source file**: `Experementaly_validated_Fibril_forming_Proteins_Less_than_or_Equal_to_40aa.xlsx`.
- **Ingested**: 2026-06-18.
- **Sources**: UniProt General · AmyPro · AmyPro literature · UniProt AMP collection.
- **Categories**: FF · AF-AMP · Pathogenic amyloid · Functional amyloid · UniProt AMPs.
- **Role**: positive-control reference set for FF-Helix + FF-SSW recall benchmarks; cited in the PVL paper.
- **Notable members**: HD6 (Q01524), Melittin (P01501 44-69), Uperin-3.5 (P82042), Phosphoribulokinase (P25934), PlnA-22 (P80214).

---

## JSON schema

```jsonc
{
  "dataset_id": "string",
  "title": "string",
  "curator": "string",
  "source_file": "string",
  "ingested_at": "YYYY-MM-DD",
  "pvl_version": "vX.Y.Z",
  "schema_version": "1",
  "n_peptides": 118,
  "sources": ["..."],
  "categories": ["..."],
  "role": "string",
  "peptides": [
    {
      "id": "peleg118_001",
      "name": "string | null",
      "uniprot_id": "string | null",
      "organism": "string | null",
      "pubmed": ["string", "..."],
      "original_database": "string | null",
      "antimicrobial": true,
      "general_category": "string | null",
      "fibril_formation_reference": "string | null",
      "sequence": "AFTCHCRRSCYSTEYSYGTCTVMGINHRFCCL",
      "length": 32
    }
  ]
}
```

**Null semantics**: missing fields are JSON `null`, never `"N/A"` or `-1`. Same rule as the rest of PVL.

**Sequence canonicalization**: uppercase, no whitespace, ambiguous residue codes (e.g. `X`) preserved as-is. Backend predictors decide whether to skip ambiguous residues.

---

## How PVL uses these datasets

### As a "Try example" payload
The homepage and Start Analysis UI surface `peleg_118_fibril_validated` as a one-click example. The backend recognizes `{"precomputed": "peleg_118_fibril_validated"}` payloads and returns the pre-computed normalized response without re-running TANGO + S4PRED.

### As a reference cohort
The Cohort Comparison UI offers "vs Peleg-118 fibril-validated" as a built-in comparison cohort (per Peleg request 2026-06-18, PELEG_NOTES C20).

### As a benchmark
The validation script at `backend/scripts/rerun_validation_2026_06_07.py` (and any successor) runs the full prediction pipeline on this dataset and reports FF-Helix + FF-SSW recall.

---

## Pre-computed prediction artifacts

The raw dataset above is the **input** set. The **pre-computed prediction outputs** (TANGO + S4PRED + classification, normalized to the API response shape) live at:

```
backend/data/precomputed/peleg_118.json
```

Pre-computation is done by `make precompute-datasets` (planned, M2 action item from 2026-06-18 meeting). Re-run after any predictor binary or parameter change so the example responses stay in sync.

---

## Adding a new reference dataset

1. Pick a stable `dataset_id` (snake_case, descriptive).
2. Write the JSON artifact following the schema above into this directory.
3. Bump `schema_version` if you add new fields.
4. Update the list in this README.
5. If the dataset will appear in the UI, add a "Try example" entry in `ui/src/lib/exampleDatasets.ts`.
6. If the dataset is paper-cited, add a row to `docs/active/PAPER_METHODS_REFERENCE.md` §2.

---

## License + redistribution

These datasets aggregate publicly-available peptide sequences from UniProt, AmyPro, and the published literature. Redistribution follows the source databases' terms (UniProt CC-BY 4.0; AmyPro: see project page). The PVL repo's MIT license applies to the schema and the curation work; the underlying sequences are not novel.

For paper citation: cite this repository (Zenodo DOI in `CITATION.cff`) AND the original sources of each peptide (UniProt accession, AmyPro entry, or PubMed ID listed per-peptide).
