#!/usr/bin/env node

/**
 * apply-pending-migration.mjs
 *
 * Applies the Phase 33 database migration.
 *
 * Usage:
 *   node scripts/apply-pending-migration.mjs
 *
 * The migration SQL is output to stdout. You can also pipe it directly
 * to psql or paste into the Supabase Dashboard SQL Editor.
 *
 * Requires DATABASE_URL in the environment OR will print the SQL for manual application.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const MIGRATION = resolve(root, "supabase/migrations/0032_phase33_data_pipeline.sql");

const sql = readFileSync(MIGRATION, "utf-8");

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  // Apply via pg client
  const pg = await import("pg");
  const client = new pg.default.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Applying migration: ${MIGRATION.split("/").pop()} ...`);
  await client.query(sql);
  console.log("Migration applied successfully.");
  await client.end();
} else {
  console.log("=".repeat(60));
  console.log("No DATABASE_URL found. To apply this migration:");
  console.log("=".repeat(60));
  console.log("");
  console.log("Option 1 — Supabase Dashboard SQL Editor:");
  console.log("  1. Go to https://supabase.com/dashboard/project/tfhpcbasfugqaimcoios/sql/new");
  console.log("  2. Paste the SQL below");
  console.log("  3. Click 'Run'");
  console.log("");
  console.log("Option 2 — psql:");
  console.log("  psql \"$DATABASE_URL\" -f supabase/migrations/0032_phase33_data_pipeline.sql");
  console.log("");
  console.log("Option 3 — piped execution:");
  console.log(`  node scripts/apply-pending-migration.mjs | psql "\$DATABASE_URL"`);
  console.log("");
  console.log("=".repeat(60));
  console.log("");
  console.log(sql);
}
