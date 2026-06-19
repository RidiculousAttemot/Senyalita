#!/usr/bin/env node
// Daily metrics rollup for production monitoring.
//
// Reads the last 24 hours of translation_logs and computes daily aggregates:
//   - avg_confidence
//   - avg_inference_time_ms
//   - avg_fps
//   - low_confidence_rate (% below 0.6)
//   - unknown_rate (% where lookupGesture returned null)
//   - total_predictions
//
// Stores results in model_metrics_daily table.
//
// Usage:
//   DATABASE_URL=postgresql://... node scripts/db-rollup-metrics.mjs
//   DATABASE_URL=postgresql://... node scripts/db-rollup-metrics.mjs --date 2026-06-07

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required.");
  process.exit(1);
}

const TARGET_DATE = process.argv.includes("--date")
  ? process.argv[process.argv.indexOf("--date") + 1]
  : new Date().toISOString().split("T")[0];

const LOW_CONF_THRESHOLD = 0.6;

const main = async () => {
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log(`Rolling up metrics for ${TARGET_DATE}...`);

    const { rows } = await pool.query(
      `SELECT
        count(*)::int as total_predictions,
        coalesce(avg(confidence), 0)::float8 as avg_confidence,
        coalesce(avg(inference_time_ms), 0)::float8 as avg_inference_ms,
        coalesce(avg(fps), 0)::float8 as avg_fps,
        coalesce(
          sum(case when confidence < $2 then 1 else 0 end)::float8 / nullif(count(*), 0),
          0
        )::float8 as low_confidence_rate,
        coalesce(
          sum(case when selected_reply is null and was_custom_reply = false then 1 else 0 end)::float8 / nullif(count(*), 0),
          0
        )::float8 as unknown_rate
      FROM public.translation_logs
      WHERE created_at::date = $1::date`,
      [TARGET_DATE, LOW_CONF_THRESHOLD]
    );

    const row = rows[0];
    if (!row || row.total_predictions === 0) {
      console.log(`No predictions found for ${TARGET_DATE}. Nothing to record.`);
      return;
    }

    console.log(`  Predictions: ${row.total_predictions}`);
    console.log(`  Avg confidence: ${(row.avg_confidence * 100).toFixed(1)}%`);
    console.log(`  Avg inference: ${row.avg_inference_ms.toFixed(1)}ms`);
    console.log(`  Avg FPS: ${row.avg_fps.toFixed(1)}`);
    console.log(`  Low-confidence rate: ${(row.low_confidence_rate * 100).toFixed(1)}%`);
    console.log(`  Unknown rate: ${(row.unknown_rate * 100).toFixed(1)}%`);

    // Upsert into model_metrics_daily
    await pool.query(
      `INSERT INTO public.model_metrics_daily
        (day, total_predictions, low_confidence_count, unknown_count, avg_confidence, avg_inference_ms, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (day) DO UPDATE SET
        total_predictions = EXCLUDED.total_predictions,
        low_confidence_count = EXCLUDED.low_confidence_count,
        unknown_count = EXCLUDED.unknown_count,
        avg_confidence = EXCLUDED.avg_confidence,
        avg_inference_ms = EXCLUDED.avg_inference_ms,
        updated_at = now()`,
      [
        TARGET_DATE,
        row.total_predictions,
        Math.round(row.low_confidence_rate * row.total_predictions),
        Math.round(row.unknown_rate * row.total_predictions),
        row.avg_confidence,
        row.avg_inference_ms,
      ]
    );

    console.log(`Done. model_metrics_daily updated for ${TARGET_DATE}.`);
  } finally {
    await pool.end();
  }
};

main().catch((err) => {
  console.error("Rollup failed:", err.message);
  process.exit(1);
});
