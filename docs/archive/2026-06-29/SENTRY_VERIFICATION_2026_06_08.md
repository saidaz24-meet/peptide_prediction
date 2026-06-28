# Sentry verification status — 2026-06-08

What's wired vs what's not, and what's left to verify before publish.

---

## Backend Sentry

**Wired**: `backend/api/main.py:106` calls `sentry_sdk.init(dsn=settings.SENTRY_DSN, ...)` on app startup. `backend/config.py:102` reads `SENTRY_DSN` from `os.getenv()`.

**DSN configured**: `backend/.env` contains the production DSN (`https://2a7a818d3e9f5141a946dde72057c4bf@o4510730454499328.ingest.de.sentry.io/4510730496835664`). Verified 2026-06-08.

**Initialization is conditional**: if `SENTRY_DSN` is empty, the app logs `sentry_init: No DSN provided, Sentry disabled` and continues. PVL works without Sentry — observability is optional.

**Events delivered**:
- Uncaught exceptions → Sentry Issues (release-tagged)
- `log_error(event_key, msg, **meta)` → Sentry breadcrumb + event
- Health endpoint pings → Sentry cron monitor (verifies backend is up)

---

## Frontend Sentry

**Wired**: `ui/src/main.tsx:40` calls `Sentry.init(...)` with `dsn: VITE_SENTRY_DSN`, traces sample rate 0.1, replays sample rate 0.0 (was 1.0 — see ISSUE-030).

**DSN configured**: `ui/.env.local` contains the FRONTEND project DSN (separate from backend project: `https://253dbc7f0614caaff80451acc9c676bf@o4510730454499328.ingest.de.sentry.io/4510730503979088`). Same Sentry org, different project. Verified 2026-06-08.

**`.env.example` updated** in this PR to document `VITE_SENTRY_DSN` as a configurable variable for clones.

**Events delivered**:
- React render errors → ErrorBoundary fallback + Sentry event with React tree context
- Window-level errors → `window.onerror` handler in `chunkErrorRecovery.ts`
- Window-level unhandled promise rejections → same handler
- Chunk-load errors (post-deploy stale-tab race) → caught BEFORE Sentry by the chunk recovery handler, which triggers a page reload

---

## What I can verify from inside the repo (without an auth token)

| Check | Status |
|---|---|
| Backend SDK present in `backend/requirements.txt` | ✅ `sentry-sdk[fastapi]` |
| Backend init code path exists | ✅ `backend/api/main.py:106` |
| Backend DSN reaches the code | ✅ `backend/config.py:102` reads `SENTRY_DSN` |
| Backend `.env` has the DSN | ✅ verified 2026-06-08 |
| Frontend SDK present in `ui/package.json` | ✅ `@sentry/react` |
| Frontend init code path exists | ✅ `ui/src/main.tsx:40` |
| Frontend DSN env var is used | ✅ `VITE_SENTRY_DSN` |
| Frontend `.env.local` has the DSN | ✅ verified 2026-06-08 |
| Frontend `.env.example` documents the variable | ✅ added in this PR |
| Chunk-error recovery wired before Sentry | ✅ `chunkErrorRecovery.ts:1` import comment |
| Sentry replay sample rate sane (not 1.0) | ✅ ISSUE-030 fixed; replays now 0.0 |
| About-page Sentry test buttons present (dev-only) | ✅ `About.tsx:225` |

---

## What I CANNOT verify without `SENTRY_AUTH_TOKEN`

The DSN you (Said) provided is the INGESTION DSN — it lets PVL send events TO Sentry but does NOT let me read events back. To do the reconciliation pass against `KNOWN_ISSUES.md` (cross-checking that issues marked FIXED in our docs are NOT still firing in production), I'd need a Sentry API auth token with scope `event:read project:read`.

If you can grab one:

1. Sentry dashboard → User Settings → Auth Tokens → Create New Token
2. Scopes needed: `event:read`, `project:read`, `issue:read`
3. Paste into `backend/.env` as `SENTRY_AUTH_TOKEN=<token>`
4. I (or T-OPS later) can then run:

   ```bash
   curl -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
     "https://sentry.io/api/0/projects/<org>/<project>/issues/?statsPeriod=30d&query=is:unresolved" \
     | jq '.[] | {title, count, lastSeen, culprit}'
   ```

   And cross-reference the issue titles against `docs/active/KNOWN_ISSUES.md` to find ANY that:
   - We mark FIXED but Sentry still sees firing → regression
   - Sentry sees firing but we don't track in KNOWN_ISSUES → unknown issue

Until then this verification is "wiring is correct" — not "no issues in production".

---

## Smoke test you can run RIGHT NOW

Hit the live VPS About page (`http://94.130.178.182:3000/about`) — there's a Sentry Test card in development mode with four buttons. None show in production mode (`import.meta.env.MODE === "development"` is false), but the buttons exercise:

1. Send test message (info)
2. Send test exception (error)
3. Send test warning
4. Throw React error (caught by ErrorBoundary)

Each one should appear in your Sentry dashboard within a few seconds, tagged with the current release SHA (see `buildSentryRelease()` in `ui/src/lib/sentryContext.ts`).

---

## Next step after publish

Once v0.3.0 is tagged + Zenodo DOI lands, Sentry release-tagging takes that tag string automatically (via `release: buildSentryRelease()` in `Sentry.init`). All events from then on get attributed to the release, so the dashboard can answer "did this issue start in v0.3.0 or before".
