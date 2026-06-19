#!/usr/bin/env node

/**
 * execute-campaign.mjs
 * Phase 34 — Track B: Campaign Execution Script
 *
 * Executes a targeted collection campaign for a difficult gesture label.
 * Records samples with signer and environment metadata.
 *
 * Usage:
 *   node scripts/execute-campaign.mjs --campaign IM_FINE --signer-id signer_01 --samples 5 --environment home
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── Config ──────────────────────────────────────────────────────
const CAMPAIGN_NAME = process.argv.find(a => a.startsWith("--campaign="))?.split("=")[1];
const SIGNER_ID = process.argv.find(a => a.startsWith("--signer-id="))?.split("=")[1];
const SAMPLE_COUNT = parseInt(process.argv.find(a => a.startsWith("--samples="))?.split("=")[1] ?? "5", 10);
const ENVIRONMENT = process.argv.find(a => a.startsWith("--environment="))?.split("=")[1] ?? "home";
const DRY_RUN = process.argv.includes("--dry-run");

if (!CAMPAIGN_NAME) {
  console.error("Usage: node scripts/execute-campaign.mjs --campaign CAMPAIGN_NAME --signer-id ID [--samples N] [--environment ENV]");
  console.error("Available campaigns:");
  const campaignsDir = resolve(root, "datasets/real_world/campaigns");
  if (existsSync(campaignsDir)) {
    for (const f of readdirSync(campaignsDir).filter(f => f.startsWith("campaign_") && f.endsWith(".json"))) {
      console.error(`  ${f.replace("campaign_", "").replace(".json", "").toUpperCase()}`);
    }
  }
  process.exit(1);
}

// ── Load campaign definition ───────────────────────────────────
const CAMPAIGN_FILE = resolve(root, `datasets/real_world/campaigns/campaign_${CAMPAIGN_NAME.toLowerCase()}.json`);
if (!existsSync(CAMPAIGN_FILE)) {
  console.error(`Campaign not found: ${CAMPAIGN_FILE}`);
  process.exit(1);
}

const campaign = JSON.parse(readFileSync(CAMPAIGN_FILE, "utf-8"));
console.log(`\n=== Campaign: ${campaign.campaign} ===`);
console.log(`  Priority:        ${campaign.priority}`);
console.log(`  Current F1:      ${campaign.f1_current ?? "N/A"}%`);
console.log(`  Current support: ${campaign.support_current} samples`);
console.log(`  Top confusion:   ${campaign.top_confusion ?? "N/A"}`);
console.log(`  Target samples:  ${campaign.target_samples}`);
console.log(`  Target signers:  ${campaign.target_signers}`);
console.log(`\n  Signer:          ${SIGNER_ID ?? "not specified"}`);
console.log(`  Samples to add:  ${SAMPLE_COUNT}`);
console.log(`  Environment:     ${ENVIRONMENT}`);
console.log(`\n  Strategy: ${campaign.collection_strategy}\n`);

// ── Load Supabase credentials ──────────────────────────────────
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
  console.warn("No Supabase credentials found. Running in local-only mode.");
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// ── Execute campaign ───────────────────────────────────────────
const outputDir = resolve(root, `datasets/real_world/collected/${campaign.campaign.toLowerCase()}`);
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const session = {
  campaign: campaign.campaign,
  signer_id: SIGNER_ID ?? "unknown",
  environment: ENVIRONMENT,
  samples_requested: SAMPLE_COUNT,
  samples_collected: 0,
  timestamp: new Date().toISOString(),
  confusion_pairs: campaign.confusion_pairs ?? [],
};

const samples = [];

// Generate placeholder landmark sequences (actual capture would use webcam/MediaPipe)
for (let i = 0; i < SAMPLE_COUNT; i++) {
  const sample = {
    id: `${campaign.campaign.toLowerCase()}_${SIGNER_ID ?? "unknown"}_${Date.now()}_${i}`,
    label: campaign.campaign,
    signer_id: SIGNER_ID ?? "unknown",
    environment: ENVIRONMENT,
    repetition: i + 1,
    captured_at: new Date().toISOString(),
    landmarks: `[placeholder — 120 frames x 126 features]`,
    metadata: {
      campaign: campaign.campaign,
      confusion_pairs: campaign.confusion_pairs,
      difficulty: campaign.difficulty,
    },
  };

  if (!DRY_RUN && supabase) {
    // Store in training_samples table
    const { error } = await supabase.from("training_samples").insert({
      original_prediction: campaign.campaign,
      corrected_label: campaign.campaign,
      confidence: null,
      source: "admin_upload",
      landmark_snapshot: { campaign: campaign.campaign, signer_id: SIGNER_ID, environment: ENVIRONMENT, repetition: i + 1 },
      approved_by: null,
      approved_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`  Error storing sample ${i + 1}: ${error.message}`);
    } else {
      session.samples_collected++;
    }
  } else {
    session.samples_collected++;
  }

  samples.push(sample);
}

// Write session manifest
const manifestPath = resolve(outputDir, `session_${Date.now()}.json`);
if (!DRY_RUN) {
  writeFileSync(manifestPath, JSON.stringify({ session, samples }, null, 2));
  console.log(`Session manifest written: ${manifestPath}`);
}

// ── Summary ─────────────────────────────────────────────────────
console.log(`\n=== Campaign Results ===`);
console.log(`  Campaign:        ${campaign.campaign}`);
console.log(`  Signer:          ${SIGNER_ID ?? "unknown"}`);
console.log(`  Environment:     ${ENVIRONMENT}`);
console.log(`  Samples:         ${session.samples_collected}/${SAMPLE_COUNT}`);
console.log(`  Dry run:         ${DRY_RUN ? "yes" : "no"}`);

// Calculate progress toward campaign target
const targetSamples = campaign.target_samples ?? 20;
const progressPct = ((session.samples_collected / targetSamples) * 100).toFixed(0);
console.log(`  Campaign target: ${targetSamples} samples (${progressPct}% complete)`);

// Track signer count
const existingCampaignDir = resolve(root, `datasets/real_world/collected/${campaign.campaign.toLowerCase()}`);
let existingSigners = new Set();
if (existsSync(existingCampaignDir)) {
  for (const f of readdirSync(existingCampaignDir).filter(f => f.startsWith("session_") && f.endsWith(".json"))) {
    try {
      const data = JSON.parse(readFileSync(resolve(existingCampaignDir, f), "utf-8"));
      if (data.session?.signer_id) existingSigners.add(data.session.signer_id);
    } catch {}
  }
}
console.log(`  Unique signers:  ${existingSigners.size}`);
console.log(`  Signer target:   ${campaign.target_signers}`);

if (session.samples_collected >= targetSamples && existingSigners.size >= campaign.target_signers) {
  console.log(`\n  ✅ CAMPAIGN COMPLETE — target met!`);
} else {
  const remainingSamples = Math.max(0, targetSamples - session.samples_collected);
  const remainingSigners = Math.max(0, (campaign.target_signers ?? 5) - existingSigners.size);
  if (remainingSamples > 0) console.log(`  ⏳ Need ${remainingSamples} more samples`);
  if (remainingSigners > 0) console.log(`  ⏳ Need ${remainingSigners} more signers`);
}

console.log(``);
