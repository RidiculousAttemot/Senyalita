// Connectivity smoke test for the Supabase Postgres endpoint.
//
// The connection string comes from DATABASE_URL. Two live credentials were
// previously hardcoded here and committed to git; connection strings embed the
// database password, so they must never live in tracked source.
//
// Usage:
//   node scripts/db-test.mjs          # reads DATABASE_URL (or .env.local)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(ROOT, ".env.local");
if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  const m = fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.*)$/m);
  if (m) process.env.DATABASE_URL = m[1].trim();
}

const base = process.env.DATABASE_URL;
if (!base) {
  console.error("Set DATABASE_URL (or add it to .env.local) before running this script.");
  process.exit(1);
}

// Session mode (5432) handles DDL; transaction mode (6543) is fine for queries.
// Try whichever port was supplied first, then the other.
const urls = [base];
if (base.includes(":5432/")) urls.push(base.replace(":5432/", ":6543/"));
else if (base.includes(":6543/")) urls.push(base.replace(":6543/", ":5432/"));

const redact = (u) => u.replace(/:[^:@/]+@/, ":***@");

for (const url of urls) {
  process.stdout.write(`Testing ${redact(url)} ... `);
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    await c.connect();
    const r = await c.query("select current_database() as db, current_user as u, version() as v");
    console.log("OK");
    console.log("  db:", r.rows[0].db);
    console.log("  user:", r.rows[0].u);
    console.log("  version:", r.rows[0].v.slice(0, 60));
    await c.end();
    process.exit(0);
  } catch (e) {
    console.log("FAIL:", e.code, e.message.slice(0, 100));
    try { await c.end(); } catch {}
  }
}
process.exit(1);
