# UniProt Integration — Full Feature Spec

**Created**: 2026-03-25
**Requested by**: Alex (DESY)
**Priority**: HIGH — "one of the most useful features" (Alex)
**Status**: PLANNED — phased implementation
**Last Updated**: 2026-03-25

---

## Vision

UniProt search should be a **first-class feature** in PVL, not a secondary input method buried in the Upload page. Researchers should be able to:

1. Search UniProt directly from a dedicated tab in the sidebar
2. Browse results with rich metadata (protein name, function, gene, organism)
3. Understand exactly what was searched and why results look the way they do
4. Select entries of interest, then trigger PVL analysis on the selection
5. Seamlessly move between UniProt context and PVL predictions

**Competitive advantage**: No competing peptide tool (PASTA 2.0, Waltz, AGGRESCAN, CamSol) offers integrated UniProt search with analysis. They all require pre-downloading sequences. PVL is the only tool where you can go from "I'm curious about amyloid proteins" to "here are aggregation predictions with interactive charts" in one workflow.

---

## Current State

### What Works
- Keyword, accession, and organism search against UniProt REST API
- Reviewed/unreviewed filter, length range, sort order
- Auto-detection of query type (accession vs keyword vs organism ID)
- Live query parsing preview
- Results flow directly into PVL analysis pipeline
- AlphaFold integration on PeptideDetail page

### What's Wrong

| Problem | Impact | Root Cause |
|---------|--------|------------|
| **P1: Low result counts** | Researchers distrust the tool when "viral" returns 106 vs 23K on uniprot.org | `keyword:` field search (ontology only, not full-text) + Swiss-Prot default + 500 cap |
| **P2: No search context** | Users don't know what was searched or why counts differ | No post-search summary, no filter explanation, no link to UniProt |
| **P3: Missing metadata** | Detail page shows only accession + organism + sequence | Only 7 fields fetched; no function, gene name, keywords |
| **P4: Buried in Upload page** | Users may not discover it; feels like secondary feature | UniProt search is a tab inside Upload, not its own route |
| **P5: No select-then-analyze** | All results go through analysis; can't browse first | No preview mode; every search triggers full pipeline |

---

## Architecture

### Current Flow
```
Upload page → "UniProt Search" tab → type query → Search button
  → Backend fetches from UniProt API (TSV, 7 fields)
  → Backend runs FF-Helix + biochem on ALL results
  → Backend optionally runs TANGO/S4PRED on first 50
  → Results appear in Results page (same as CSV upload)
```

### Proposed Flow
```
Sidebar: "Database Search" tab (new dedicated route /search)
  → Search form with query + filters
  → Backend fetches from UniProt API (TSV, 10+ fields)
  → Phase 1: BROWSE MODE — lightweight table with metadata
    → User sees: accession, protein name, gene, organism, function, length, annotation score
    → User can sort, filter, select entries
    → "View on UniProt" link per-entry and for full query
    → Search summary banner: "Found 204 of 12,345 reviewed entries matching 'amyloid'"
  → Phase 2: ANALYZE MODE — user selects entries, clicks "Analyze Selected"
    → Selected entries go through PVL pipeline (FF-Helix, biochem, TANGO, S4PRED)
    → Results appear in Results page with full predictions
```

### Data Flow Diagram
```
[User Query]
     |
     v
[UniProt REST API] ──→ TSV response (10+ fields)
     |                      |
     v                      v
[Parse TSV]           [X-Total-Results header]
     |                      |
     v                      v
[Browse Table]        [Search Summary Banner]
  (lightweight,         "Showing 500 of 12,345"
   no predictions)       [View on UniProt]
     |
     | (user selects entries)
     v
[Analyze Selected]
     |
     v
[PVL Pipeline: FF-Helix + biochem + TANGO + S4PRED]
     |
     v
[Results Page] (full analysis dashboard)
```

---

## Problems & Solutions — Detailed

### P1: Low Result Counts

#### Why "viral" returns 106 in PVL vs 23,000+ on uniprot.org

