# UniProt Search Enrichment — Comprehensive Spec

**Created**: 2026-03-25
**Requested by**: Alex (DESY)
**Priority**: HIGH — directly impacts researcher trust and usability
**Status**: PLANNED (not yet implemented)

---

## Problems Identified

### P1: Low Result Counts vs UniProt Direct Search
**Observed**: Searching "viral" returns 106 entries in PVL vs 23,000+ on uniprot.org.

**Root causes**:
1. **Default `reviewed: true`** — We only search Swiss-Prot (reviewed, ~570K entries). UniProt.org searches all of UniProtKB (~250M entries including TrEMBL). This is the biggest factor.
2. **Backend size cap at 500** — `min(max(size, 1), 500)` in `uniprot_execute_service.py`. Frontend slider goes to 10,000 but backend silently clamps to 500. This is misleading.
3. **`keyword:` field search** — We use `keyword:viral` which searches UniProt's curated keyword ontology, not full-text. UniProt.org's search bar does full-text by default, matching protein names, descriptions, comments, etc. `keyword:viral` only matches entries tagged with the controlled vocabulary term "Viral" — a much smaller set.

**Impact**: Researchers expect UniProt-like result counts. Getting 106 when they know there are thousands erodes trust.

### P2: No Search Context / Transparency
**Observed**: After search, user sees a table of results with no explanation of what was searched or why results look the way they do.

**What's missing**:
- "Found 204 reviewed entries matching keyword 'amyloid' in UniProtKB (Swiss-Prot)"
- Explanation of filters applied (reviewed only, length range, etc.)
- Link to equivalent search on uniprot.org
- Warning when results are capped ("Showing 500 of 12,345 matching entries")

### P3: Minimal Protein Metadata
**Observed**: PeptideDetail page shows only accession, organism, and sequence. No protein function, gene name, or other biological context.

**Currently fetched from UniProt API** (7 fields):
```
accession, id, protein_name, organism_name, organism_id, sequence, length
```

**Not fetched but valuable for researchers**:
```
gene_names          — Gene name(s)
cc_function         — Protein function (free text, most important missing field)
cc_subcellular_location — Where in the cell
keyword             — UniProt controlled vocabulary keywords
ft_domain           — Domain annotations
ft_region           — Region annotations
cc_disease          — Disease associations
annotation_score    — UniProt annotation quality (1-5 stars)
reviewed            — Swiss-Prot vs TrEMBL status
```

---

## Proposed Solutions

### S1: Fix Result Count Discrepancy

#### S1a: Use full-text search instead of `keyword:` field (HIGH PRIORITY)
**Current**: `keyword:amyloid` (searches curated keyword ontology only)
**Proposed**: Use `amyloid` as bare query (full-text search, matches protein name, function, comments, keywords)
**Fallback**: Keep `keyword:` as an explicit option in advanced mode

**Implementation**:
- File: `backend/services/uniprot_parser.py`, function `build_uniprot_export_url()`
- Change: For keyword mode, use the raw term as the query instead of wrapping in `keyword:`
- Option: Add a "Search in" dropdown: "All fields" (default), "Keywords only", "Protein name only", "Gene name"
- The UniProt REST API supports: bare text (full-text), `keyword:` (ontology), `protein_name:` (name field), `gene:` (gene name)

**UniProt query field reference**:
| PVL Option | UniProt Query | Scope |
|-----------|---------------|-------|
| All fields (default) | `amyloid` | Full-text: names, functions, comments, keywords, everything |
| Keywords only | `keyword:amyloid` | Curated keyword ontology only |
| Protein name | `protein_name:amyloid` | Protein name/description field |
| Gene name | `gene:amyloid` | Gene name field |

#### S1b: Raise or remove the 500 result cap
**Current**: Backend clamps to 500 regardless of frontend slider value.
**Proposed**:
- Raise cap to 2000 for metadata-only fetches (no TANGO/S4PRED)
- Keep 500 cap when running predictions (TANGO/S4PRED are slow)
- Show actual UniProt total in response metadata (UniProt returns `X-Total-Results` header)
- Display: "Showing 500 of 12,345 results. Increase max results to see more."

**Implementation**:
- File: `backend/services/uniprot_execute_service.py`
- Parse `X-Total-Results` response header from UniProt
- Return `total_available` in response meta alongside `size_returned`
- Conditionally allow higher `size` when predictions are off

#### S1c: Make reviewed/unreviewed filter more visible
**Current**: Defaults to reviewed (Swiss-Prot) only. User may not notice.
**Proposed**:
- Show the filter prominently: "Searching: Swiss-Prot (reviewed) only"
- Add a banner when results are few: "Only 106 reviewed entries found. Search all of UniProtKB (including unreviewed) for more results? [Search All]"
- Consider defaulting to "Both" for keyword searches

---

### S2: Search Context & Transparency

#### S2a: Post-search summary banner (HIGH PRIORITY)
Display a contextual banner above results after every UniProt search:

```
Found 204 entries matching "amyloid" in UniProtKB (Swiss-Prot, reviewed only)
Filters: Length 5-50 aa | Sorted by: Best match
[View on UniProt] [Modify search]
```

**Variants**:
```
# When results are capped:
Showing 500 of 12,345 entries matching "viral" in UniProtKB
Filters: All (reviewed + unreviewed) | Length: any
[Load more] [View on UniProt]

# When few results:
Found 3 entries matching "P12345" (accession lookup)
[View on UniProt]

# When no results:
No entries found for "xyzabc123" in UniProtKB (Swiss-Prot).
Try: [Search all UniProtKB] [Check spelling] [Use UniProt directly]
```

