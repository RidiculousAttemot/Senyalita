# Metrics Rollup Validation

## Script

`scripts/db-rollup-metrics.mjs`

## Purpose

Daily aggregate of production metrics stored in `model_metrics_daily` table.

## Fields Computed

| Field | Source | Formula |
|-------|--------|---------|
| `total_predictions` | `translation_logs` | `count(*)` |
| `avg_confidence` | `translation_logs.confidence` | `avg(confidence)` |
| `avg_inference_ms` | `translation_logs.inference_time_ms` | `avg(inference_time_ms)` |
| `avg_fps` | `translation_logs.fps` | `avg(fps)` |
| `low_confidence_count` | `translation_logs.confidence < 0.6` | `sum(case when confidence < 0.6 then 1 else 0 end)` |
| `unknown_count` | No reply selected | `sum(case when selected_reply is null and was_custom_reply = false then 1 else 0 end)` |

## Manual Execution

```bash
DATABASE_URL=postgresql://... node scripts/db-rollup-metrics.mjs
```

For a specific date:

```bash
DATABASE_URL=postgresql://... node scripts/db-rollup-metrics.mjs --date 2026-06-07
```

## Scheduled Execution

### Option A: Vercel Cron (recommended)

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/rollup-metrics",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Create API route at `src/app/api/cron/rollup-metrics/route.ts`:

```typescript
import { execSync } from "child_process";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
  try {
    execSync("node scripts/db-rollup-metrics.mjs", {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL! },
      timeout: 30000,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
};
```

### Option B: Supabase Scheduled Jobs

```sql
select cron.schedule(
  'rollup-metrics',
  '0 0 * * *',
  $$ select * from public.model_metrics_daily where day = current_date $$
);
```

> Note: Requires the `pg_cron` extension, which is available on Supabase Pro plan.

## Verification

Run the script manually and verify `model_metrics_daily` table:

```sql
SELECT * FROM model_metrics_daily ORDER BY day DESC LIMIT 7;
```

Expected output:

| day | total_predictions | avg_confidence | avg_inference_ms | low_confidence_count | unknown_count |
|-----|------------------|---------------|-----------------|---------------------|---------------|
| 2026-06-08 | 150 | 0.82 | 12.3 | 12 | 3 |
| 2026-06-07 | 200 | 0.79 | 14.1 | 25 | 8 |

## Dashboard

Metrics appear in the admin monitoring page (`/admin/monitoring`), which queries `model_metrics_daily`.
