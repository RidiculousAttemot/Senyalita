// Verify the SQL analytics functions return the expected JSON shape.
// Bypasses the admin guard by calling the underlying queries directly.

import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) { console.error("Set DATABASE_URL"); process.exit(1); }
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const a = await c.query(`
  select
    (select count(*) from public.gestures)                       as gesture_count,
    (select count(*) from public.gesture_replies)                as reply_count,
    (select count(*) from public.translation_logs)               as log_count,
    (select count(*) from public.translation_sessions)           as session_count,
    (select count(*) from public.feedback)                       as feedback_count,
    (select count(*) from public.model_metrics_daily)            as metrics_count
`);

console.log("Counts:", JSON.stringify(a.rows[0], null, 2));

// Inspect the gestures.status distribution
const g = await c.query(`select status, count(*) as n from public.gestures group by status order by status`);
console.log("Gestures by status:", JSON.stringify(g.rows, null, 2));

// Inspect RLS policy names
const r = await c.query(`
  select tablename, policyname, cmd
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname
`);
console.log("All RLS policies:");
for (const row of r.rows) console.log(`  ${row.tablename}.${row.policyname} [${row.cmd}]`);

await c.end();
