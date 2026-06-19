// Verify the live Supabase project via the HTTP API.

const URL = "https://tfhpcbasfugqaimcoios.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmaHBjYmFzZnVncWFpbWNvaW9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDgyNTc4NiwiZXhwIjoyMDk2NDAxNzg2fQ.-37n1ZaFkVGPiRnXdRd6bNAwmHTzL6FQ6OpC-sN1Mbc";
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
