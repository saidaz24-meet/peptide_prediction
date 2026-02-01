# Sentry Testing Guide

## Quick Test Steps

### 1. Enable Debug Mode

**Backend:**
```bash
export SENTRY_DEBUG=true
export ENVIRONMENT=development
# Restart backend
```

**Frontend:**
```bash
# In ui/.env or ui/.env.local
VITE_SENTRY_DEBUG=true
# Restart frontend dev server
```

### 2. Test Backend Connection

```bash
# Test simple message
curl http://localhost:8000/api/test-sentry-simple

# Test full suite (will trigger 500 error)
curl http://localhost:8000/api/test-sentry

# Check backend logs for:
# [SENTRY] Initialized successfully with DSN: ...
# [SENTRY] Event sent to Sentry: ...
```

### 3. Test Frontend Connection

1. Open browser console (F12)
2. Go to About page (`/about`)
3. Click "Send Test Message" or "Send Test Exception"
4. Or run in console: `testSentry()`
5. Check console for Sentry debug logs

### 4. Verify in Sentry Dashboard

1. Go to https://sentry.io
2. Select your project
3. Check "Issues" tab
4. Look for:
   - "Sentry backend initialized" (info message)
   - "Sentry frontend initialized" (info message)
   - "Test message from..." (your test events)
   - "Test exception from..." (your test exceptions)

## Common Issues

### No Events Appearing

1. **Check DSN is correct:**
   - Backend: `echo $SENTRY_DSN`
   - Frontend: Check browser console for DSN

2. **Check debug logs:**
   - Backend: Look for `[SENTRY]` messages in console
   - Frontend: Check browser console for Sentry logs

3. **Check network:**
   - Backend: `curl -v https://o4510730454499328.ingest.de.sentry.io/api/...`
   - Frontend: Check Network tab for requests to `sentry.io`

4. **Check Sentry project settings:**
   - Go to Sentry → Settings → Projects → Your Project
   - Check "Client Keys (DSN)" matches your DSN
   - Check "Inbound Filters" → Environment (should allow "development")

### Events Filtered Out

1. **Environment mismatch:**
   - Sentry filters by environment
   - Check Settings → Inbound Filters → Environment
   - Ensure "development" is allowed

2. **Sample rate too low:**
   - `tracesSampleRate: 0.1` only samples 10% of transactions
   - Errors are always captured, but transactions are sampled
   - Increase to `1.0` for testing

3. **Ignore patterns:**
   - Check Settings → Inbound Filters → Ignore Patterns
   - Remove patterns that match your test errors

## Expected Console Output

### Backend (with SENTRY_DEBUG=true):
```
[SENTRY] Initialized successfully
[SENTRY] Sending envelope to https://o4510730454499328.ingest.de.sentry.io/api/... (event_id: abc123...)
```

### Frontend (with VITE_SENTRY_DEBUG=true):
```
[SENTRY] Initialized successfully
[SENTRY] Sending envelope to https://o4510730454499328.ingest.de.sentry.io/api/... (event_id: xyz789...)
```

## Manual Test Endpoints

### Backend:
- `GET /api/test-sentry-simple` - Sends a simple test message
- `GET /api/test-sentry` - Full test suite (triggers 500 error)

### Frontend:
- Browser console: `testSentry()` - Sends multiple test events
- About page: Test buttons (development mode only)

## Next Steps

If events still don't appear:

1. **Verify DSN in Sentry dashboard:**
   - Settings → Projects → Your Project → Client Keys (DSN)
   - Copy the DSN and compare with your code

2. **Check Sentry status:**
   - https://status.sentry.io/ - Check if Sentry is down

3. **Test with curl:**
   ```bash
   # Test Sentry ingestion endpoint directly (replace with your actual DSN values)
   # Extract from your SENTRY_DSN env var: https://<key>@<org>.ingest.de.sentry.io/<project>
   curl -X POST https://<org>.ingest.de.sentry.io/api/<project>/envelope/ \
     -H "Content-Type: application/x-sentry-envelope" \
     -d '{"sentry_key":"<your-key>"}'
   ```

4. **Check firewall/proxy:**
   - Ensure outbound HTTPS to `*.sentry.io` is allowed
   - Check if corporate proxy is blocking requests