| Factor | PVL (current) | UniProt.org | Multiplier |
|--------|--------------|-------------|------------|
| Search scope | `keyword:viral` (curated ontology) | Full-text (all fields) | 10-50x fewer |
| Database | Swiss-Prot only (~570K entries) | All UniProtKB (~250M) | ~400x fewer |
| Result cap | 500 max (backend) | Paginated, no cap | Caps large result sets |
| Length filter | May be active | Not applied | Variable |

**Combined effect**: These factors compound. `keyword:viral` in Swiss-Prot only = ~106. Full-text `viral` in all UniProtKB = ~23,000+.

#### Solution S1: Search Query Reform

**S1a: Default to full-text search**

Current code in `uniprot_parser.py`:
```python
# Current: wraps in keyword: field
api_query = f"keyword:{term}"

# Proposed: use bare term for full-text
api_query = term  # UniProt full-text search
```

The UniProt REST API interprets bare terms as full-text search across all fields (protein name, function, gene, comments, keywords, etc.). This matches uniprot.org behavior.

Add a "Search in" selector for power users:

| Option | UniProt Query | When to Use |
|--------|--------------|-------------|
| **All fields** (default) | `amyloid` | General exploration |
| Keywords (ontology) | `keyword:amyloid` | Precise, curated terms |
| Protein name | `protein_name:amyloid` | Name-specific search |
| Gene name | `gene:amyloid` | Gene-specific search |
| Function | `cc_function:amyloid` | Function-specific search |

**Files**: `backend/services/uniprot_parser.py` (query builder), `ui/src/components/UniProtQueryInput.tsx` (dropdown)

**S1b: Return total available count**

UniProt returns an `X-Total-Results` response header. We currently ignore it.

```python
# In uniprot_execute_service.py, after httpx.get():
total_available = int(response.headers.get("X-Total-Results", 0))
# Add to response meta:
meta["total_available"] = total_available
```

Frontend displays: "Showing 500 of 12,345 matching entries"

**S1c: Fix result cap mismatch**

Frontend slider goes to 10,000. Backend clamps to 500. This is misleading.

Options:
1. **Browse mode (no predictions)**: Allow up to 2,000 results — just metadata, no TANGO/S4PRED
2. **Analyze mode (with predictions)**: Keep 500 cap when predictions run, 50 for TANGO/S4PRED
3. **Frontend**: Match slider max to actual backend limit, or show clear warning

**S1d: Make reviewed filter visible and smart**

- Show active filter prominently: "Searching Swiss-Prot (reviewed) only"
- When results < 50: suggest "Only 42 reviewed entries found. [Search all UniProtKB] for more?"
- Default to "Reviewed" (Swiss-Prot) — these are higher quality and what researchers usually want
- But make it one click to switch

---

### P2: Search Context & Transparency

#### Solution S2: Search Summary System

**S2a: Post-search summary banner**

A contextual banner displayed above results after every UniProt search. Adapts to the situation:

```
NORMAL:
  "Found 204 reviewed entries matching 'amyloid' in UniProtKB (Swiss-Prot)"
  "Filters: Length 5-50 aa | Sorted by: Best match"
  [View on UniProt] [Modify Search]

CAPPED:
  "Showing 500 of 12,345 entries matching 'viral' in UniProtKB"
  "Increase max results or narrow your search to see more"
  [View all on UniProt]

FEW RESULTS:
  "Only 12 reviewed entries match 'mySpecificProtein'"
  [Search all UniProtKB (including unreviewed)] [View on UniProt]

NO RESULTS:
  "No entries found for 'xyzabc123' in UniProtKB (Swiss-Prot)"
  [Search all UniProtKB] [Check spelling] [Try on UniProt directly]

ACCESSION:
  "Found entry P02743 — Serum amyloid P-component (Homo sapiens)"
  [View on UniProt]
```

**S2b: "View on UniProt" link construction**

Convert our internal query to a uniprot.org URL:
```
https://www.uniprot.org/uniprotkb?query={api_query_string}
```

Show this:
- In the search summary banner (for the full query)
- Next to each entry in the results table (per-entry links — already done via accession cross-link)

**S2c: Query explanation tooltip**

