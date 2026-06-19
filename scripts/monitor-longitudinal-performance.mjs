#!/usr/bin/env node

/**
 * monitor-longitudinal-performance.mjs
 * Phase 33 — Part H: Longitudinal Performance Monitoring
 *
 * Tracks daily confidence, failure rate, correction rate, and conversation success rate.
 * Generates trend visualizations and a performance report.
 *
 * Usage:
 *   node scripts/monitor-longitudinal-performance.mjs [--days 30] [--output docs/longitudinal-performance-report.md]
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── Config ──────────────────────────────────────────────────────
const DAYS = parseInt(process.argv.find(a => a.startsWith("--days="))?.split("=")[1] ?? "30", 10);
const OUTPUT = process.argv.find(a => a.startsWith("--output="))?.split("=")[1]
  ?? resolve(root, "docs/longitudinal-performance-report.md");

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
function pct(a, b) {
  if (!b || b === 0) return "0.0%";
  return `${((a / b) * 100).toFixed(1)}%`;
}

function sparkbar(values, width = 20) {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  if (max === 0) return "·".repeat(width);
  return values.map(v => {
    const bars = Math.round((v / max) * width);
    return "█".repeat(Math.max(1, bars));
  }).join("");
}

// ── Fetch Data ─────────────────────────────────────────────────
console.log(`Fetching longitudinal performance data for last ${DAYS} days...`);

const since = new Date();
since.setDate(since.getDate() - DAYS);
const sinceStr = since.toISOString();

// 1. Daily translation logs aggregations
const { data: logs } = await supabase
  .from("translation_logs")
  .select("created_at, confidence, inference_time_ms")
  .gte("created_at", sinceStr)
  .order("created_at");

// 2. Daily corrections
const { data: corrections } = await supabase
  .from("prediction_corrections")
  .select("created_at")
  .gte("created_at", sinceStr);

// 3. Daily conversation sessions
const { data: conversations } = await supabase
  .from("conversation_sessions")
  .select("created_at, communication_success")
  .gte("created_at", sinceStr);

// 4. Daily performance metrics from table
const { data: storedMetrics } = await supabase
  .from("daily_performance_metrics")
  .select("*")
  .gte("day", sinceStr.slice(0, 10))
  .order("day");

// ── Aggregate by day ────────────────────────────────────────────
const dayBuckets = {};
for (let i = 0; i < DAYS; i++) {
  const d = new Date(since);
  d.setDate(d.getDate() + i);
  const key = d.toISOString().slice(0, 10);
  dayBuckets[key] = {
    predictions: 0,
    confidences: [],
    inferenceTimes: [],
    corrections: 0,
    conversations: 0,
    successfulConversations: 0,
  };
}

for (const log of logs ?? []) {
  const key = log.created_at.slice(0, 10);
  if (dayBuckets[key]) {
    dayBuckets[key].predictions++;
    if (log.confidence != null) dayBuckets[key].confidences.push(log.confidence);
    if (log.inference_time_ms != null) dayBuckets[key].inferenceTimes.push(log.inference_time_ms);
  }
}

for (const c of corrections ?? []) {
  const key = c.created_at.slice(0, 10);
  if (dayBuckets[key]) dayBuckets[key].corrections++;
}

for (const conv of conversations ?? []) {
  const key = conv.created_at.slice(0, 10);
  if (dayBuckets[key]) {
    dayBuckets[key].conversations++;
    if (conv.communication_success) dayBuckets[key].successfulConversations++;
  }
}

// ── Compute daily metrics ──────────────────────────────────────
const days = Object.keys(dayBuckets).sort();
const metrics = days.map(day => {
  const b = dayBuckets[day];
  const avgConf = b.confidences.length > 0
    ? b.confidences.reduce((s, v) => s + v, 0) / b.confidences.length
    : null;
  const avgInf = b.inferenceTimes.length > 0
    ? b.inferenceTimes.reduce((s, v) => s + v, 0) / b.inferenceTimes.length
    : null;
  const lowConfRate = b.confidences.length > 0
    ? b.confidences.filter(c => c < 0.6).length / b.confidences.length
    : null;
  const correctionRate = b.predictions > 0 ? b.corrections / b.predictions : null;
  const convSuccessRate = b.conversations > 0 ? b.successfulConversations / b.conversations : null;

  return { day, ...b, avgConf, avgInf, lowConfRate, correctionRate, convSuccessRate };
});

// ── Compute totals ──────────────────────────────────────────────
const totalPredictions = metrics.reduce((s, m) => s + m.predictions, 0);
const totalCorrections = metrics.reduce((s, m) => s + m.corrections, 0);
const totalConversations = metrics.reduce((s, m) => s + m.conversations, 0);
const avgConfOverall = metrics.filter(m => m.avgConf !== null).reduce((s, m) => s + m.avgConf!, 0)
  / metrics.filter(m => m.avgConf !== null).length;

const daysWithData = metrics.filter(m => m.predictions > 0);

// ── Generate Report ────────────────────────────────────────────
const report = [];

report.push(`# Longitudinal Performance Report`);
report.push(``);
report.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
report.push(`Period: Last ${DAYS} days (${days[0]} to ${days[days.length - 1]})`);
report.push(``);

// Summary
report.push(`## Summary\n`);
report.push(`| Metric | Value |`);
report.push(`|--------|-------|`);
report.push(`| Total predictions | ${totalPredictions} |`);
report.push(`| Days with data | ${daysWithData.length} / ${DAYS} |`);
report.push(`| Average daily predictions | ${daysWithData.length > 0 ? Math.round(totalPredictions / daysWithData.length) : 0} |`);
report.push(`| Average confidence | ${avgConfOverall ? `${(avgConfOverall * 100).toFixed(1)}%` : "—"} |`);
report.push(`| Total corrections | ${totalCorrections} |`);
report.push(`| Overall correction rate | ${pct(totalCorrections, totalPredictions)} |`);
report.push(`| Total conversations | ${totalConversations} |`);
report.push(`| Stored metric days | ${storedMetrics?.length ?? 0} |`);
report.push(``);

// Daily trend
report.push(`## Daily Trends\n`);
report.push(`| Day | Predictions | Avg Conf | Low Conf% | Correction% | Conv Success% |`);
report.push(`|-----|:----------:|:--------:|:---------:|:----------:|:------------:|`);

for (const m of metrics.slice(-14)) { // Last 14 days
  if (m.predictions === 0) continue;
  report.push(`| ${m.day.slice(5)} | ${m.predictions} | ${m.avgConf ? `${(m.avgConf * 100).toFixed(1)}%` : "—"} | ${m.lowConfRate !== null ? `${(m.lowConfRate * 100).toFixed(1)}%` : "—"} | ${m.correctionRate !== null ? `${(m.correctionRate * 100).toFixed(1)}%` : "—"} | ${m.convSuccessRate !== null ? `${(m.convSuccessRate * 100).toFixed(1)}%` : "—"} |`);
}

report.push(``);

// Confusion trend
const confValues = metrics.filter(m => m.avgConf !== null).map(m => m.avgConf!);
if (confValues.length > 1) {
  const firstHalf = confValues.slice(0, Math.floor(confValues.length / 2));
  const secondHalf = confValues.slice(Math.floor(confValues.length / 2));
  const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
  const trend = avgSecond > avgFirst ? "↑ improving" : avgSecond < avgFirst ? "↓ declining" : "→ stable";

  report.push(`## Confidence Trend\n`);
  report.push(`| Period | Avg Confidence |`);
  report.push(`|--------|:-------------:|`);
  report.push(`| First half | ${(avgFirst * 100).toFixed(1)}% |`);
  report.push(`| Second half | ${(avgSecond * 100).toFixed(1)}% |`);
  report.push(`| Trend | ${trend} |`);
  report.push(``);
}

// Failure rate trend
const failureRates = metrics.filter(m => m.lowConfRate !== null).map(m => m.lowConfRate!);
if (failureRates.length > 1) {
  const avgFailRate = failureRates.reduce((s, v) => s + v, 0) / failureRates.length;
  report.push(`## Low Confidence Analysis\n`);
  report.push(`| Metric | Value |`);
  report.push(`|--------|-------|`);
  report.push(`| Average low-confidence rate | ${(avgFailRate * 100).toFixed(1)}% |`);
  report.push(`| Low-confidence days (>10%) | ${failureRates.filter(r => r > 0.10).length} / ${failureRates.length} |`);
  report.push(``);
}

// Correction rate trend
const corrRates = metrics.filter(m => m.correctionRate !== null).map(m => m.correctionRate!);
if (corrRates.length > 1) {
  const avgCorrRate = corrRates.reduce((s, v) => s + v, 0) / corrRates.length;
  report.push(`## Correction Rate Analysis\n`);
  report.push(`| Metric | Value |`);
  report.push(`|--------|-------|`);
  report.push(`| Average correction rate | ${(avgCorrRate * 100).toFixed(2)}% |`);
  report.push(`| High-correction days (>5%) | ${corrRates.filter(r => r > 0.05).length} / ${corrRates.length} |`);
  report.push(``);
}

// Conversation success rate trend
const convRates = metrics.filter(m => m.convSuccessRate !== null).map(m => m.convSuccessRate!);
if (convRates.length > 1) {
  const avgConvRate = convRates.reduce((s, v) => s + v, 0) / convRates.length;
  report.push(`## Conversation Success Rate\n`);
  report.push(`| Metric | Value |`);
  report.push(`|--------|-------|`);
  report.push(`| Average conversation success | ${(avgConvRate * 100).toFixed(1)}% |`);
  report.push(`| Days with conversations | ${convRates.filter(r => r !== null).length} / ${metrics.length} |`);
  report.push(``);
}

// Inference time trend
const infTimes = metrics.filter(m => m.avgInf !== null).map(m => m.avgInf!);
if (infTimes.length > 1) {
  const avgInfTime = infTimes.reduce((s, v) => s + v, 0) / infTimes.length;
  report.push(`## Inference Time\n`);
  report.push(`| Metric | Value |`);
  report.push(`|--------|-------|`);
  report.push(`| Average inference time | ${avgInfTime.toFixed(2)}ms |`);
  report.push(`| Fastest day | ${Math.min(...infTimes).toFixed(2)}ms |`);
  report.push(`| Slowest day | ${Math.max(...infTimes).toFixed(2)}ms |`);
  report.push(``);
}

// ═══════════════════════════════════════════════════════════════
// VISUALIZATIONS (text-based sparklines)
// ═══════════════════════════════════════════════════════════════
report.push(`## Trend Visualizations\n`);

// Daily predictions sparkline
if (metrics.some(m => m.predictions > 0)) {
  const predValues = metrics.map(m => m.predictions);
  report.push(`### Daily Predictions (${DAYS}-day)\n`);
  report.push(`\`\`\`\n${sparkbar(predValues, 40)}\n\`\`\`\n`);
  report.push(`Range: ${Math.min(...predValues.filter(v => v > 0))} – ${Math.max(...predValues)} / day\n\n`);
}

// Avg confidence sparkline
if (confValues.length > 0) {
  report.push(`### Average Confidence (${DAYS}-day)\n`);
  const confPct = confValues.map(c => Math.round(c * 100));
  report.push(`\`\`\`\n${sparkbar(confPct, 40)}\n\`\`\`\n`);
  report.push(`Range: ${Math.min(...confPct)}% – ${Math.max(...confPct)}%\n\n`);
}

// Low confidence rate sparkline
if (failureRates.length > 0) {
  report.push(`### Low Confidence Rate (${DAYS}-day)\n`);
  const failPct = failureRates.map(r => Math.round(r * 100));
  report.push(`\`\`\`\n${sparkbar(failPct, 40)}\n\`\`\`\n`);
  report.push(`Range: ${Math.min(...failPct)}% – ${Math.max(...failPct)}%\n\n`);
}

// ═══════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════
report.push(`## Recommendations\n`);

const issues = [];
if (avgConfOverall !== null && avgConfOverall < 0.85) {
  issues.push("Average confidence below 85% — investigate low-confidence predictions and increase data diversity.");
}
if (corrRates.length > 0 && avgCorrRate > 0.05) {
  issues.push(`Correction rate at ${(avgCorrRate * 100).toFixed(1)}% — target below 5%. Run difficult gesture campaigns.`);
}
if (convRates.length > 0 && avgConvRate < 0.80) {
  issues.push(`Conversation success rate at ${(avgConvRate * 100).toFixed(1)}% — target above 80%.`);
}
if (daysWithData.length < DAYS * 0.5) {
  issues.push(`Low data coverage (${daysWithData.length}/${DAYS} days with data) — increase usage or check data pipeline.`);
}
if (storedMetrics && storedMetrics.length < 7) {
  issues.push(`Only ${storedMetrics?.length ?? 0} stored metric days — run \`aggregate_daily_performance()\` regularly.`);
}

if (issues.length > 0) {
  for (const issue of issues) {
    report.push(`- ⚠ ${issue}`);
  }
} else {
  report.push("- All metrics within acceptable range. Continue monitoring.\n");
}

report.push(``);
report.push(`## Automated Aggregation\n`);
report.push(`To populate \`daily_performance_metrics\`, run:`);
report.push(`\`\`\`sql`);
report.push(`SELECT public.aggregate_daily_performance('YYYY-MM-DD'::date);`);
report.push(`\`\`\``);
report.push(`Or automate with a daily cron job.`);
report.push(``);

// Write report
writeFileSync(OUTPUT, report.join("\n"), "utf-8");
console.log(`Report written to ${OUTPUT}`);

// Print summary
console.log(`\nSummary:`);
console.log(`  Predictions: ${totalPredictions}`);
console.log(`  Avg confidence: ${avgConfOverall ? `${(avgConfOverall * 100).toFixed(1)}%` : "—"}`);
console.log(`  Correction rate: ${pct(totalCorrections, totalPredictions)}`);
console.log(`  Conversations: ${totalConversations}`);
console.log(`  Days with data: ${daysWithData.length}/${DAYS}`);
