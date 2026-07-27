// Verify the live Supabase project via the HTTP API.
//
// Credentials come from the environment. A service-role key was previously
// hardcoded here and committed; it bypasses every RLS policy, so it must never
// live in tracked source. Reads .env.local if the vars are not already set.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    if (!process.env[key]) process.env[key] = line.slice(i + 1).trim();
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or provide .env.local).");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const j = async (p, init = {}) => {
  const r = await fetch(URL + p, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; }
  catch { return { status: r.status, body: t }; }
};

(async () => {
  console.log("--- AUTH USERS ---");
  const u = await j("/auth/v1/admin/users?per_page=10");
  console.log("status:", u.status, "count:", u.body.users?.length ?? "?", "first:", u.body.users?.[0]?.email ?? "none");

  console.log("\n--- GESTURES (PostgREST) ---");
  const g = await j("/rest/v1/gestures?select=id,label,is_active,display_order&order=display_order&limit=50");
  console.log("status:", g.status, "count:", Array.isArray(g.body) ? g.body.length : "?", "labels:", Array.isArray(g.body) ? g.body.map(x => x.label).join(",") : "");

  console.log("\n--- GESTURE_REPLIES ---");
  const r = await j("/rest/v1/gesture_replies?select=id,gesture_id,reply_text&limit=100");
  console.log("status:", r.status, "count:", Array.isArray(r.body) ? r.body.length : "?");

  console.log("\n--- VIEW: gestures_with_replies ---");
  const v = await j("/rest/v1/gestures_with_replies?select=id,label,replies&limit=3");
  console.log("status:", v.status, "sample:", Array.isArray(v.body) ? v.body.map(x => `${x.label}=${x.replies?.length ?? 0}`).join("; ") : v.body);

  console.log("\n--- STORAGE: buckets ---");
  const s = await j("/storage/v1/bucket");
  console.log("status:", s.status, "buckets:", s.body.map(b => b.name).join(", "));

  console.log("\n--- ANALYTICS (RPC) ---");
  const a = await j("/rest/v1/rpc/get_admin_analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ p_days_back: 30 })
  });
  console.log("status:", a.status, "body:", JSON.stringify(a.body, null, 2).slice(0, 800));

  console.log("\n--- MODEL METRICS (RPC) ---");
  const mm = await j("/rest/v1/rpc/get_model_metrics_daily", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ p_days_back: 30 })
  });
  console.log("status:", mm.status, "body:", JSON.stringify(mm.body, null, 2).slice(0, 400));

  console.log("\n--- NEW TABLES ---");
  const fb = await j("/rest/v1/feedback?select=id&limit=5");
  console.log("feedback rows:", Array.isArray(fb.body) ? fb.body.length : "?", "status:", fb.status);
  const md = await j("/rest/v1/model_metrics_daily?select=day,total_predictions&limit=5");
  console.log("model_metrics_daily rows:", Array.isArray(md.body) ? md.body.length : "?", "status:", md.status);

  console.log("\n--- GESTURE STATUS COLUMN ---");
  const gs = await j("/rest/v1/gestures?select=label,status&limit=3");
  console.log("status:", gs.status, "sample:", Array.isArray(gs.body) ? gs.body.map(g => g.label + "=" + g.status).join(", ") : gs.body);
})();
