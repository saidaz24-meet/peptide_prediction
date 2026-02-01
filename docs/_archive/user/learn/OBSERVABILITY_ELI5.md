# Observability ELI5: Logging vs Monitoring vs Error Tracking

## TL;DR

- **Logging**: "What happened?" - Structured logs for debugging and understanding system behavior
- **Monitoring**: "Is it working?" - Metrics and dashboards to track system health
- **Error Tracking (Sentry)**: "Oh shit, something broke!" - Only for exceptions and critical errors

**Sentry is for "oh shit" moments only** - not for every log line or normal operation.

## The Three Pillars of Observability

### 1. Logging 📝

**What it is**: Structured text output that records what your application is doing.

**Think of it like**: A detailed diary of everything that happens.

**What goes in logs**:
- Request start/end
- Processing steps (parsing, normalization, provider execution)
- Warnings (non-fatal issues)
- Info messages (normal operation flow)

**Example**:
```json
{"timestamp": "2025-01-28T18:00:00Z", "level": "INFO", "event": "tango_run_start", 
 "message": "Running TANGO for 10 sequences", "traceId": "abc-123", 
 "sequence_count": 10}
```

**When to use**: Always. Logs are your primary debugging tool.

**Where logs go**: Console (stdout), log files, or log aggregation services (e.g., CloudWatch, Datadog).

---

### 2. Monitoring 📊

**What it is**: Metrics and dashboards that track system health and performance.

**Think of it like**: A dashboard in your car showing speed, fuel, engine temperature.

**What goes in monitoring**:
- Request rate (requests per second)
- Response times (p50, p95, p99)
- Error rates
- Resource usage (CPU, memory, disk)
- Business metrics (peptides processed, provider success rate)

**Example metrics**:
- `http_requests_total{status="200"}` = 1000
- `tango_execution_duration_seconds{quantile="0.95"}` = 5.2
- `provider_status{provider="tango",status="available"}` = 1

**When to use**: Continuously. Monitoring helps you detect issues before users complain.

**Where metrics go**: Prometheus, Datadog, CloudWatch, Grafana dashboards.

---

### 3. Error Tracking (Sentry) 🚨

**What it is**: A service that captures exceptions and critical errors with full context.

**Think of it like**: A fire alarm - only goes off when something is actually on fire.

**What goes to Sentry**:
- **Exceptions** (unhandled errors that crash or could crash the app)
- **Critical errors** (provider failures, data corruption, security issues)
- **NOT** normal operation logs
- **NOT** warnings (unless they indicate a real problem)
- **NOT** info messages

**Example**:
```python
try:
    run_tango(records)
except Exception as e:
    # Log the error (for debugging)
    log_error("tango_execution_failed", f"TANGO failed: {e}", **{"error": str(e)})
    
    # Send to Sentry (for alerting)
    sentry_sdk.capture_exception(e, level="error")
```

**When to use**: Only when something actually breaks or could break.

**Where errors go**: Sentry dashboard (with alerts, stack traces, user context).

---

## Why Sentry is for "Oh Shit" Only

### The Problem with Sending Everything to Sentry

If you send every log line to Sentry:
1. **Noise overload**: You can't see real errors through the noise
2. **Cost**: Sentry charges per event - sending logs is expensive
3. **Alert fatigue**: You get alerts for normal operation, so you ignore real alerts
4. **Performance**: Sending every log line adds latency

### What Should Go to Sentry?

✅ **DO send to Sentry**:
- Unhandled exceptions
- Provider execution failures (TANGO, PSIPRED)
- Data corruption errors
- Security violations
- Critical business logic failures

❌ **DON'T send to Sentry**:
- Normal request logs (`log_info("request_start", ...)`)
- Successful operations
- Warnings that don't indicate failures
- Debug messages
- Performance metrics

### Our Implementation

In this codebase:

1. **Sentry only initializes if `SENTRY_DSN` is set** (optional)
2. **No LoggingIntegration** - regular logs don't go to Sentry
3. **Only `capture_exception()` calls** - explicit error captures with context
4. **Provider errors wrapped** - TANGO/PSIPRED failures captured with traceId and context

