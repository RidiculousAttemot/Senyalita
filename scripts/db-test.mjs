import pg from "pg";

const urls = [
  "postgresql://postgres.tfhpcbasfugqaimcoios:zYgBA0ti48rgRkjB@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres",
  "postgresql://postgres.tfhpcbasfugqaimcoios:zYgBA0ti48rgRkjB@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"
];

for (const url of urls) {
  process.stdout.write(`Testing ${url.replace(/:[^:@]+@/, ":***@")} ... `);
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
