# Documentation — Claude Instructions

## Structure
All authoritative docs live in `docs/active/`. No subdirectories.

## File Map
| File | Purpose | When to read |
|------|---------|-------------|
| ACTIVE_CONTEXT.md | Architecture, entrypoints, data flow | Starting any task |
| CONTRACTS.md | API endpoints, request/response shapes | Touching API or types |
| TESTING_GUIDE.md | Test commands, setup, known failures | Writing or debugging tests |
| KNOWN_ISSUES.md | Active bugs, limitations | Before investigating bugs |
| PELEG_REVIEW_TASKS.md | Review task chunks (current priority) | Working on Peleg items |
| MASTER_DEV_DOC.md | Consolidated decisions + architecture | Deep architectural questions |
| DEPLOYMENT.md | VM specs + step-by-step deployment + K8s plan | Deployment tasks |
| ROADMAP.md | Strategic position + Phase A/B/C tasks + history | Planning or status checks |
| DEVELOPER_REFERENCE.md | Pipeline internals, null semantics, debugging | Deep implementation work |
| SPECIALS.md | Special handling rules | Edge case investigation |

## Rules
- Do NOT create new docs without user approval
- Keep each doc focused on ONE topic
- Update existing docs rather than creating new ones
- Cross-reference between docs using relative links
- Never duplicate information across docs — point to the source
