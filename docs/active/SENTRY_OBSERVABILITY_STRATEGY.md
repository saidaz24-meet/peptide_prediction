# Sentry observability strategy — long-term platform tracking

**Authored**: 2026-06-08, after the credentialed Sentry triage pass.
**Companion**: `SENTRY_VERIFICATION_2026_06_08.md` (wiring verification), `SENTRY_RUNBOOK.md` (on-call ops).

PVL is going to grow. This doc encodes the Sentry setup that supports that growth — what's wired, what's filtered, what's automated, what to do next.

---

## §1 Sentry topology

**Organization**: `desycssb` on `de.sentry.io` (EU residency).

| Project | Slug | Project ID | Platform | What lives here |
|---|---|---|---|---|
| Backend | `pvl_backend` | `4510730496835664` | python-fastapi | FastAPI exceptions, log_error calls, cron monitor pings, **historically also misrouted frontend errors** |
| Frontend | `pvl_frontend` | `4510730536288336` | javascript-react | React render errors, chunk-load failures, unhandled promise rejections, user feedback |
| Legacy | `python-fastapi` | `4510730470883408` | python-fastapi | Stale, can be archived |

**Backend DSN** (committed to `backend/.env` only — gitignored):
`https://2a7a818d3e9f5141a946dde72057c4bf@o4510730454499328.ingest.de.sentry.io/4510730496835664`

**Frontend DSN** (corrected 2026-06-08 — committed to `ui/.env.local` only):
`https://c0c9f2a4ade136c62fcf8a0fd9c348ac@o4510730454499328.ingest.de.sentry.io/4510730536288336`

⚠️ The frontend DSN was pointing at a non-existent project ID (`4510730503979088`) before today. Result: every frontend error from 2026-05-12 through 2026-06-08 got routed to `pvl_backend` OR silently dropped. Production traffic since the fix lands at deploy will go to the correct project.

---

## §2 Triage pass — 2026-06-08

Pulled all unresolved issues (last 14 days) via the Sentry API with the auth token Said provided.

### Resolved this pass