On hover/click, show what the search actually did:
```
Your search: "amyloid"
Interpreted as: Full-text search
API query: amyloid AND reviewed:true AND length:[5 TO 50]
Database: UniProtKB / Swiss-Prot
Results: 204 of 12,345 total
```

This is partially implemented — `finalApiQuery` state exists in `UniProtQueryInput.tsx` but isn't shown prominently post-search.

---

### P3: Missing Protein Metadata

#### Solution S3: Enriched UniProt Fields

**S3a: Expand fetched fields**

Current (7 fields):
```
accession, id, protein_name, organism_name, organism_id, sequence, length
```

Proposed Phase 1 (10 fields — add 3):
```
+ gene_names          — Gene name(s), e.g., "APCS"
+ cc_function         — Function description (free text)
+ annotation_score    — Quality indicator (1-5)
```

Proposed Phase 2 (14 fields — add 4 more):
```
+ keyword             — UniProt controlled vocabulary tags
+ cc_subcellular_location — Cellular location
+ cc_disease          — Disease associations
+ ft_domain           — Domain annotations
```

**File**: `backend/services/uniprot_parser.py`, constant `UNIPROT_FIELDS` (or wherever fields string is built)

**S3b: API contract changes**

Add optional fields to `PeptideRow` in `api_models.py` (**requires approval — protected file**):

```python
# New optional fields (null for CSV uploads, populated from UniProt)
geneName: Optional[str] = Field(None, description="Gene name from UniProt")
proteinFunction: Optional[str] = Field(None, description="Protein function from UniProt")
annotationScore: Optional[int] = Field(None, description="UniProt annotation score 1-5")
uniprotKeywords: Optional[List[str]] = Field(None, description="UniProt keyword tags")
subcellularLocation: Optional[str] = Field(None, description="Subcellular location")
diseaseAssociation: Optional[str] = Field(None, description="Disease associations")
```

These are all **optional** (default `None`), so existing CSV upload responses are unaffected. Only UniProt-sourced entries populate these fields.

**Frontend type changes** (`types/peptide.ts`):
```typescript
// New optional fields
geneName?: string | null;
proteinFunction?: string | null;
annotationScore?: number | null;
uniprotKeywords?: string[] | null;
subcellularLocation?: string | null;
diseaseAssociation?: string | null;
```

**S3c: Display enriched metadata on PeptideDetail page**

Current layout:
```
Peptide P02743
Organism: Homo sapiens (Human)

[Sequence box]
```

Proposed layout:
```
Peptide P02743 — Serum amyloid P-component          [View on UniProt]
Gene: APCS | Organism: Homo sapiens (Human)
Annotation: 5/5 stars

Function
Can interact with DNA and histones and may scavenge nuclear material
released from damaged circulating cells. May also function as a
calcium-dependent lectin...

Keywords: Amyloid, Lectin, Secreted, Signal
Location: Secreted, extracellular space

[Sequence box]
[KPI tiles]
[Analysis charts...]
```

**S3d: Enriched results table**

Add columns to the results table (Results.tsx) for UniProt-sourced data:

| Column | Source | Always visible? |
|--------|--------|----------------|
| Entry (accession) | Current | Yes |
| Protein Name | Current | Yes |
| Gene | New (S3a) | Yes |
| Organism | Current | Yes |
| Length | Current | Yes |
| Score | New (annotation_score) | Toggle |
| Function | New (cc_function) | Hover tooltip (too long for column) |

---

### P4: UniProt Search Deserves Its Own Tab

#### Solution S4: Dedicated Database Search Page

**Current**: UniProt search is a tab inside `/upload` — feels like a secondary input method.

**Proposed**: New route `/search` with its own sidebar entry "Database Search" (icon: `Database` from lucide-react).

**Sidebar order**:
```
Home
Upload              (CSV/Excel file upload)
Database Search     (NEW — UniProt query, browse, select, analyze)
Quick Analyze       (single sequence)
Results
Compare
Help
About
```

