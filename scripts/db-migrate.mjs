// Apply all .sql files in supabase/migrations/ in numeric order, idempotently.

import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const url = process.env.DATABASE_URL;
if (!url) { console.error("Set DATABASE_URL"); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
const log = [];

const main = async () => {
  await client.connect();
  const dir = join(ROOT, "supabase", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(join(dir, file), "utf8");
    process.stdout.write(`  ${file} ... `);
    try {
      await client.query(sql);
      console.log("OK");
      log.push({ file, status: "ok" });
    } catch (e) {
      console.log("FAIL");
      console.log("    ", e.message.slice(0, 200));
      log.push({ file, status: "fail", error: e.message });
    }
  }
  await client.end();
  await writeFile(join(ROOT, "scripts", "db-migrate-log.json"), JSON.stringify(log, null, 2));
  const failed = log.filter((l) => l.status === "fail");
  if (failed.length) {
    console.log(`\n${failed.length} migration(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${log.length} migration(s) applied.`);
};

import { writeFile } from "node:fs/promises";
main().catch((e) => { console.error(e); process.exit(1); });
