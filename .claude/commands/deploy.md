---
description: "Build, lint, test, commit — full deployment pipeline check"
allowed-tools: Bash, Read
---

# Deploy Check — PVL

Run the full pipeline to verify everything is clean before pushing:

## 1. Backend Checks
```bash
cd /Users/saidazaizah/Desktop/DESY/peptide_prediction
make ci    # lint + typecheck + test
```

## 2. Frontend Checks
```bash
cd /Users/saidazaizah/Desktop/DESY/peptide_prediction/ui
npx tsc --noEmit
npx vitest run
npx prettier --check "src/**/*.{ts,tsx}"
```

## 3. Docker Build Test
```bash
docker compose -f docker/docker-compose.yml build --no-cache 2>&1 | tail -20
```

## 4. Report
```
## Deploy Readiness

| Check | Status |
|-------|--------|
| Backend lint | pass/fail |
| Backend types | pass/fail |
| Backend tests | N passed |
| Frontend types | pass/fail |
| Frontend tests | N passed |
| Frontend format | pass/fail |
| Docker build | pass/fail |

Ready to push: YES/NO
```

If any check fails, diagnose and suggest fixes.
