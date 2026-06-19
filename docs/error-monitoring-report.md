# Error Monitoring Report

## Current State

The application currently has **no centralized error monitoring** (no Sentry, Datadog, etc.). Errors are caught at these points:

| Layer | Error Handling | Current Logging |
|-------|---------------|-----------------|
| Camera | `getCameraErrorMessage()` | Displayed in UI |
| Model load | `try/catch` in `loader.ts` | Returned as status |
| Inference | `try/catch` in `loader.ts` | Returns `null` |
| API routes | `try/catch` returning 403/500 | Response JSON |
| Supabase queries | `try/catch` in query helpers | Throws Error |
| Auth | `try/catch` in pages | Displayed in UI |

## Sentry Integration Plan

### 1. Install

```bash
npm install @sentry/nextjs
```

### 2. Configure

Create `sentry.client.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

Create `sentry.server.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

### 3. Wrap Key Operations

```typescript
// Recognition failures
try {
  const result = await infer(features);
  if (!result) {
    Sentry.captureMessage("Inference returned null", { level: "warning" });
  }
} catch (e) {
  Sentry.captureException(e);
}

// Upload failures
try {
  await uploadVideo(file);
} catch (e) {
  Sentry.captureException(e);
}

// Auth failures
Sentry.setUser({ id: userId });
```

### 4. Performance Monitoring

```typescript
// Track inference time
const transaction = Sentry.startTransaction({
  name: "inference",
  op: "model.predict",
});
// ... inference code ...
transaction.finish();
```

## Error Categories to Monitor

| Category | Events | Priority |
|----------|--------|----------|
| Camera | getUserMedia failures, permission denied | High |
| Model | Load failures, inference errors, OOM | High |
| Auth | Login failures, session expiry | Medium |
| API | Route handler exceptions, RLS violations | Medium |
| Upload | Storage bucket errors, file too large | Medium |
| Database | Query timeouts, constraint violations | Low |

## Environment Variables

Add to Vercel:

```
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_DSN=https://xxx@sentry.io/xxx
```