**Page layout** (`/search`):
```
+------------------------------------------------------------------+
|  Database Search                                                   |
+------------------------------------------------------------------+
|                                                                    |
|  [Search bar: "amyloid"]                    [Search]              |
|                                                                    |
|  Filters:  [Reviewed ▾]  [Length: 5-50]  [Sort: Best match ▾]    |
|            [Search in: All fields ▾]  [Max results: 500]          |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  Found 204 of 12,345 reviewed entries matching "amyloid"          |
|  [View on UniProt]                                                 |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  | [ ] | Entry  | Protein Name              | Gene | Organism   | |
|  |-----|--------|---------------------------|------|------------| |
|  | [x] | P02743 | Serum amyloid P-component | APCS | Human      | |
|  | [x] | P05067 | Amyloid-beta precursor    | APP  | Human      | |
|  | [ ] | P10636 | Microtubule-associated tau | MAPT | Human      | |
|  | ... |        |                           |      |            | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  Selected: 2 entries                                               |
|  [Analyze Selected]  [Select All]  [Export CSV]                   |
|                                                                    |
+------------------------------------------------------------------+
```

**Key behaviors**:
- Search results are **browse-only** (no predictions yet) — fast, lightweight
- User selects entries of interest via checkboxes
- "Analyze Selected" sends selected entries through PVL pipeline
- After analysis, redirects to Results page with full predictions
- "Select All" + "Analyze" for quick bulk analysis (current behavior)
- Clicking a row expands to show function, keywords, location (accordion)

**Interaction with Phase D (UI/UX Redesign)**:
This new page should be designed alongside the Phase D redesign. The component structure, card patterns, and progressive disclosure should follow the same design language being established in D2 (card-based disclosure) and D3 (per-residue viewer).

---

### P5: Browse First, Analyze Later

#### Solution S5: Two-Phase Workflow

**Phase 1 — Browse (fast, metadata only)**:
- Backend fetches TSV from UniProt with enriched fields
- Returns protein metadata WITHOUT running TANGO/S4PRED/FF-Helix
- Frontend shows browsable table with rich metadata
- Response time: ~1-3 seconds regardless of result count

**Phase 2 — Analyze (user-triggered, selected entries only)**:
- User selects entries from browse results
- Clicks "Analyze Selected" (or "Analyze All")
- Backend runs full PVL pipeline on selected entries only
- Progress bar shows TANGO/S4PRED progress
- Results appear in Results page

**Backend changes**:
- New parameter: `analyze: bool = False` in UniProt execute request
- When `analyze=False`: return metadata only (no predictions) — fast
- When `analyze=True`: run full pipeline on provided sequences

**API flow**:
```
# Step 1: Browse
POST /api/uniprot/execute
{ query: "amyloid", reviewed: true, size: 500, analyze: false }
→ Returns: rows with metadata only (no predictions), meta with total_available

# Step 2: Analyze selected
POST /api/uniprot/analyze
{ accessions: ["P02743", "P05067"], run_tango: true, run_s4pred: true }
→ Returns: full PVL analysis results for selected entries
```

**Why this matters**:
- Current flow runs predictions on ALL results (slow, wasteful)
- Researchers often want to browse first, then analyze specific proteins
- Matches how scientists actually work: search → scan → select → deep dive

---

## UniProt REST API Reference

### Query Syntax

| Query Type | Syntax | Example |
|-----------|--------|---------|
| Full-text | `term` | `amyloid` |
| Field-specific | `field:term` | `keyword:amyloid` |
| Boolean | `term1 AND term2` | `amyloid AND organism_id:9606` |
| Range | `field:[min TO max]` | `length:[10 TO 50]` |
| Negation | `NOT term` | `NOT organism_id:9606` |
| Exact phrase | `"exact phrase"` | `"amyloid beta"` |

### Searchable Fields (most useful for PVL)

