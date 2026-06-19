import pg from "pg";

const hosts = [];
for (const prefix of ["aws-0-", "aws-1-"]) {
  for (const region of ["us-east-1","us-east-2","us-west-1","us-west-2","eu-west-1","eu-west-2","eu-central-1","eu-north-1","ap-southeast-1","ap-southeast-2","ap-northeast-1","ap-northeast-2","ap-south-1","sa-east-1","ca-central-1"]) {
    hosts.push(`${prefix}${region}.pooler.supabase.com`);
  }
}

let tried = 0;
for (const h of hosts) {
  for (const port of [5432, 6543]) {
    const url = `postgresql://postgres.tfhpcbasfugqaimcoios:${process.env.DB_PASSWORD}@${h}:${port}/postgres`;
    tried += 1;
    const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 3000 });
    try {
      await c.connect();
      const x = await c.query("select 1 as ok, current_database() as db");
      console.log(`OK ${h}:${port}`, x.rows[0]);
      await c.end();
      process.exit(0);
    } catch (e) {
      const msg = e.message.slice(0, 60);
      if (!msg.includes("not found")) {
        process.stdout.write(`? ${h}:${port} ${e.code} ${msg}\n`);
      }
    } finally {
      try { await c.end(); } catch {}
    }
  }
}
console.log(`Tried ${tried} combinations, none worked`);
process.exit(1);
