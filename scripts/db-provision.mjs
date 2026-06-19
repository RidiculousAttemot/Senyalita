// One-off script: audit the live Supabase database, apply any missing
// migrations from supabase/migrations/, and verify RLS, indexes, and
// the gesture seed. Run with: node scripts/db-provision.mjs

import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL (e.g. postgresql://postgres:[PASSWORD]@db.tfhpcbasfugqaimcoios.supabase.co:5432/postgres) before running this script.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const REQUIRED_TABLES = [
  "profiles",
  "translation_sessions",
  "translation_logs",
  "transcripts",
  "gestures",
  "gesture_replies"
];

const REQUIRED_INDEXES = {
  profiles: ["profiles_pkey"],
  translation_sessions: ["translation_sessions_pkey"],
  translation_logs: ["translation_logs_pkey"],
  transcripts: ["transcripts_pkey"],
  gestures: ["gestures_pkey"],
  gesture_replies: ["gesture_replies_pkey"]
};

const queryAsJson = async (sql, params = []) => {
  const { rows } = await client.query(sql, params);
  return rows;
};

const tableExists = async (table) => {
  const rows = await queryAsJson(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return rows.length > 0;
};

const getColumns = async (table) => {
  return queryAsJson(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
};

const getIndexes = async (table) => {
  return queryAsJson(
    `SELECT indexname, indexdef FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = $1`,
    [table]
  );
};

const getPolicies = async (table) => {
  return queryAsJson(
    `SELECT policyname, cmd, qual, with_check
     FROM pg_policies
     WHERE schemaname = 'public' AND tablename = $1`,
    [table]
  );
};

const rlsEnabled = async (table) => {
  const rows = await queryAsJson(
    `SELECT relrowsecurity, relforcerowsecurity
     FROM pg_class
     WHERE relname = $1 AND relnamespace = 'public'::regnamespace`,
    [table]
  );
  return rows[0] ?? { relrowsecurity: false, relforcerowsecurity: false };
};

const getFunctions = async () => {
  return queryAsJson(
    `SELECT routine_name FROM information_schema.routines
     WHERE routine_schema = 'public'
     AND routine_name IN ('promote_user','demote_user','get_admin_analytics','is_admin','sync_transcript_user','handle_new_user')`
  );
};

const getStorageBuckets = async () => {
  return queryAsJson(
    `SELECT id, name, public, file_size_limit, allowed_mime_types
     FROM storage.buckets`
  );
};

const audit = async () => {
  const report = { tables: {}, indexes: {}, rls: {}, policies: {}, functions: [], buckets: [] };
  for (const table of REQUIRED_TABLES) {
    const exists = await tableExists(table);
    report.tables[table] = { exists, columns: exists ? await getColumns(table) : [] };
    report.indexes[table] = exists ? await getIndexes(table) : [];
    report.rls[table] = exists ? await rlsEnabled(table) : { relrowsecurity: false, relforcerowsecurity: false };
    report.policies[table] = exists ? await getPolicies(table) : [];
  }
  report.functions = (await getFunctions()).map((r) => r.routine_name);
  report.buckets = await getStorageBuckets();
  return report;
};

const applyMigrations = async () => {
  const migrationsDir = join(ROOT, "supabase", "migrations");
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  const log = [];
  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), "utf8");
    try {
      await client.query(sql);
      log.push({ file, ok: true });
    } catch (err) {
      log.push({ file, ok: false, error: err.message });
    }
  }
  return log;
};

const rowCount = async (table) => {
  if (!(await tableExists(table))) return null;
  const { rows } = await client.query(`SELECT count(*)::int AS n FROM public.${table}`);
  return rows[0].n;
};

const main = async () => {
  console.log("Connecting...");
  await client.connect();
  console.log("Connected.\n");

  console.log("=== PRE-MIGRATION AUDIT ===");
  const pre = await audit();
  console.log(JSON.stringify(pre, null, 2));

  console.log("\n=== APPLYING MIGRATIONS ===");
  const log = await applyMigrations();
  for (const entry of log) {
    console.log(`  ${entry.ok ? "✓" : "✗"} ${entry.file}${entry.error ? " — " + entry.error : ""}`);
  }

  console.log("\n=== POST-MIGRATION AUDIT ===");
  const post = await audit();
  console.log(JSON.stringify(post, null, 2));

  console.log("\n=== ROW COUNTS ===");
  for (const t of REQUIRED_TABLES) {
    const n = await rowCount(t);
    console.log(`  ${t}: ${n}`);
  }

  await client.end();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
