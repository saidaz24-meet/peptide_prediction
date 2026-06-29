# When to Ask Humans — The Escalation Tree

> Audience: an AI agent about to make a change. If your change matches any row below, STOP and ask the named human before you write code or run the command. When in doubt: scientific → Peleg, infra → Alex, code/architecture → Said. See also [02_contracts_and_invariants.md](./02_contracts_and_invariants.md) for the rules these escalations protect, and [03_doing_a_safe_change.md](./03_doing_a_safe_change.md) for the safe-change loop.

## The people

| Ask | Person | Domain |
|---|---|---|
| **Said** | Said Azaizah | Code, architecture, build, deploy decisions. Code peer. |
| **Peleg** | Dr. Peleg Ragonis-Bachar | Science: thresholds, definitions, SSW/FF semantics, TANGO config. |
| **Alex** | Dr. Aleksandr Golubev | Infra, DESY VM, scientific direction. Not a developer. |

## The escalation list

1. **`backend/schemas/api_models.py`** — any change to the canonical response schema (keys, types, shape). This is the single source of truth and is contract-protected. Breaks the backend↔UI contract and every downstream consumer. → **Said**.

2. **[FF-Helix](../humans/02_the_science.md#5-ff-helix) or FF-SSW thresholds / classification defaults** — editing the numbers or rules behind `helixFlag`, `ffHelixFlag`, `sswPrediction`, `ffSswFlag` (see `apply_ff_flags`). These are Peleg's scientific definitions, not tunable knobs. Changing them silently re-labels every peptide. → **Peleg** (and tell Said, since it touches the data layer).

3. **[SSW](../humans/02_the_science.md#6-ssw) canonical = (TANGO ∪ S4PRED)** — altering the union/intersection logic or which predictors feed the SSW determination. This is a scientific axiom, not an implementation detail. A change here changes what "SSW" means project-wide. → **Peleg**.

4. **Adding or modifying an ADR** in `docs/active/DECISIONS.md` — ADRs are load-bearing decisions with named authors (e.g. ADR-001 is "Said + Peleg"). Never add, edit, or reverse one unilaterally. Author it jointly with whoever owns the domain: science ADRs need Peleg, architecture ADRs need Said. → **Said** for the record; co-author per domain.

5. **Production deploy** — running `scripts/prod_redeploy.sh`, `scripts/desy_perf_redeploy.sh`, or `scripts/desy_vm_bootstrap.sh`. These mutate the live VM and user-facing service. Never run them as a side effect of another task. → **Alex** for DESY VM / infra; **Said** for the prod deploy call.

6. **Dropping or restructuring a database/schema** — any destructive or migrating change to a datastore (LanceDB `papers`/vector tables, precomputed JSON artifacts, future Supabase). Data loss is irreversible and ripples into reproducibility. → **Said** (architecture); **Alex** if it lives on DESY infra.

7. **Deleting any `docs/active/` file** without a matching move into `docs/archive/<date>/`. `docs/active/` is the only authoritative doc tree; deletion erases the why-trail. Archiving is allowed; deleting is not. → **Said**.

8. **Authentication or user data** — none exists yet, but the moment any auth flow, session, PII, or user-data store is added, escalate before writing it. Security and privacy decisions are not made inline. → **Said** (architecture/security); **Alex** if DESY hosting/compliance is involved.

9. **Anything crossing GitHub branch-protection rules** — force-pushing `main`, bypassing required CI checks, merging without the PR loop, or editing protected-branch settings. The rules exist so nothing un-reviewed reaches `main`. Open a PR and let review run. → **Said**.

10. **`LICENSE` or `CITATION.cff` identifiers** — editing the MIT license terms, author list, ORCID, or DOI fields. `CITATION.cff` changes ripple to the Zenodo DOI and JOSS record (ADR-011, ADR-013). These are legal/credit identifiers, not text. → **Said** for license/architecture; **Peleg** must approve any author/credit change.

## Default rule

If a change matches none of the above but still feels load-bearing, re-read [02_contracts_and_invariants.md](./02_contracts_and_invariants.md). Then ask anyway — a 30-second question is cheaper than a contract break. Science → **Peleg**. Infra → **Alex**. Code → **Said**.