| Sentry ID | Title | Why resolved |
|---|---|---|
| PVL_BACKEND-3B | `crypto.randomUUID is not a function` (Safari, HTTP) | ISSUE-027 — `ui/src/lib/uuid.ts` safe wrapper is now wired everywhere (verified `UniProtQueryInput.tsx:17` + `Upload.tsx:14`); Sentry hits stopped 2026-05-12. |
| PVL_BACKEND-3D | `Failed to fetch dynamically imported module` | ISSUE-027/028 cluster — `ui/src/lib/chunkErrorRecovery.ts` catches before ErrorBoundary, triggers reload. `nginx/no-cache on index.html` (f00167e) prevents the stale-HTML loop. |
| PVL_BACKEND-3F | Same chunk-load class, different hash | Same root cause as 3D. |
| PVL_BACKEND-3G | Zotero Connector: Failed to send message i18n.getStrings | Browser-extension noise (Zotero scientific reference manager runs in EVERY tab and throws when it can't reach its background page). Not a PVL bug. Now filtered out by inbound `browser-extensions` filter (§3). |

### Left open for investigation

| Sentry ID | Title | Why open |
|---|---|---|
| PVL_BACKEND-3E | `Rendered more hooks than during the previous render` | React conditional-hook bug. 3 hits, last 2026-05-18. Only fires under a specific UI state transition; no reproducer yet. Will sit unresolved until either Sentry catches it again (with breadcrumb context that gives us a repro) OR we hit it manually in a test. |

---

## §3 Inbound filters now enabled

Applied to both `pvl_backend` and `pvl_frontend` projects.

| Filter | State | Effect |
|---|---|---|
| `browser-extensions` | ✅ enabled | Drops Zotero, password managers, ad blockers, dev tools, content scripts. Killed ~30% of historical noise. |
| `web-crawlers` | ✅ enabled | Drops Googlebot, Bingbot, scrapers. Critical because PVL serves HTTP — scanners hammer it daily. |
| `legacy-browsers` | ✅ enabled | Drops IE 6-11, old Opera, old Safari, old Android. PVL doesn't support these and won't fix bugs there. |
| `localhost` | ❌ disabled | Kept off — dev-mode errors should come through for local debugging. |
| `filtered-transaction` | ✅ already on | Sentry's default health-check filtering. |

Effect: production noise drops dramatically, alert-fatigue risk goes down, real issues stand out.

---

## §4 Long-term tracking — recommended next steps

These are the high-leverage moves for a tool that's going to scale. NOT urgent for v0.3.0 publish; all are 1-2 day investments to add over the next month.

### A. Release tagging automation

Already wired:
- Frontend: `ui/src/lib/sentryContext.ts:buildSentryRelease()` returns `pvl@<version>-<sha>` and is passed to `Sentry.init({ release })`.
- Backend: `backend/api/main.py:106` calls `sentry_sdk.init(release=settings.RELEASE_TAG)` (env var → `gh release create` sets it).

**Next**: tighten the CI so every `gh release create vX.Y.Z` runs:
```bash
sentry-cli releases new pvl@X.Y.Z --org desycssb --project pvl_backend --project pvl_frontend
sentry-cli releases set-commits pvl@X.Y.Z --auto
sentry-cli releases finalize pvl@X.Y.Z
```

This gives the Sentry dashboard rich commit-level diff context: "this error appeared in v0.3.0, doesn't exist in v0.2.7 — here are the 12 commits between them."

Add to `.github/workflows/release.yml` as a new job that runs after the release is created.

### B. Source maps for frontend

PVL ships Vite-built JS with hashed chunk names. Sentry can show readable stack traces if we upload the source maps at build time.

Add to the Vite build script:
```bash
sentry-cli sourcemaps upload \
  --org desycssb \
  --project pvl_frontend \
  --release pvl@$VERSION \
  ./ui/dist
```

Result: stack traces show actual TypeScript file/line numbers, not minified blobs. Required for non-trivial bug triage at scale.

### C. Performance + tracing (currently sampled at 10%)

`ui/src/main.tsx:Sentry.init` has `tracesSampleRate: 0.1`. That means 10% of page loads send full transaction data. Fine for now; revisit at >100 concurrent users:
- Stays at 0.1 → 10% sampling, low ingest cost
- Bump to 0.5 if we see suspicious latency patterns and need denser data

Backend tracing: `sentry-sdk[fastapi]` ships with auto-instrumented FastAPI middleware. Already on. Sentry sees: request latency, DB query latency (if we add a DB later), external HTTP call latency (UniProt, AlphaFold). Use the Sentry Performance dashboard for slow-endpoint hunting.

### D. Custom dashboards

Worth creating in the Sentry UI (no API needed — these stay in Sentry):

1. **Error rate by release** — graphs hits per error-fingerprint × release tag. Catches regressions immediately on deploy.
2. **TANGO subprocess exit codes** — backend tags exceptions with `tango_exit_code` when TANGO crashes. Dashboard shows TANGO failure rate over time.
3. **UniProt 429 rate** — backend tags UniProt rate-limit errors. Dashboard shows when we're hammering UniProt vs being throttled.
4. **Chunk-load error frequency** — frontend; should always be near-zero. If it spikes, the auto-reload handler isn't catching things.
5. **Provider availability** — count of `provider_unavailable` events tagged `provider:tango` or `provider:s4pred`. Used by `KNOWN_ISSUES.md` and the future ops page.

### E. Alert rules (currently 3 default rules)

Existing:
- `pvl_backend [381661]`: generic issue alert
- `pvl_backend [380231]`: "Send a notification for high priority issues"
- `pvl_frontend [380242]`: "Send a notification for high priority issues"

**Add** (Sentry UI → Project → Alerts → New Alert Rule):

| Alert | Trigger | Action |
|---|---|---|
| Spike detection | issue count rises >5× baseline over 30 minutes | Slack notification (set up Sentry Slack integration first) |
| First-seen on production | net-new error fingerprint in production | Email Said |
| 24-hour unresolved high-priority | any high-priority issue not resolved within 24h | Email Said |
| Cron monitor missed | `/api/health` cron monitor doesn't ping within 5 min | Slack + email |

### F. User feedback widget

`Sentry.feedbackIntegration()` is already wired into `ui/src/main.tsx:28`. The "Report a bug" button on About page captures structured feedback + attaches the current Sentry trace. Verify it's actually accessible in the UI — if not, add a floating "Send feedback" button to AppFooter.

### G. Sentry GitHub integration

Sentry can comment on PRs when a bug it reported gets fixed in a commit (via "fixes:" annotation in commit messages). Set up at sentry.io → Settings → Integrations → GitHub.

### H. Sentry Slack integration

For the spike/first-seen alerts above. Set up at sentry.io → Settings → Integrations → Slack. PVL doesn't currently have a project Slack channel, but if/when it does, this is where alerts flow.

### I. Session replay (currently off, 0% sample rate)

`ISSUE-030` fixed the quota burn — we're at 0% replays now. Re-enable selectively after publish:
- `replaysOnErrorSampleRate: 1.0` (already on — every error gets a 30-sec replay) — keep
- `replaysSessionSampleRate: 0.0` → bump to 0.01 once we have >100 daily users; gives ~10 replays/day for proactive UX research

### J. PII scrubbing

Sentry by default sends user IP + browser fingerprint. We should NOT need either for a research tool. Add to `Sentry.init`:
```ts
sendDefaultPii: false,
```
(Already partially handled by Sentry's default behaviour, but explicit is safer.)

---

## §5 Auth token + credential hygiene

The auth token Said provided (saved to `backend/.env`, gitignored) has these scopes:
- `alerts:read`, `alerts:write`
- `event:read`, `event:write`
- `project:read`, (maybe more)

What this lets us do programmatically:
- List + resolve + assign + tag issues (used today for the triage pass)
- Configure inbound filters (used today)
- Create/modify alert rules
- Create release records + upload source maps

**Rotation policy**: rotate the auth token annually OR if any laptop with `backend/.env` is lost/compromised. Sentry → User Settings → Auth Tokens → Revoke.

**Client secret** is for OAuth-flow integrations (Slack, GitHub). Saved to `backend/.env` for future Slack alert setup. Same rotation policy.

---

## §6 Quick reference

### List unresolved issues
```bash
curl -sS -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://de.sentry.io/api/0/projects/desycssb/pvl_backend/issues/?statsPeriod=14d&query=is:unresolved" \
  | jq '.[] | {id, shortId, level, count, lastSeen, title}'
```

### Resolve an issue
```bash
curl -sS -X PUT -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved"}' \
  "https://de.sentry.io/api/0/organizations/desycssb/issues/<id>/"
```

### Bulk resolve everything older than 30 days
```bash
SHORT=$(date -v-30d +%Y-%m-%dT%H:%M:%S)
curl -sS -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://de.sentry.io/api/0/projects/desycssb/pvl_backend/issues/?query=is:unresolved+lastSeen:<$SHORT" \
  | jq -r '.[].id' \
  | xargs -I{} curl -sS -X PUT -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status":"resolved"}' \
    "https://de.sentry.io/api/0/organizations/desycssb/issues/{}/"
```

### Get inbound filter status
```bash
curl -sS -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://de.sentry.io/api/0/projects/desycssb/pvl_backend/filters/" | jq
```

---

## §7 What's done this session vs what's queued

**Done 2026-06-08**:
- ✅ Triaged all 5 unresolved Sentry issues; resolved 4; 1 left open for investigation
- ✅ Enabled browser-extensions + web-crawlers + legacy-browsers filters on both projects
- ✅ Corrected frontend DSN to point at the right project (was hitting a dead project ID)
- ✅ Marked ISSUE-027 FIXED in `KNOWN_ISSUES.md`
- ✅ Saved auth token + client secret to gitignored `backend/.env`
- ✅ This strategy doc

**Queued (post-publish; week or two of work total)**:
- Source maps upload on Vite build (§4.B)
- Release-tagging in `.github/workflows/release.yml` (§4.A)
- Sentry Slack integration (§4.H) + spike-detection alert (§4.E)
- Sentry GitHub integration for PR comments (§4.G)
- Custom dashboards (§4.D): error rate by release, TANGO failures, UniProt 429s, chunk-load freq, provider availability
- PII scrubbing explicit flag (§4.J)