**Implementation**:
- Backend already returns `meta.api_query_string`, `meta.mode`, `meta.url`, `meta.row_count`
- Add `meta.total_available` (from UniProt `X-Total-Results` header)
- Add `meta.filters_applied` summary object
- Frontend: New `<UniProtSearchSummary>` component above results table

#### S2b: "View on UniProt" link
Convert our API query to a uniprot.org URL and show as a link.
```
https://www.uniprot.org/uniprotkb?query=keyword:amyloid+AND+reviewed:true+AND+length:[5+TO+50]
```

**Implementation**: Simple URL construction from `meta.api_query_string` in frontend.

---

### S3: Enrich Protein Metadata

#### S3a: Fetch additional fields from UniProt API (HIGH PRIORITY)
**Add to TSV request** (in `uniprot_parser.py`):
```python
# Current fields:
FIELDS = "accession,id,protein_name,organism_name,organism_id,sequence,length"

# Proposed fields:
FIELDS = "accession,id,protein_name,gene_names,organism_name,organism_id,sequence,length,cc_function,annotation_score"
```

New fields:
| Field | UniProt API name | Use in PVL | Size impact |
|-------|-----------------|------------|-------------|
| Gene name(s) | `gene_names` | Show in results table + detail page | Tiny |
| Function | `cc_function` | Show on PeptideDetail page | Medium (free text) |
| Annotation score | `annotation_score` | Quality indicator (1-5 stars) | Tiny |

**Optional (Phase 2)**:
| Field | UniProt API name | Use |
|-------|-----------------|-----|
| Keywords | `keyword` | Tags/badges on detail page |
| Subcellular location | `cc_subcellular_location` | Detail page |
| Disease association | `cc_disease` | Detail page |
| Domain annotations | `ft_domain` | Overlay on sequence track |

#### S3b: Display enriched data on PeptideDetail page
**Current**: Shows accession, organism, sequence, length.
**Proposed** (below the sequence box):

```
Peptide P02743
Serum amyloid P-component                    [View on UniProt]
Gene: APCS | Organism: Homo sapiens (Human)
Annotation score: 5/5

Function:
Can interact with DNA and histones and may scavenge nuclear material
released from damaged circulating cells. May also function as a
calcium-dependent lectin...

[Sequence box]
[Analysis results...]
```

#### S3c: Update API contract
- Add optional fields to `PeptideRow` in `api_models.py`:
  - `geneName: Optional[str]`
  - `proteinFunction: Optional[str]`
  - `annotationScore: Optional[int]`
- These are `null` for CSV uploads (only populated from UniProt)
- Frontend `Peptide` type in `types/peptide.ts` gets matching optional fields

---

## Implementation Plan

### Phase 1: Quick Wins (4-6h) — Do Soon
| Task | Files | Effort |
|------|-------|--------|
| Switch keyword search to full-text (bare query) | `uniprot_parser.py` | 1h |
| Parse + return `X-Total-Results` from UniProt | `uniprot_execute_service.py` | 1h |
| Add search summary banner component | New `UniProtSearchSummary.tsx` | 2h |
| Add "View on UniProt" link | Frontend component | 30min |
| Fix frontend slider vs backend cap mismatch | Both | 30min |

### Phase 2: Metadata Enrichment (6-8h) — Next Priority
| Task | Files | Effort |
|------|-------|--------|
| Add `gene_names`, `cc_function`, `annotation_score` to UniProt fetch | `uniprot_parser.py` | 1h |
| Update `api_models.py` with new optional fields | `api_models.py` (protected!) | 1h |
| Update `peptideMapper.ts` + `types/peptide.ts` | Frontend types | 1h |
| Display gene name + function on PeptideDetail | `PeptideDetail.tsx` | 2h |
| Show gene name column in results table | `Results.tsx` | 1h |
| Add annotation score badge | Frontend component | 1h |

### Phase 3: Advanced Search (8-12h) — Later
| Task | Files | Effort |
|------|-------|--------|
| "Search in" field selector (all/keyword/name/gene) | Frontend + parser | 3h |
| Raise result cap to 2000 for metadata-only | Backend | 2h |
| Smart suggestions when few results found | Frontend | 2h |
| Paginated results / "Load more" | Backend + frontend | 4h |

---

## Key Decisions Needed

1. **Default search scope**: Should keyword searches use full-text (more results) or `keyword:` field (more precise)? **Recommendation**: Full-text default, with option to narrow.

2. **Default reviewed filter**: Keep Swiss-Prot only (current) or switch to "Both"? **Recommendation**: Keep Swiss-Prot default but show prominent toggle + suggestion when results are few.

3. **API contract change for metadata fields**: Adding optional fields to `PeptideRow` is a contract change (protected file). **Recommendation**: Approve — optional fields don't break existing consumers.

4. **Result cap**: 500 → 2000 for metadata-only? **Recommendation**: Yes, but only when TANGO/S4PRED are off. Running predictions on 2000 sequences would take hours.

---

## Why "viral" Returns 106 vs 23,000

Detailed breakdown:

| Factor | Our Query | UniProt.org | Difference |
|--------|----------|-------------|------------|
| Search field | `keyword:viral` (ontology only) | Full-text (all fields) | ~10-50x fewer results |
| Database | Swiss-Prot only (reviewed) | All UniProtKB | ~400x fewer entries |
| Length filter | May have min/max set | None | Variable |
| Result cap | Max 500 | No cap (paginated) | Caps high-count searches |

If we switch to full-text + both databases: `viral AND length:[10 TO 50]` → ~23,000+ results (showing first 500-2000).

---

## References

- UniProt REST API docs: https://www.uniprot.org/help/api_queries
- UniProt query fields: https://www.uniprot.org/help/query-fields
- UniProt return fields: https://www.uniprot.org/help/return_fields
- Current implementation: `backend/services/uniprot_parser.py`, `backend/services/uniprot_execute_service.py`
