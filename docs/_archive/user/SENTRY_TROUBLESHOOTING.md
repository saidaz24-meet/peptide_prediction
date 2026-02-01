# Sentry Troubleshooting Guide

## 🔍 Current Issues Analysis

### Why Errors Aren't Showing in Sentry Dashboard

Based on your current setup and Sentry best practices, here are the likely reasons:

---

## 🐛 Issue 1: HTTPExceptions (4xx) Not Captured by Default

**Problem**: FastAPI's `FastApiIntegration` only captures **5xx errors** by default. Your code raises many `HTTPException(400, ...)` which are **4xx errors** and won't appear in Sentry.

**Evidence in your code**:
```python
# These won't show in Sentry:
raise HTTPException(400, detail="File must have a filename...")
raise HTTPException(400, detail="Unsupported file format...")
raise HTTPException(400, detail="Missing required column(s)...")
```

**Fix**: Configure Sentry to capture 4xx errors OR explicitly capture them:

```python
# Option A: Capture all HTTPExceptions (including 4xx)
from sentry_sdk.integrations.fastapi import FastApiIntegration
from fastapi import HTTPException

def before_send(event, hint):
    """Filter or modify events before sending to Sentry"""
    if 'exc_info' in hint:
        exc_type, exc_value, tb = hint['exc_info']
        # Capture 4xx errors too
        if isinstance(exc_value, HTTPException):
            if exc_value.status_code >= 400:  # Capture all 4xx and 5xx
                return event
    return event

sentry_sdk.init(
    dsn=SENTRY_DSN,
    integrations=[FastApiIntegration()],
    before_send=before_send,  # Add this
    # ... rest of config
)

# Option B: Explicitly capture in exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Only capture 5xx or important 4xx
    if exc.status_code >= 500:
        sentry_sdk.capture_exception(exc)
    raise exc
```

---

## 🐛 Issue 2: No ErrorBoundary in React App

**Problem**: React errors (render errors, component errors) are not automatically captured. You need an ErrorBoundary.

**Evidence**: Your `main.tsx` has no ErrorBoundary:
```tsx
// Current: No ErrorBoundary
createRoot(document.getElementById("root")!).render(<App />);
```

**Fix**: Wrap your app in Sentry's ErrorBoundary:

```tsx
// ui/src/main.tsx
import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || "https://...";

Sentry.init({
  dsn: SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  environment: import.meta.env.MODE || "development",
  debug: true,  // ⚠️ ADD THIS TEMPORARILY to see what's happening
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
});

// ✅ ADD ErrorBoundary
const container = document.getElementById("root")!;
const root = createRoot(container);

root.render(
  <Sentry.ErrorBoundary fallback={({ error }) => <div>Something went wrong: {error.message}</div>} showDialog>
    <App />
  </Sentry.ErrorBoundary>
);
```

---

## 🐛 Issue 3: Promise Rejections Not Captured

**Problem**: Unhandled promise rejections (e.g., failed API calls) are not automatically captured.

**Evidence**: Your API calls use `fetch()` but errors might not be captured:
```tsx
// Errors in these won't show in Sentry:
const response = await fetch(...);
if (!response.ok) {
  // This error won't be in Sentry
  throw new Error("API call failed");
}
```

**Fix**: Add global error handlers:

```tsx
// ui/src/main.tsx - Add after Sentry.init()
// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason);
});

// Capture uncaught errors
window.addEventListener('error', (event) => {
  Sentry.captureException(event.error);
});
```

---

## 🐛 Issue 4: Backend Exceptions Logged But Not Captured

**Problem**: Your middleware catches exceptions and logs them, but doesn't capture to Sentry:

```python
# Current code:
except Exception as e:
    log_error("request_error", f"...", **{"error": str(e)})
    raise  # ✅ This will be caught by FastApiIntegration, but only if 5xx
```

**Fix**: Explicitly capture exceptions:

```python
# backend/server.py - TraceIdMiddleware
except Exception as e:
    log_error("request_error", f"{request.method} {request.url.path} failed: {e}", **{
        "method": request.method,
        "path": request.url.path,
        "error": str(e),
    })
    # ✅ ADD THIS:
    import sentry_sdk
    sentry_sdk.capture_exception(e, level="error")
    raise
```

---

## 🐛 Issue 5: Different DSNs for Frontend/Backend

**Problem**: You're using different DSNs for frontend and backend.

**Impact**: Errors appear in different projects in Sentry dashboard.

**Fix**: Use the same DSN OR check both projects in Sentry dashboard. DSNs should be set via environment variables:
- Backend: `SENTRY_DSN` in `backend/.env`
- Frontend: `VITE_SENTRY_DSN` in `ui/.env` or `ui/.env.local`

