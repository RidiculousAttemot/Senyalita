// Apply a single migration file (or a comma-separated list) by name.
// Usage: node scripts/db-apply.mjs 0009_reply_videos.sql

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const names = process.argv.slice(2);
if (names.length === 0) { console.error("Usage: node scripts/db-apply.mjs 0009_*.sql [...]"); process.exit(1); }

const url = process.env.DATABASE_URL;
if (!url) { console.error("Set DATABASE_URL"); process.exit(1); }
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const main = async () => {
  await client.connect();
  for (const name of names) {
    const sql = await readFile(join(ROOT, "supabase", "migrations", name), "utf8");
    process.stdout.write(`Applying ${name} ... `);
    try {
      await client.query(sql);
      console.log("OK");
    } catch (e) {
      console.log("FAIL:", e.message.slice(0, 200));
      process.exit(1);
    }
  }
  await client.end();
};

main().catch((e) => { console.error(e); process.exit(1); });