| Field | API Name | Example | Description |
|-------|----------|---------|-------------|
| All fields | _(bare term)_ | `amyloid` | Full-text across everything |
| Keyword | `keyword` | `keyword:amyloid` | Curated UniProt keyword ontology |
| Protein name | `protein_name` | `protein_name:amyloid` | Protein description field |
| Gene name | `gene` | `gene:APP` | Gene name |
| Organism | `organism_name` | `organism_name:human` | Organism common/scientific name |
| Organism ID | `organism_id` | `organism_id:9606` | NCBI taxonomy ID |
| Reviewed | `reviewed` | `reviewed:true` | Swiss-Prot (true) vs TrEMBL (false) |
| Length | `length` | `length:[10 TO 50]` | Sequence length range |
| Accession | `accession` | `accession:P02743` | UniProt accession |
| Function | `cc_function` | `cc_function:amyloid` | Function comment text |
| Subcellular location | `cc_subcellular_location` | `cc_subcellular_location:membrane` | Location |
| Disease | `cc_disease` | `cc_disease:alzheimer` | Disease associations |
| EC number | `ec` | `ec:3.4.21.*` | Enzyme classification |
| Taxonomy | `taxonomy_id` | `taxonomy_id:40674` | Mammalia and below |
| Existence | `existence` | `existence:1` | 1=protein level, 2=transcript, etc. |

### Return Fields (columns in TSV/JSON response)

| Field | API Name | Type | Size Impact | Priority |
|-------|----------|------|-------------|----------|
| Accession | `accession` | string | Tiny | Current |
| Entry Name | `id` | string | Tiny | Current |
| Protein Name | `protein_name` | string | Small | Current |
| Gene Names | `gene_names` | string | Tiny | Phase 1 |
| Organism | `organism_name` | string | Small | Current |
| Organism ID | `organism_id` | int | Tiny | Current |
| Sequence | `sequence` | string | Large | Current |
| Length | `length` | int | Tiny | Current |
| Function | `cc_function` | text | Medium | Phase 1 |
| Annotation Score | `annotation_score` | int (1-5) | Tiny | Phase 1 |
| Keywords | `keyword` | list | Small | Phase 2 |
| Subcellular Location | `cc_subcellular_location` | text | Small | Phase 2 |
| Disease | `cc_disease` | text | Small | Phase 2 |
| Domain | `ft_domain` | structured | Medium | Phase 2 |
| Signal Peptide | `ft_signal` | structured | Small | Phase 3 |
| Transmembrane | `ft_transmem` | structured | Small | Phase 3 |
| Modified Residues | `ft_mod_res` | structured | Medium | Phase 3 |
| Cross-references | `xref_pdb` | list | Small | Phase 3 |
| Date Modified | `date_modified` | date | Tiny | Phase 3 |

### Response Headers

| Header | Value | Use |
|--------|-------|-----|
| `X-Total-Results` | int | Total matching entries (before `size` limit) |
| `Link` | URL | Pagination: next page URL |

---

## Implementation Roadmap

### Step 1: Search Fix (3-4h) — Immediate

Fix the most embarrassing issue: result count discrepancy.

| Task | File(s) | Effort | Details |
|------|---------|--------|---------|
| 1.1 Switch keyword to full-text | `backend/services/uniprot_parser.py` | 1h | Change `keyword:{term}` to bare `{term}` for default mode |
| 1.2 Parse X-Total-Results header | `backend/services/uniprot_execute_service.py` | 30min | Extract from response headers, add to meta |
| 1.3 Fix slider/cap mismatch | Backend + frontend | 30min | Align frontend slider max with actual backend cap |
| 1.4 Add search summary banner | `ui/src/components/UniProtSearchSummary.tsx` (new) | 1.5h | Show what was searched, total available, active filters |
| 1.5 Add "View on UniProt" link | Frontend (in summary banner) | 30min | Construct uniprot.org URL from api_query_string |

**Verification**: Search "viral" → should return ~500 results (capped) with banner saying "Showing 500 of ~X total"

### Step 2: Metadata Enrichment (5-6h) — Next

Add biological context to UniProt results.

| Task | File(s) | Effort | Details |
|------|---------|--------|---------|
| 2.1 Add gene_names, cc_function, annotation_score to UniProt fetch | `backend/services/uniprot_parser.py` | 1h | Add to FIELDS constant |
| 2.2 Parse new fields from TSV response | `backend/services/uniprot_execute_service.py` | 1h | Map new columns to DataFrame |
| 2.3 Update API contract (NEEDS APPROVAL) | `backend/schemas/api_models.py` | 30min | Add optional fields to PeptideRow |
| 2.4 Update frontend types | `ui/src/types/peptide.ts`, `peptideMapper.ts` | 30min | Add matching optional fields |
| 2.5 Show gene name in results table | `ui/src/pages/Results.tsx` | 1h | New column, only visible when data source is UniProt |
| 2.6 Show function + gene on PeptideDetail | `ui/src/pages/PeptideDetail.tsx` | 1.5h | New section below header, above sequence |

