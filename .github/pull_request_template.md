<!-- Edit the placeholders below. Delete sections that don't apply. -->

## Summary
<!-- One sentence: what does this PR do? -->

## Why
<!-- The user-facing or scientific outcome this unblocks. -->

## Scientific impact
<!-- If this touches predict / normalize / classification logic, describe the
     impact in plain English. If it doesn't, write "none". -->

- [ ] No change to scientific outputs
- [ ] Changes scientific outputs — Peleg sign-off recorded in `DECISIONS.md`
- [ ] Adds a new ADR — link: ...

## Invariants checked
<!-- The architectural rules from CLAUDE.md / HANDOFF.md §5 that this PR
     might brush against. Tick each one you actively verified. -->

- [ ] Single sequence and batch return identical results for the same peptide
- [ ] `backend/schemas/api_models.py` unchanged (or change explicitly approved)
- [ ] JSON `null` only for missing values (no `-1` / `"N/A"` / `""`)
- [ ] Same input + same config → same output (deterministic)
- [ ] FF-Helix ⊆ Helix and FF-SSW ⊆ SSW axioms preserved
- [ ] Entry IDs aligned between input and output

## Test plan
<!-- Manual + automated. The automated steps run in CI; the manual steps
     should be run by the reviewer. -->

- [ ] `make ci` green
- [ ] `npx tsc --noEmit` clean
- [ ] Manual browser walk-through: ...

## Screenshots
<!-- For UI changes: before / after. -->

## Links
<!-- Linked Issue(s), spec doc, paper / meeting note that motivated this. -->
- Closes #
- Related: #
