# How to View Observability Features

## 1. Health Check Endpoint

**URL:** `http://localhost:3000/api/health`

**How to view:**
- Open in browser: `http://localhost:3000/api/health`
- Or use curl: `curl http://localhost:3000/api/health`

**What you'll see:**
```json
{
  "ok": true,
  "db": "up",
  "redis": "up" | "not_used",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

**Status codes:**
- `200` = All systems healthy
- `503` = One or more systems down

---

## 2. Request Logs (Server Console)

**Where:** Terminal where you run `pnpm dev` or `pnpm start`

**What you'll see:**
Structured JSON logs for every request:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "routeName": "POST /api/chat/messages",
  "requestId": "1705312245123-abc123",
  "method": "POST",
  "path": "/api/chat/messages",
  "statusCode": 201,
  "durationMs": 245,
  "userId": "user_123",
  "message": "Request: POST /api/chat/messages 201"
}
```

**Slow requests** (>1000ms) appear as warnings:
```json
{
  "level": "warn",
  "message": "Slow request: POST /api/ai/ticket-assistant took 1250ms",
  "durationMs": 1250
}
```

**To filter logs:**
- Look for `"level": "warn"` for slow requests
- Look for `"level": "error"` for errors
- Search for specific `requestId` to trace a request

---

## 3. Telemetry Dashboard (Admin UI)

**URL:** `http://localhost:3000/admin/telemetry`

**Access:** Admin users only

**What you'll see:**
- CPU and Memory usage
- Active socket connections
- Socket latency (p50, p95)
- Slow queries
- Top active rooms
- Messages per minute by room
- Time series charts

**How to access:**
1. Log in as an admin user
2. Navigate to `/admin/telemetry`
3. Or go to `/admin` and click "Telemetry Dashboard"

---

## 4. Error Logs (Server Console)

**Where:** Same terminal as request logs

**What you'll see:**
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "error",
  "routeName": "POST /api/chat/messages",
  "requestId": "1705312245123-abc123",
  "method": "POST",
  "path": "/api/chat/messages",
  "statusCode": 500,
  "durationMs": 120,
  "userId": "user_123",
  "error": true,
  "errorName": "DatabaseError",
  "errorMessage": "Connection timeout",
  "stack": "..."
}
```

---

## 5. Sentry Error Tracking (If Configured)

**Setup:**
1. Create account at [sentry.io](https://sentry.io)
2. Create a project
3. Get your DSN
4. Add to `.env`: `SENTRY_DSN=https://your-dsn@sentry.io/project-id`

**View errors:**
- Go to your Sentry dashboard
- Errors appear automatically when they occur
- Each error includes:
  - Request ID for correlation
  - Route name
  - User ID (if available)
  - Stack trace
  - Browser/OS info

---

## 6. Client-Side Errors (Browser Console)

**Where:** Browser DevTools (F12) → Console tab

**What you'll see:**
- In development: Full error details
- Errors caught by ErrorBoundary
- Sentry capture messages (if configured)

**ErrorBoundary UI:**
- If a component crashes, you'll see:
  - "Something went wrong" message
  - "Refresh Page" button
  - Error details (dev mode only)

---

## Quick Reference

| Feature | Location | Access |
|---------|----------|--------|
| Health Check | `/api/health` | Browser or curl |
| Request Logs | Server terminal | Watch `pnpm dev` output |
| Slow Requests | Server terminal | Look for `"level": "warn"` |
| Error Logs | Server terminal | Look for `"level": "error"` |
| Telemetry Dashboard | `/admin/telemetry` | Admin users only |
| Sentry Errors | sentry.io dashboard | If SENTRY_DSN configured |
| Client Errors | Browser console | F12 → Console |

---

## Testing Observability

### Test Health Check
```bash
curl http://localhost:3000/api/health
```

### Test Request Logging
1. Send a message in chat
2. Check server terminal for log entry
3. Look for `requestId` in the log

### Test Slow Request Detection
1. Make a request that takes >1 second
2. Check server terminal for warning log
3. Look for `"Slow request"` message

### Test Error Logging
1. Trigger an error (e.g., invalid API call)
2. Check server terminal for error log
3. Check Sentry dashboard (if configured)

### Test ErrorBoundary
1. Cause a render error in a component
2. See ErrorBoundary fallback UI
3. Check browser console for error details

---

## Tips

1. **Filter logs:** Use `grep` or search in terminal:
   ```bash
   # Watch only errors
   pnpm dev | grep '"level":"error"'
   
   # Watch only slow requests
   pnpm dev | grep "Slow request"
   ```

2. **Correlate requests:** Use `requestId` to trace a request through logs

3. **Monitor health:** Set up a monitoring tool to ping `/api/health` periodically

4. **Sentry setup:** Only works if `SENTRY_DSN` is set in `.env`