**Verification**: Search "amyloid" → click P02743 → should see gene name "APCS", function text, annotation score

### Step 3: Dedicated Search Page (8-10h) — Phase D Integration

Elevate UniProt to first-class feature with its own route.

| Task | File(s) | Effort | Details |
|------|---------|--------|---------|
| 3.1 Create `/search` route | `App.tsx`, new `pages/DatabaseSearch.tsx` | 2h | New page with search form |
| 3.2 Add sidebar entry | `components/AppSidebar.tsx` | 30min | "Database Search" with Database icon |
| 3.3 Extract UniProtQueryInput | Refactor existing component | 1h | Make reusable between Upload and Search pages |
| 3.4 Browse results table | New `components/SearchResultsTable.tsx` | 3h | Checkbox selection, expandable rows, metadata columns |
| 3.5 "Analyze Selected" flow | Frontend + backend | 2h | Send selected accessions for analysis |
| 3.6 Search summary integration | Use component from Step 1 | 30min | Place in new page layout |
| 3.7 Keep Upload page working | `pages/Upload.tsx` | 30min | UniProt tab still works (links to /search or stays embedded) |

**Design note**: This step should be planned alongside Phase D (UI/UX Redesign). The search page is a natural candidate for the card-based progressive disclosure pattern (D2).

### Step 4: Browse-then-Analyze (6-8h) — After Step 3

Two-phase workflow: browse metadata first, analyze selected entries.

| Task | File(s) | Effort | Details |
|------|---------|--------|---------|
| 4.1 Add `analyze` param to UniProt endpoint | Backend route + service | 1h | `analyze=false` skips predictions |
| 4.2 New `/api/uniprot/analyze` endpoint | Backend route + service | 2h | Accepts accession list, runs full pipeline |
| 4.3 Browse mode frontend | `DatabaseSearch.tsx` | 2h | Show metadata table, no prediction columns |
| 4.4 Selection + analyze flow | Frontend | 2h | Checkbox → "Analyze Selected" → progress → Results |
| 4.5 Caching browse results | Frontend (Zustand or React Query) | 1h | Don't re-fetch when toggling between browse and analyze |

### Step 5: Advanced Search (6-8h) — Later

Power-user features and polish.

| Task | File(s) | Effort | Details |
|------|---------|--------|---------|
| 5.1 "Search in" field selector | Frontend + backend | 2h | All fields / Keywords / Protein name / Gene / Function |
| 5.2 Raise result cap for browse mode | Backend | 1h | 2000 for browse, 500 for analyze |
| 5.3 Smart suggestions on few results | Frontend | 1.5h | "Try unreviewed?" / "Broaden search?" |
| 5.4 Result pagination / "Load more" | Backend + frontend | 2h | Use UniProt `Link` header for cursor-based pagination |
| 5.5 Save/bookmark searches | Frontend (localStorage) | 1h | Recent searches dropdown |
| 5.6 Batch accession input | Frontend | 1h | Paste list of accessions, one per line |

### Step 6: Deep Metadata (4-6h) — Phase 2+

Additional UniProt fields for specialized use cases.

| Task | File(s) | Effort | Details |
|------|---------|--------|---------|
| 6.1 Add keywords, subcellular location, disease | Backend + frontend | 2h | Phase 2 fields from table above |
| 6.2 Domain overlay on sequence track | Frontend | 2h | Show UniProt domain annotations on SequenceTrack component |
| 6.3 Signal peptide / transmembrane regions | Backend + frontend | 2h | Structural feature overlay |

---

## Key Decisions Required

### Decision 1: Default search scope
**Options**:
- A) Full-text (bare term) — matches uniprot.org behavior, more results
- B) `keyword:` field — current behavior, more precise but fewer results
**Recommendation**: A (full-text default). Add "Search in" dropdown for power users who want field-specific search.

