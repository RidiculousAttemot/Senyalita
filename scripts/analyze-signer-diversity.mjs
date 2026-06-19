#!/usr/bin/env node

/**
 * analyze-signer-diversity.mjs
 * Phase 33 — Part C: Real Signer Diversity Tracking
 *
 * Analyzes signer diversity from translation_logs and session_diversity_metadata.
 * Outputs a diversity report identifying gaps in signer coverage.
 *
 * Usage:
 *   node scripts/analyze-signer-diversity.mjs [--days 90] [--output docs/signer-diversity-report.md]
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── Config ──────────────────────────────────────────────────────
const DAYS_BACK = parseInt(process.argv.find(a => a.startsWith("--days="))?.split("=")[1] ?? "90", 10);
const OUTPUT = process.argv.find(a => a.startsWith("--output="))?.split("=")[1]
  ?? resolve(root, "docs/signer-diversity-report.md");

// Load env
const envPath = resolve(root, ".env.local");
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl && existsSync(envPath)) {
  const env = readFileSync(envPath, "utf-8");
  for (const line of env.split("\n")) {
    const [k, ...v] = line.split("=");
    const val = v.join("=").trim().replace(/^["']|["']$/g, "");
    if (k.trim() === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = val;
    if (k.trim() === "SUPABASE_SERVICE_ROLE_KEY") supabaseKey = val;
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Helpers ─────────────────────────────────────────────────────
function section(title, level = 2) {
  return `${"#".repeat(level)} ${title}\n\n`;
}

function table(headers, rows) {
  const h = `| ${headers.join(" | ")} |\n`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |\n`;
  const r = rows.map(r => `| ${r.map(c => c ?? "—").join(" | ")} |`).join("\n");
  return h + sep + r + "\n\n";
}

function pct(a, b) {
  if (!b || b === 0) return "0.0%";
  return `${((a / b) * 100).toFixed(1)}%`;
}

// ── Analysis ────────────────────────────────────────────────────
const since = new Date();
since.setDate(since.getDate() - DAYS_BACK);
const sinceStr = since.toISOString();

console.log(`Analyzing signer diversity from ${sinceStr} (${DAYS_BACK} days)`);

const report = [`# Signer Diversity Report`, ``, `Generated: ${new Date().toISOString().slice(0, 10)}`, ``, `Period: Last ${DAYS_BACK} days`, ``, `## Summary`, ``];

// 1. Overall stats
const { count: totalLogs } = await supabase
  .from("translation_logs")
  .select("*", { count: "exact", head: true })
  .gte("created_at", sinceStr);

const { count: totalSessions } = await supabase
  .from("translation_sessions")
  .select("*", { count: "exact", head: true })
  .gte("created_at", sinceStr);

const { data: uniqueUsers } = await supabase
  .from("translation_logs")
  .select("user_id")
  .gte("created_at", sinceStr);

const uniqueSigners = new Set((uniqueUsers ?? []).map(u => u.user_id)).size;

report.push(`| Metric | Value |`);
report.push(`|--------|-------|`);
report.push(`| Total predictions | ${totalLogs ?? 0} |`);
report.push(`| Total sessions | ${totalSessions ?? 0} |`);
report.push(`| Unique signers | ${uniqueSigners} |`);
report.push(`| Period (days) | ${DAYS_BACK} |`);
report.push(``);

// 2. Session diversity metadata
const { data: diversityData } = await supabase
  .from("session_diversity_metadata")
  .select("*")
  .gte("created_at", sinceStr);

const diversity = diversityData ?? [];

// Lighting breakdown
const lightingCounts = {};
for (const d of diversity) {
  lightingCounts[d.lighting] = (lightingCounts[d.lighting] ?? 0) + 1;
}

report.push(`## Lighting Distribution\n`);
if (diversity.length > 0) {
  report.push(table(["Lighting", "Sessions", "Percentage"], Object.entries(lightingCounts).map(([k, v]) => [k, String(v), pct(v, diversity.length)])));
} else {
  report.push(`No session diversity metadata recorded yet.\n\n`);
}

// Camera angle breakdown
const angleCounts = {};
for (const d of diversity) {
  angleCounts[d.camera_angle] = (angleCounts[d.camera_angle] ?? 0) + 1;
}

report.push(`## Camera Angle Distribution\n`);
if (diversity.length > 0) {
  report.push(table(["Angle", "Sessions", "Percentage"], Object.entries(angleCounts).map(([k, v]) => [k, String(v), pct(v, diversity.length)])));
} else {
  report.push(`No camera angle metadata recorded yet.\n\n`);
}

// Background breakdown
const bgCounts = {};
for (const d of diversity) {
  bgCounts[d.background] = (bgCounts[d.background] ?? 0) + 1;
}

report.push(`## Background Distribution\n`);
if (diversity.length > 0) {
  report.push(table(["Background", "Sessions", "Percentage"], Object.entries(bgCounts).map(([k, v]) => [k, String(v), pct(v, diversity.length)])));
} else {
  report.push(`No background metadata recorded yet.\n\n`);
}

// Hand dominance
const handCounts = {};
for (const d of diversity) {
  handCounts[d.hand_dominance] = (handCounts[d.hand_dominance] ?? 0) + 1;
}

report.push(`## Hand Dominance Distribution\n`);
if (diversity.length > 0) {
  report.push(table(["Hand Dominance", "Sessions", "Percentage"], Object.entries(handCounts).map(([k, v]) => [k ?? "unknown", String(v), pct(v, diversity.length)])));
} else {
  report.push(`No hand dominance metadata recorded yet.\n\n`);
}

// 3. Environment breakdown
const envCounts = {};
for (const d of diversity) {
  envCounts[d.environment] = (envCounts[d.environment] ?? 0) + 1;
}

report.push(`## Environment Distribution\n`);
if (diversity.length > 0) {
  report.push(table(["Environment", "Sessions", "Percentage"], Object.entries(envCounts).map(([k, v]) => [k ?? "unknown", String(v), pct(v, diversity.length)])));
} else {
  report.push(`No environment metadata recorded yet.\n\n`);
}

// 4. Signer profiles
const { data: signerProfiles } = await supabase
  .from("signer_profiles")
  .select("*");

const profiles = signerProfiles ?? [];

report.push(`## Registered Signer Profiles\n`);
report.push(`Total registered signers: **${profiles.length}**\n\n`);

if (profiles.length > 0) {
  // Experience breakdown
  const expCounts = {};
  const ageCounts = {};
  const handedness = {};
  for (const p of profiles) {
    expCounts[p.signing_experience ?? "unknown"] = (expCounts[p.signing_experience ?? "unknown"] ?? 0) + 1;
    ageCounts[p.age_range ?? "unknown"] = (ageCounts[p.age_range ?? "unknown"] ?? 0) + 1;
    handedness[p.handedness ?? "unknown"] = (handedness[p.handedness ?? "unknown"] ?? 0) + 1;
  }

  report.push(`### By Signing Experience\n`);
  report.push(table(["Experience", "Count", "Percentage"], Object.entries(expCounts).map(([k, v]) => [k, String(v), pct(v, profiles.length)])));

  report.push(`### By Age Range\n`);
  report.push(table(["Age Range", "Count", "Percentage"], Object.entries(ageCounts).map(([k, v]) => [k, String(v), pct(v, profiles.length)])));

  report.push(`### By Handedness\n`);
  report.push(table(["Handedness", "Count", "Percentage"], Object.entries(handedness).map(([k, v]) => [k, String(v), pct(v, profiles.length)])));
}

// 5. Gap Analysis
report.push(`## Gap Analysis\n`);

const gaps = [];

// Lighting gaps
if (!lightingCounts["dim"]) gaps.push({ dimension: "Lighting", gap: "Dim lighting conditions — 0 sessions recorded" });
if (!lightingCounts["bright"]) gaps.push({ dimension: "Lighting", gap: "Bright lighting conditions — 0 sessions recorded" });

// Camera angle gaps
if (!angleCounts["side"]) gaps.push({ dimension: "Camera Angle", gap: "Side camera angle — 0 sessions recorded" });
if (!angleCounts["top_down"]) gaps.push({ dimension: "Camera Angle", gap: "Top-down camera angle — 0 sessions recorded" });

// Background gaps
if (!bgCounts["outdoor"]) gaps.push({ dimension: "Background", gap: "Outdoor background — 0 sessions recorded" });

// Hand dominance gaps
if (!handCounts["left"]) gaps.push({ dimension: "Hand Dominance", gap: "Left-handed signers — 0 sessions recorded" });
if (!handCounts["both"]) gaps.push({ dimension: "Hand Dominance", gap: "Ambidextrous signers — 0 sessions recorded" });

// Signer experience gaps
const hasNative = profiles.some(p => p.signing_experience === "native");
const hasBeginner = profiles.some(p => p.signing_experience === "beginner");

if (!hasBeginner) gaps.push({ dimension: "Signing Experience", gap: "Beginner signers — 0 profiles registered" });

report.push(`### Identified Gaps\n`);
if (gaps.length > 0) {
  report.push(table(["Dimension", "Gap Description"], gaps.map(g => [g.dimension, g.gap])));
} else {
  report.push(`No significant diversity gaps identified.\n\n`);
}

// 6. Recommendations
report.push(`## Recommendations\n`);
report.push(`\n`);
report.push(`1. **Increase signer count** — Target at least 10 unique signers for reliable model generalization.\n`);
report.push(`2. **Diversify lighting** — Collect samples in dim, bright, and variable lighting.\n`);
report.push(`3. **Add camera angles** — Side and top-down views improve invariance.\n`);
report.push(`4. **Include outdoor backgrounds** — Current data is predominantly indoor.\n`);
report.push(`5. **Recruit left-handed signers** — Ensures hand-dominance invariance.\n`);
report.push(`6. **Add native signers** — Currently no native signer profiles registered.\n`);
report.push(`7. **Enable diversity metadata collection** — Use the client SDK to populate \`session_diversity_metadata\` on each session.\n`);
report.push(`\n`);

// Write report
writeFileSync(OUTPUT, report.join(""), "utf-8");
console.log(`Report written to ${OUTPUT}`);
console.log(`\nFindings: ${uniqueSigners} unique signers, ${diversity.length} sessions with diversity metadata, ${profiles.length} registered profiles.`);
