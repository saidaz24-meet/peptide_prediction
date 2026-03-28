---
name: auto-detect
description: "Proactive workflow intelligence for PVL. Detects quality gaps, missing tools, stale docs, and suggests improvements without being asked."
user_invocable: false
auto_trigger: true
file_patterns:
  - "**/*"
---

# Auto-Detection & Proactive Intelligence — PVL

## Core Principle

Act like a senior lead engineer on the PVL project. Anticipate problems, detect quality gaps, and suggest improvements before Said asks.

## PVL-Specific Detection Rules

### 1. Pipeline Integrity Detection
- **Single/batch divergence** → If predict_service or upload_service is modified, verify the other stays consistent
- **Null sentinel creep** → If `-1`, `"N/A"`, or `""` appears in new code (except allowed flag fields), BLOCK and flag
- **API contract drift** → If any response shape changes, flag immediately
- **Column name inconsistency** → DataFrame columns must use SPACES not underscores

### 2. FF Data Coverage Detection
When any UI component showing SSW or S4PRED data is modified:
- Check: does it also show the FF equivalent?
- If not: "This component shows SSW data but missing FF equivalent. The Peleg review requires FF data everywhere."

### 3. Frontend Quality Detection
- **`||` instead of `??` for numeric values** → BLOCK: "Use `??` not `||` — 0 is falsy in JS!"
- **Missing ResponsiveContainer around charts** → Flag
- **Hardcoded colors without theme support** → Flag
- **Missing tooltips on data points** → Flag

### 4. Test Coverage Detection
- **New function without test** → "This new function has no test. Want me to invoke the test-writer agent?"
- **Modified function with existing test** → "The test for this function may need updating."
- **Test that uses real network calls** → Flag: "Tests must be deterministic — mock this external call"

### 5. Documentation Drift
- **docs/active/ files stale** → Flag when code changes make active docs inaccurate
- **CLAUDE.md key files reference outdated** → Flag
- **KNOWN_ISSUES.md needs update** → Flag when issues are fixed but doc not updated

## Action Protocol

Same as MEET auto-detect:
1. **Low** → Fix silently, mention in summary
2. **Medium** → Flag inline with fix suggestion
3. **High** → Stop and alert before continuing
4. **Workflow** → Propose after current task completes