### Decision 2: Default reviewed filter
**Options**:
- A) Swiss-Prot only (current) — higher quality, fewer results
- B) Both (Swiss-Prot + TrEMBL) — more results, includes unreviewed
- C) Smart default — Swiss-Prot for keyword, Both for accession
**Recommendation**: A (Swiss-Prot default) but with prominent toggle and smart suggestion when results are few.

### Decision 3: API contract for new metadata fields
Adding optional fields to `PeptideRow` is a contract change on a protected file (`api_models.py`).
**Recommendation**: Approve. Optional fields with `None` default don't break existing consumers. CSV uploads return `null` for these fields.

### Decision 4: Own page vs stays in Upload
**Options**:
- A) New `/search` route with sidebar entry (Alex's suggestion)
- B) Keep in Upload page but more prominent
**Recommendation**: A. This is one of PVL's differentiating features — it deserves first-class status.

### Decision 5: Browse-then-analyze vs current flow
**Options**:
- A) Browse first (lightweight), analyze on demand (new)
- B) Always analyze everything (current)
**Recommendation**: A. Reduces wait time, lets researchers explore before committing to analysis. But keep "Analyze All" as a quick option for users who know what they want.

---

## Relationship to Other Phases

| Phase | Relationship |
|-------|-------------|
| **Phase D (UI/UX Redesign)** | Search page should follow same design language. D2 (card-based disclosure) and D3 (per-residue viewer) patterns apply. Plan together. |
| **Phase B1 (Async Jobs)** | Browse-then-analyze pairs perfectly with async: "Analyze Selected" submits a job, user gets notified when done. |
| **Phase B6 (DuckDB Cache)** | Cache UniProt results locally. If user re-searches same query, serve from cache. Also cache analysis results per accession. |
| **Phase B10 (Chemical Mods)** | UniProt entries may have modified residues (ft_mod_res). Could auto-detect and flag modifications from UniProt annotations. |
| **Phase C1 (Proteome Precomp)** | Pre-analyzed proteomes are the ultimate version of this: instant results for all proteins in top organisms. |

---

## Files Reference

### Backend
| File | Current Role | Changes Needed |
|------|-------------|----------------|
| `backend/services/uniprot_parser.py` | Query parsing, URL building | S1a (full-text), S3a (fields), S5.1 (search-in) |
| `backend/services/uniprot_execute_service.py` | Query execution, pipeline | S1b (total count), S5 (browse mode) |
| `backend/api/routes/uniprot.py` | Route handlers | S5 (new analyze endpoint) |
| `backend/schemas/uniprot_query.py` | Request/response schemas | S5 (analyze param) |
| `backend/schemas/api_models.py` | **PROTECTED** — PeptideRow | S3b (new optional fields, needs approval) |

### Frontend
| File | Current Role | Changes Needed |
|------|-------------|----------------|
| `ui/src/components/UniProtQueryInput.tsx` | Search form | S1c (slider fix), S5.1 (search-in dropdown) |
| `ui/src/pages/Upload.tsx` | Hosts UniProt search | S4 (extract to /search, keep link) |
| `ui/src/pages/Results.tsx` | Results table | S3d (gene column) |
| `ui/src/pages/PeptideDetail.tsx` | Peptide deep-dive | S3c (function, gene, score) |
| `ui/src/types/peptide.ts` | Canonical types | S3b (new optional fields) |
| `ui/src/lib/peptideMapper.ts` | API → frontend mapping | S3b (map new fields) |
| `ui/src/components/AppSidebar.tsx` | Navigation | S4 (add "Database Search" entry) |
| `ui/src/App.tsx` | Routes | S4 (add /search route) |
| **NEW** `ui/src/pages/DatabaseSearch.tsx` | Dedicated search page | S4 (new page) |
| **NEW** `ui/src/components/UniProtSearchSummary.tsx` | Search context banner | S2a (summary) |
| **NEW** `ui/src/components/SearchResultsTable.tsx` | Browse results | S4 (selectable, expandable) |
