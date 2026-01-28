# Codebase Analysis Report

## Architecture Problems

| Problem | File(s) | Severity | Why it's a problem | Suggested fix |
|---------|---------|----------|-------------------|---------------|
| Duplicate biochemical calculation logic | `backend/server.py` (calc_biochem), `backend/main.py` (calculate_biochemical_features) | 2 | Code duplication increases maintenance burden and risk of inconsistencies | Extract to a shared module (e.g., `backend/calculations/biochem.py`) and import in both places |
| Unclear separation: batch script vs web API | `backend/main.py` vs `backend/server.py` | 2 | `main.py` appears to be a legacy batch processing script that duplicates server.py functionality. Unclear when to use which | Document `main.py` purpose clearly, or remove if unused. If needed, refactor to share core logic with server.py |
| Mixed responsibilities in server.py | `backend/server.py` | 2 | Server file contains API endpoints, business logic, data normalization, and file parsing all mixed together | Split into: `routes/`, `services/`, `utils/` structure. Move business logic to service modules |
| Duplicate response handling functions | `ui/src/lib/api.ts` (`handle` and `handleResponse`) | 1 | Two nearly identical functions doing the same thing creates confusion | Remove one (keep `handleResponse`), update all callers |
| Large catch-all utility file | `backend/auxiliary.py` (487 lines) | 1 | Contains filtering, sequence processing, FF-helix calculations, and more. Hard to maintain and test | Split into focused modules: `sequence_utils.py`, `filtering.py`, `ff_helix.py` |
| No clear service layer | Backend codebase | 2 | Business logic directly in routes makes testing and reuse difficult | Create `services/` directory with `biochem_service.py`, `prediction_service.py`, etc. |

## Duplicate / Messy Code

| Problem | File(s) | Severity | Why it's a problem | Suggested fix |
|---------|---------|----------|-------------------|---------------|
| Duplicate dotenv loading | `backend/server.py` lines 13-24 | 1 | Loads .env twice with redundant try/except blocks | Remove duplicate, keep single clean load_dotenv call |
| Repeated normalization code in endpoints | `backend/server.py` in `/api/upload-csv`, `/api/predict`, `/api/example` | 2 | Same normalization/sanitization logic repeated 3+ times | Extract to shared function `normalize_peptide_response(df)` or service method |
| Duplicate API function | `ui/src/lib/api.ts` (`predictOne` and `callPredict`) | 1 | Two functions doing the same thing with slightly different implementations | Remove `callPredict`, use `predictOne` everywhere (or vice versa) |
| Similar directory structure patterns | `backend/tango.py`, `backend/psipred.py` | 1 | Both have `_ensure_dirs()`, `_latest_run_dir()`, `_sanitize_seq()` with similar implementations | Extract common utilities to `backend/utils/file_ops.py` and `backend/utils/sequence.py` |
| Repeated FF-helix column finalization | `backend/server.py` in multiple endpoints | 2 | Same column setup code repeated: checking "FF-Helix %", creating fragments column, etc. | Extract to `_finalize_ff_columns(df)` helper function |
| Commented-out code blocks | `backend/jpred.py` lines 51-68 | 1 | Large blocks of commented code clutter the file | Remove if truly unused, or add a note explaining why it's kept |

## Bad Naming / Unclear Responsibilities

| Problem | File(s) | Severity | Why it's a problem | Suggested fix |
|---------|---------|----------|-------------------|---------------|
| Misleading filename | `backend/main.py` | 2 | Name suggests entry point, but appears to be batch processing script. Actual entry is `server.py` | Rename to `batch_process.py` or `offline_analysis.py` |
| Unclear function name | `backend/jpred.py` - `creat_jpred_input` (typo) | 1 | Function name has typo ("creat" vs "create") | Rename to `create_jpred_input` |
| Generic function names | `backend/server.py` - `ensure_cols`, `ensure_computed_cols`, `ensure_ff_cols` | 1 | Multiple "ensure" functions with unclear differences | Use more specific names: `ensure_required_columns`, `ensure_computed_biochem_columns`, `ensure_ff_helix_columns` |
| Magic string constants | `backend/server.py` - column names as strings throughout | 1 | Column names like "FF-Helix %", "SSW prediction" are repeated as magic strings | Define constants in `backend/constants/columns.py` |
| Vague variable names | Various files - `df`, `r`, `row`, `cur_database` | 1 | Single-letter or abbreviated names reduce readability | Use descriptive names: `peptide_df`, `peptide_row`, `current_database` |
| Unclear module purpose | `backend/Analysing_final_results.py` | 1 | Name suggests analysis but file seems incomplete (line 25 has syntax error) | Fix or remove if unused. If needed, rename to something like `statistical_analysis.py` |

## Security Issues

