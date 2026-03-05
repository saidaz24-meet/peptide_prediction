---
description: Review staged/changed code against PVL safety rules, API contracts, and code quality standards. Use before committing or creating a PR.
---

# PVL Code Review

Review all staged and unstaged changes against our project rules.

## Step 1: Gather changes
Run `git diff` (unstaged) and `git diff --cached` (staged) to see all changes. Also run `git status` to see untracked files.

## Step 2: Safety checks (BLOCKING)
For each changed file, verify:

### API Contract
- [ ] `backend/schemas/api_models.py` NOT modified (unless explicitly approved)
- [ ] API endpoint signatures in `backend/api/routes/` NOT changed
- [ ] Response keys remain camelCase
- [ ] Entry IDs still align between input and output

### Null Semantics
- [ ] No new uses of `-1`, `"N/A"`, or `""` as sentinel values
- [ ] `None`/`null` used for missing data
- [ ] Frontend uses `??` not `||` for numeric fallbacks

### Single/Batch Consistency
- [ ] Changes to pipeline functions don't break single-vs-batch equivalence
- [ ] If predict_service.py changed, check upload_service.py uses same logic

### FF Data Integration
- [ ] If UI component touched: does it show FF data where appropriate?
- [ ] If new data field added: is it in both single and batch responses?

## Step 3: Code quality checks
- [ ] No `console.log` left in frontend code
- [ ] No `print()` debug statements in backend (use `log_info/warning/error`)
- [ ] Type hints present on new Python functions
- [ ] TypeScript types explicit (no `any` unless justified)
- [ ] No hardcoded paths or secrets

## Step 4: Test coverage
- [ ] New backend logic has corresponding test
- [ ] Existing tests still pass: suggest `make test` if unsure
- [ ] Edge cases considered (empty sequence, single peptide, null values)

## Step 5: Report
Present findings as:
- **BLOCKING**: Must fix before commit (safety violations)
- **WARNING**: Should fix (quality issues)
- **INFO**: Suggestions for improvement

If everything passes, say "All checks passed. Safe to commit."
