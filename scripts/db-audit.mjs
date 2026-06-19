// Pre-migration audit of the live Supabase database.
// Reports table existence, columns, indexes, RLS, policies, functions, storage.

import pg from "pg";
import { writeFile } from "node:fs/promises";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const REQUIRED = ["profiles","translation_sessions","translation_logs","transcripts","gestures","gesture_replies","feedback","model_metrics_daily"];

const q = async (sql, params = []) => (await client.query(sql, params)).rows;

const tableExists = (t) => q(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [t]).then((r) => r.length > 0);
const getColumns = (t) => q(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
const getIndexes = (t) => q(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1 ORDER BY indexname`, [t]);
const getPolicies = (t) => q(`SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename=$1 ORDER BY policyname`, [t]);
const rlsStatus = (t) => q(`SELECT relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=$1`, [t]);
const getFunctions = () => q(`SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema='public' ORDER BY routine_name`);
const getBuckets = () => q(`SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY name`);
const getStoragePolicies = () => q(`SELECT policyname, cmd, qual FROM pg_policies WHERE schemaname='storage' ORDER BY policyname`);

const main = async () => {
  await client.connect();
  const out = { timestamp: new Date().toISOString(), database: {}, functions: [], storage: { buckets: [], policies: [] } };

  out.database = {};
  for (const t of REQUIRED) {
    const exists = await tableExists(t);
    out.database[t] = {
      exists,
      columns: exists ? await getColumns(t) : [],
      indexes: exists ? await getIndexes(t) : [],
      policies: exists ? await getPolicies(t) : [],
      rls: exists ? (await rlsStatus(t))[0] ?? { rls_enabled: false, rls_forced: false } : { rls_enabled: false, rls_forced: false }
    };
  }
  out.functions = await getFunctions();
  out.storage.buckets = await getBuckets();
  out.storage.policies = await getStoragePolicies();

  await client.end();

  await writeFile("docs/database-audit.json", JSON.stringify(out, null, 2));
  console.log("Wrote docs/database-audit.json");
  console.log(JSON.stringify(out, null, 2));
};

main().catch((e) => { console.error(e); process.exit(1); });