| Problem | File(s) | Severity | Why it's a problem | Suggested fix |
|---------|---------|----------|-------------------|---------------|
| No authentication/authorization | Entire backend | 3 | Any client can upload files, run predictions, access example data. No rate limiting or access control | Add API key auth for production, or at minimum document that this is internal-only. Consider rate limiting middleware |
| File upload size not limited | `backend/server.py` - `/api/upload-csv` | 2 | Large files could cause memory exhaustion or DoS | Add `max_file_size` check (e.g., 50MB) before processing. Use streaming for large files |
| User input in subprocess calls | `backend/tango.py`, `backend/psipred.py` | 3 | Entry IDs and sequences from user input are used in file paths and Docker commands without sufficient sanitization | Use `_safe_id()` more consistently, validate entry IDs against allowlist pattern, avoid shell=True in subprocess |
| CORS allows all methods/headers | `backend/server.py` lines 61-72 | 2 | In development this is fine, but should be restricted in production | Make CORS config environment-aware. Use allowlist for production origins |
| No input validation on sequences | `backend/server.py` - `/api/predict` | 2 | Sequence parameter accepted without length/sanity checks | Add validation: max length (e.g., 10000), valid amino acids only, reject suspicious patterns |
| Potential path traversal | `backend/server.py` - file operations | 2 | Filenames from uploads used directly without sanitization | Sanitize filenames, use secure temp directories, validate file extensions |
| Environment variable exposure | `.env` files | 2 | No `.env.example` to document required vars. Risk of committing secrets | Add `.env.example` with dummy values. Document required vars in README. Add .env to .gitignore (already done) |
| Docker commands with user input | `backend/psipred.py` line 96-114 | 3 | User-controlled entry IDs in Docker volume mounts and commands | Validate entry IDs more strictly, use parameterized commands, avoid string interpolation in Docker args |

## Performance / Scalability Issues

| Problem | File(s) | Severity | Why it's a problem | Suggested fix |
|---------|---------|----------|-------------------|---------------|
| DataFrame.iterrows() usage | Multiple files (`server.py`, `main.py`, `auxiliary.py`) | 2 | iterrows() is extremely slow for large datasets. Used extensively in calc_biochem and other functions | Use vectorized pandas operations or `.apply()` with vectorized functions |
| No pagination for results | `backend/server.py` - all endpoints | 2 | Large datasets are loaded entirely into memory and sent as single response | Add pagination parameters (page, limit) to endpoints, return chunks |
| Large file processing in memory | `backend/server.py` - `/api/upload-csv` | 2 | Entire file read into memory (`await file.read()`), then processed in memory | Use streaming/chunked processing for large files, or at minimum add file size check first |
| Synchronous file I/O in async endpoints | `backend/server.py` | 1 | pd.read_excel, file operations are blocking in async functions | Use `asyncio.to_thread()` or move heavy I/O to thread pool |
| No caching for expensive operations | `backend/server.py` - example dataset | 1 | Example dataset processed on every request if recalc=0 still does some work | Cache processed example dataset in memory or on disk |
| Repeated DataFrame operations | `backend/server.py` - multiple endpoints | 1 | Same DataFrame transformations repeated (normalize_cols, ensure_cols, etc.) | Cache intermediate results or create reusable DataFrame pipeline functions |
| No connection pooling mentioned | Backend setup | 1 | If using database in future, need connection pooling | Document database connection strategy when added |

## File / Folder Structure Issues

| Problem | File(s) | Severity | Why it's a problem | Suggested fix |
|---------|---------|----------|-------------------|---------------|
| Output directories in source tree | `backend/Tango/out/`, `backend/Psipred/out/`, `backend/Jpred/` | 2 | Runtime outputs mixed with source code. Creates clutter, risk of committing large files | Move to `data/` or `outputs/` directory at repo root, add to .gitignore |
| Unclear what's source vs data | Various `.xlsx`, `.txt` files in backend/ | 1 | Mixed source code, example data, and runtime outputs in same directories | Create clear structure: `backend/src/`, `backend/data/examples/`, `backend/data/outputs/` |
| Schemas in separate folder but small | `backend/schemas/peptide.py` | 1 | Only one schema file in dedicated folder seems over-engineered | Either move to `backend/models.py` or add more schemas to justify the folder |
| Frontend hooks folder only has 2 files | `ui/src/hooks/` | 1 | Two files might not justify a folder. Could be in `lib/` | Move to `lib/` or keep if planning to add more hooks |
| Inconsistent casing in file names | `backend/Analysing_final_results.py` (PascalCase) vs others (snake_case) | 1 | Inconsistent naming convention | Rename to `analysing_final_results.py` or `analysis_final_results.py` |
| Jpred vs Jpred directory naming | `backend/Jpred/` vs `backend/jpred.py` | 1 | Directory uses capital J, file uses lowercase. Inconsistent | Standardize: prefer lowercase `jpred/` for directory to match module name |
| No clear separation of concerns in ui/src | `ui/src/components/`, `ui/src/pages/`, `ui/src/lib/` | 1 | Structure is reasonable but could be clearer about shared vs feature-specific code | Document structure in README. Consider `features/` folder for feature-specific components |

## Additional Observations

### Positive Aspects
- Good use of TypeScript in frontend
- Pydantic schemas for data validation
- Feature flags for optional tools (TANGO, PSIPRED, JPRED)
- Comprehensive error handling in some areas (tango.py, psipred.py with timeouts)

### Minor Issues Not Requiring Immediate Action
- Some print statements instead of proper logging (consider using `logging` module)
- Inconsistent use of f-strings vs .format() (prefer f-strings)
- Some type hints missing (gradually add)
- Commented code in jpred.py should be cleaned up

---

**Summary:** The codebase shows signs of rapid development with AI assistance (as mentioned). Main concerns are security (no auth, input validation gaps), performance (iterrows, no pagination), and code organization (duplication, unclear structure). Focus on security first, then refactor duplicate code, then optimize performance bottlenecks.