```python
# ✅ Good: Only capture real errors
try:
    run_tango(records)
except Exception as e:
    log_error("tango_failed", f"TANGO failed: {e}")  # Goes to logs
    sentry_sdk.capture_exception(e)  # Goes to Sentry

# ❌ Bad: Don't send normal logs
log_info("tango_start", "Starting TANGO")  # Only logs, NOT Sentry
```

---

## How They Work Together

### Normal Operation Flow

1. **Request comes in** → Logged (not Sentry)
2. **Processing steps** → Logged (not Sentry)
3. **Success** → Logged (not Sentry)
4. **Metrics updated** → Monitoring dashboard

### Error Flow

1. **Exception occurs** → Logged with traceId
2. **Exception captured** → Sent to Sentry with context
3. **Provider status set** → `providerStatus: {status: "UNAVAILABLE", reason: "..."}`
4. **Request continues** → Returns partial results (graceful degradation)
5. **Alert sent** → Sentry notifies team (if configured)

### Example: TANGO Failure

```python
try:
    run_dir = tango.run_tango_simple(records)
except Exception as e:
    # 1. Log the error (for debugging)
    log_error("tango_execution_failed", f"TANGO failed: {e}", 
              traceId="abc-123", stage="tango_run")
    
    # 2. Send to Sentry (for alerting)
    sentry_sdk.capture_exception(e, level="error")
    
    # 3. Set provider status (for UI)
    provider_status = "UNAVAILABLE"
    provider_reason = f"TANGO execution failed: {str(e)}"
    
    # 4. Continue gracefully (don't crash)
    # Return results without TANGO data
```

**Result**:
- ✅ Logs show what happened (debugging)
- ✅ Sentry alerts team (monitoring)
- ✅ UI shows provider status (user feedback)
- ✅ Request completes (graceful degradation)

---

## Best Practices

### Logging

- ✅ Use structured logs (JSON format)
- ✅ Include traceId in every log
- ✅ Log at appropriate levels (DEBUG < INFO < WARNING < ERROR)
- ✅ Don't log sensitive data (sequences, PII)

### Monitoring

- ✅ Track key metrics (request rate, latency, error rate)
- ✅ Set up dashboards
- ✅ Create alerts for critical thresholds

### Error Tracking (Sentry)

- ✅ Only capture exceptions and critical errors
- ✅ Include context (traceId, provider, stage, endpoint)
- ✅ Use tags for filtering (`provider=tango`, `stage=parse`)
- ✅ Don't send normal operation logs

---

## Configuration

### Sentry Setup

```python
# Only initialize if DSN is set
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration()],  # Only FastAPI, NOT LoggingIntegration
        environment=settings.ENVIRONMENT,  # "development" or "production"
        release=os.getenv("SENTRY_RELEASE"),  # Optional: version tracking
        # Do NOT add LoggingIntegration - we don't want every log in Sentry
    )
```

### Error Capture Pattern

```python
try:
    # Provider execution
    result = provider.run(data)
except Exception as e:
    # 1. Log with traceId
    trace_id = get_trace_id()
    log_error("provider_failed", f"Provider failed: {e}", 
              stage="provider_run", **{"error": str(e)})
    
    # 2. Capture to Sentry with context
    if SENTRY_INITIALIZED:
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("provider", "tango")
            scope.set_tag("stage", "execution")
            scope.set_context("provider_error", {
                "trace_id": trace_id,
                "entry": entry_id,
            })
            sentry_sdk.capture_exception(e, level="error")
    
    # 3. Set provider status
    provider_status = "UNAVAILABLE"
    provider_reason = f"Execution failed: {str(e)}"
```

---

## Summary

| Tool | Purpose | When to Use | What Goes There |
|------|---------|-------------|-----------------|
| **Logging** | Debugging & understanding | Always | Everything (structured) |
| **Monitoring** | Health & performance | Continuously | Metrics & dashboards |
| **Sentry** | Error alerting | Only on errors | Exceptions & critical failures |

**Remember**: Sentry is your fire alarm, not your security camera. It should only go off when something is actually wrong.

---

## See Also

- `backend/services/logger.py` - Structured logging implementation
- `backend/server.py` - Sentry initialization and error capture patterns
- `backend/config.py` - Sentry configuration (SENTRY_DSN, ENVIRONMENT)

