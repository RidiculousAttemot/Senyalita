#!/usr/bin/env node

/**
 * export-campaign-data.mjs
 * Phase 34 — Export collected campaign data for training integration.
 *
 * Aggregates all collected campaign sessions into a unified dataset
 * ready for incremental retraining.
 *
 * Usage:
 *   node scripts/export-campaign-data.mjs [--output datasets/real_world/collected/export]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const OUTPUT = process.argv.find(a => a.startsWith("--output="))?.split("=")[1]
  ?? resolve(root, "datasets/real_world/collected/export");

const COLLECTED_DIR = resolve(root, "datasets/real_world/collected");

// ── Load all campaign sessions ─────────────────────────────────
if (!existsSync(COLLECTED_DIR)) {
  console.error("No collected data directory found.");
  process.exit(1);
}

const allSamples: Array<{
  label: string;
  signer_id: string;
  environment: string;
  repetition: number;
  captured_at: string;
  campaign: string;
  difficulty: string;
}> = [];

const campaignDirs = readdirSync(COLLECTED_DIR).filter(d => {
  const p = resolve(COLLECTED_DIR, d);
  return statSync(p).isDirectory() && d !== "export";
});

for (const dir of campaignDirs) {
  const campaignPath = resolve(COLLECTED_DIR, dir);
  const sessionFiles = readdirSync(campaignPath).filter(f => f.startsWith("session_") && f.endsWith(".json"));

  for (const file of sessionFiles) {
    try {
      const data = JSON.parse(readFileSync(resolve(campaignPath, file), "utf-8"));
      const session = data.session ?? {};
      const samples = data.samples ?? [];

      for (const sample of samples) {
        allSamples.push({
          label: sample.label ?? session.campaign,
          signer_id: sample.signer_id ?? session.signer_id ?? "unknown",
          environment: sample.environment ?? session.environment ?? "unknown",
          repetition: sample.repetition ?? 0,
          captured_at: sample.captured_at ?? session.timestamp,
          campaign: session.campaign ?? dir,
          difficulty: sample.metadata?.difficulty ?? "unknown",
        });
      }
    } catch (err) {
      console.warn(`Failed to parse ${file}: ${err instanceof Error ? err.message : "parse error"}`);
    }
  }
}

// ── Generate export ────────────────────────────────────────────
const byLabel: Record<string, typeof allSamples> = {};
for (const s of allSamples) {
  const label = s.label;
  if (!byLabel[label]) byLabel[label] = [];
  byLabel[label].push(s);
}

const exportData = {
  exported_at: new Date().toISOString(),
  total_samples: allSamples.length,
  total_signers: new Set(allSamples.map(s => s.signer_id)).size,
  total_labels: Object.keys(byLabel).length,
  campaigns: campaignDirs,
  per_label: Object.fromEntries(
    Object.entries(byLabel).map(([label, samples]) => [
      label,
      {
        count: samples.length,
        signers: [...new Set(samples.map(s => s.signer_id))].length,
        environments: [...new Set(samples.map(s => s.environment))].length,
        difficulty: samples[0]?.difficulty ?? "unknown",
      },
    ])
  ),
  samples: allSamples.map(s => ({
    label: s.label,
    signer_id: s.signer_id,
    environment: s.environment,
    captured_at: s.captured_at,
  })),
};

// Write export
if (!existsSync(OUTPUT)) mkdirSync(OUTPUT, { recursive: true });

const exportFile = resolve(OUTPUT, `campaign_export_${Date.now()}.json`);
writeFileSync(exportFile, JSON.stringify(exportData, null, 2));
console.log(`Export written: ${exportFile}`);

// ── Summary ─────────────────────────────────────────────────────
console.log(`\n=== Campaign Data Export Summary ===`);
console.log(`  Total samples:       ${allSamples.length}`);
console.log(`  Unique signers:      ${exportData.total_signers}`);
console.log(`  Unique labels:       ${exportData.total_labels}`);
console.log(`  Campaigns:           ${campaignDirs.length}`);

console.log(`\n  Per-label breakdown:`);
for (const [label, info] of Object.entries(exportData.per_label).sort((a, b) => b[1].count - a[1].count)) {
  console.log(`    ${label.padEnd(15)} ${info.count} samples, ${info.signers} signers, ${info.environments} environments`);
}

// Generate integration command
console.log(`\n  To integrate into retraining:`);
console.log(`  node scripts/incremental-retrain.mjs --include-training-samples --include-campaigns --epochs 30`);