---

## 🐛 Issue 6: Environment Mismatch

**Problem**: Sentry might filter events based on environment. Your frontend sets:
```tsx
environment: import.meta.env.MODE || "development"
```

**Impact**: If Sentry is configured to only show `production` events, `development` events won't appear.

**Fix**: Check Sentry project settings → Inbound Filters → Environment. Or set environment explicitly:

```python
# backend/server.py
sentry_sdk.init(
    dsn=SENTRY_DSN,
    environment=os.getenv("ENVIRONMENT", "development"),  # ✅ ADD THIS
    # ... rest
)
```

---

## 🐛 Issue 7: Debug Mode Not Enabled

**Problem**: You can't see what Sentry is doing (dropping events, initialization issues, etc.).

**Fix**: Enable debug mode temporarily:

```python
# backend/server.py
sentry_sdk.init(
    dsn=SENTRY_DSN,
    debug=True,  # ✅ ADD THIS - shows detailed logs
    # ... rest
)
```

```tsx
// ui/src/main.tsx
Sentry.init({
  dsn: SENTRY_DSN,
  debug: true,  // ✅ ADD THIS - shows console logs
  // ... rest
});
```

---

## 🐛 Issue 8: Sample Rates Too Low

**Problem**: Your sample rates are 0.1 (10%), so 90% of errors are dropped:

```python
traces_sample_rate=0.1,  # Only 10% of transactions
```

**Impact**: Most errors won't be captured.

**Fix**: Increase sample rate for errors (errors are always captured, but transactions are sampled):

```python
# Errors are always captured, but you can set:
traces_sample_rate=1.0,  # 100% for development
```

---

## ✅ Recommended Fixes (Priority Order)

### 1. **Add ErrorBoundary to React** (HIGH PRIORITY)
```tsx
// ui/src/main.tsx
root.render(
  <Sentry.ErrorBoundary fallback={({ error }) => <div>Error: {error.message}</div>} showDialog>
    <App />
  </Sentry.ErrorBoundary>
);
```

### 2. **Capture HTTPExceptions Explicitly** (HIGH PRIORITY)
```python
# backend/server.py
from fastapi import Request
from fastapi.responses import JSONResponse
import sentry_sdk

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Capture 5xx and important 4xx
    if exc.status_code >= 500 or exc.status_code in [400, 401, 403, 404]:
        sentry_sdk.capture_exception(exc, level="error" if exc.status_code >= 500 else "warning")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )
```

### 3. **Add Debug Mode** (MEDIUM PRIORITY)
```python
# backend/server.py
sentry_sdk.init(
    dsn=SENTRY_DSN,
    debug=True,  # Remove after debugging
    # ... rest
)
```

### 4. **Capture Promise Rejections** (MEDIUM PRIORITY)
```tsx
// ui/src/main.tsx - After Sentry.init()
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason);
});
```

### 5. **Explicit Capture in Middleware** (LOW PRIORITY)
```python
# backend/server.py - TraceIdMiddleware
except Exception as e:
    sentry_sdk.capture_exception(e)
    raise
```

---

## 🧪 Testing Your Fixes

### Test Backend:
```python
# Add a test endpoint
@app.get("/api/test-sentry")
async def test_sentry():
    # Test 5xx error (should appear)
    raise HTTPException(500, detail="Test 500 error")
    
    # Test 4xx error (won't appear without fix)
    # raise HTTPException(400, detail="Test 400 error")
```

### Test Frontend:
```tsx
// Add a test button
<button onClick={() => {
  throw new Error("Test React error");
}}>Test Sentry</button>
```

### Check Sentry Dashboard:
1. Go to your Sentry project
2. Check "Issues" tab
3. Look for test errors
4. Check "Settings" → "Projects" → "Client Keys (DSN)" to verify DSN

---

## 📋 Checklist

- [ ] ErrorBoundary added to React app
- [ ] HTTPException handler added to FastAPI
- [ ] Debug mode enabled (temporarily)
- [ ] Promise rejection handler added
- [ ] Explicit `sentry_sdk.capture_exception()` in middleware
- [ ] Environment variable set correctly
- [ ] DSN verified in both frontend/backend
- [ ] Test errors appear in Sentry dashboard

---

## 🔗 References

- [Sentry FastAPI Integration](https://docs.sentry.io/platforms/python/guides/fastapi/)
- [Sentry React Integration](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry ErrorBoundary](https://docs.sentry.io/platforms/javascript/guides/react/components/errorboundary/)
- [Sentry Troubleshooting](https://docs.sentry.io/platforms/javascript/troubleshooting/)

