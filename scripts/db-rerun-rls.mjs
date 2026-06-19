// Re-apply 0004_rls.sql after all tables exist (0008 creates transcripts).

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const url = process.env.DATABASE_URL;
if (!url) { console.error("Set DATABASE_URL"); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const main = async () => {
  await client.connect();
  const sql = await readFile(join(ROOT, "supabase", "migrations", "0004_rls.sql"), "utf8");
  process.stdout.write("Re-applying 0004_rls.sql ... ");
  try {
    await client.query(sql);
    console.log("OK");
  } catch (e) {
    console.log("FAIL:", e.message.slice(0, 200));
    process.exit(1);
  }
  await client.end();
};

main().catch((e) => { console.error(e); process.exit(1); });
