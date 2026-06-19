#!/usr/bin/env node

/**
 * incremental-retrain.mjs
 * Phase 33 — Part F: Incremental Retraining Pipeline
 *
 * Supports:
 *  - Current production dataset (fsl_unified)
 *  - Approved review samples from review_queue → training_samples
 *  - New real-world collections from datasets/real_world/
 *
 * Retrains the BiLSTM v1 architecture without rebuilding the entire pipeline.
 *
 * Usage:
 *   node scripts/incremental-retrain.mjs [options]
 *
 * Options:
 *   --include-training-samples   Include approved training_samples from review queue
 *   --include-campaigns          Include datasets/real_world/campaigns data
 *   --dry-run                    Preview what would be included without training
 *   --version                    Output dataset version string (e.g., 1.1.0)
 *   --output-dir                 Output directory for retrained model
 *   --epochs                     Training epochs (default: 30)
 *   --lr                         Learning rate (default: 0.002)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── Config ──────────────────────────────────────────────────────
const FLAGS = {
  includeTrainingSamples: process.argv.includes("--include-training-samples"),
  includeCampaigns: process.argv.includes("--include-campaigns"),
  dryRun: process.argv.includes("--dry-run"),
};

const EPOCHS = parseInt(process.argv.find(a => a.startsWith("--epochs="))?.split("=")[1] ?? "30", 10);
const LR = parseFloat(process.argv.find(a => a.startsWith("--lr="))?.split("=")[1] ?? "0.002");
const OUTPUT_DIR = process.argv.find(a => a.startsWith("--output-dir="))?.split("=")[1]
  ?? resolve(root, "models/fsl_unified_retrained");
const VERSION_OVERRIDE = process.argv.find(a => a.startsWith("--version="))?.split("=")[1];

// Paths
const PRODUCTION_DATASET_DIR = resolve(root, "datasets/processed/fsl_unified");
const PRODUCTION_MODEL_CONFIG = resolve(root, "models/fsl_unified/bilstm/config.json");
const PRODUCTION_LABELS = resolve(root, "models/fsl_unified/bilstm/labels.json");
const CAMPAIGNS_DIR = resolve(root, "datasets/real_world/campaigns");
const TRAINING_SCRIPT = resolve(root, "scripts/train-unified-bilstm.mjs");

// ── Helpers ─────────────────────────────────────────────────────
function log(msg) {
  console.log(`[incremental-retrain] ${msg}`);
}

function loadJSON(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { recursive: true }).filter(f => f.endsWith(".json")).length;
}

// ── Phase 1: Load current production dataset info ──────────────
log("=== Phase 33 Incremental Retraining Pipeline ===");
log(`Epochs: ${EPOCHS}, LR: ${LR}, Output: ${OUTPUT_DIR}`);

const config = loadJSON(PRODUCTION_MODEL_CONFIG);
const labels = loadJSON(PRODUCTION_LABELS);

if (config) {
  log(`Production model: ${config.model_type ?? "BiLSTM"}, ${labels?.length ?? 133} classes`);
}

let productionSamples = 0;
if (existsSync(PRODUCTION_DATASET_DIR)) {
  productionSamples = countFiles(PRODUCTION_DATASET_DIR);
  log(`Production dataset: ~${productionSamples} samples`);
}

// ── Phase 2: Load approved training samples from DB ────────────
let approvedSamples = 0;
let approvedByLabel = {};

if (FLAGS.includeTrainingSamples) {
  log("Fetching approved training samples from database...");

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

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("training_samples")
      .select("*")
      .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString());

    if (error) {
      log(`Error fetching training samples: ${error.message}`);
    } else if (data) {
      approvedSamples = data.length;
      approvedByLabel = {};
      for (const s of data) {
        const label = s.corrected_label ?? s.original_prediction;
        approvedByLabel[label] = (approvedByLabel[label] ?? 0) + 1;
      }
      log(`Found ${approvedSamples} approved training samples across ${Object.keys(approvedByLabel).length} labels`);
    }
  } else {
    log("No Supabase credentials found. Skipping training samples fetch.");
  }
} else {
  log("Skipping training samples (use --include-training-samples to include)");
}

// ── Phase 3: Load campaign data ────────────────────────────────
let campaignSamples = 0;
let campaignLabels = [];

if (FLAGS.includeCampaigns) {
  log("Loading campaign data from datasets/real_world/campaigns/...");

  if (existsSync(CAMPAIGNS_DIR)) {
    const files = readdirSync(CAMPAIGNS_DIR)
      .filter(f => f.startsWith("campaign_") && f.endsWith(".json"));

    for (const file of files) {
      const campaign = loadJSON(resolve(CAMPAIGNS_DIR, file));
      if (campaign) {
        campaignLabels.push(campaign.campaign);
        campaignSamples += campaign.target_samples ?? 20;
        log(`  Campaign ${campaign.campaign}: target ${campaign.target_samples} samples`);
      }
    }
  } else {
    log("Campaigns directory not found.");
  }
} else {
  log("Skipping campaigns (use --include-campaigns to include)");
}

// ── Phase 4: Print summary ─────────────────────────────────────
const totalNewSamples = approvedSamples + campaignSamples;
const totalAllSamples = productionSamples + totalNewSamples;

log("\n=== Dataset Composition ===");
log(`  Production dataset:     ${productionSamples}`);
log(`  Approved training:      ${approvedSamples}`);
log(`  Campaign target:        ${campaignSamples}`);
log(`  ─────────────────────────`);
log(`  Total for retraining:   ${totalAllSamples}`);

// Compute version
const currentVersion = VERSION_OVERRIDE ?? `1.${Math.floor(totalNewSamples / 500)}.${totalNewSamples % 500}`;
log(`\nTarget dataset version: ${currentVersion}`);

// Status by label (focusing on low-F1 labels)
const lowF1Labels = ["IM FINE", "RED", "SEVEN", "APRIL", "JANUARY", "JULY", "FATHER", "MOTHER", "FOUR", "NINE", "BLUE"];
const alphabetDifficult = ["V", "U", "M", "N", "D", "P", "Q"];

log("\n=== Low-F1 Label Coverage ===");
for (const label of [...lowF1Labels, ...alphabetDifficult]) {
  const approved = approvedByLabel[label] ?? 0;
  const campaign = campaignLabels.includes(label) ? (loadJSON(`${CAMPAIGNS_DIR}/campaign_${label.toLowerCase().replace(/\s+/g, "_")}.json`)?.target_samples ?? 0) : 0;
  const status = (approved + campaign) >= 15 ? "GOOD" : (approved + campaign) >= 5 ? "PARTIAL" : "NEEDS MORE";
  log(`  ${label.padEnd(15)} approved=${approved.toString().padStart(3)} campaign=${campaign.toString().padStart(3)} total=${(approved + campaign).toString().padStart(3)} [${status}]`);
}

// ── Phase 5: Generate retraining dataset (dry-run or execute) ──
if (FLAGS.dryRun) {
  log("\n=== DRY RUN — No changes made ===");
  log("To retrain, run without --dry-run:");
  log(`  node scripts/incremental-retrain.mjs --include-training-samples --include-campaigns --epochs ${EPOCHS}`);
  process.exit(0);
}

// Create output directory
ensureDir(OUTPUT_DIR);
ensureDir(resolve(OUTPUT_DIR, "bilstm"));

// Copy production model config as starting point
if (config) {
  writeFileSync(
    resolve(OUTPUT_DIR, "bilstm/config.json"),
    JSON.stringify({ ...config, retrained_at: new Date().toISOString(), dataset_version: currentVersion, epochs: EPOCHS, lr: LR }, null, 2)
  );
}

// Copy labels
if (labels) {
  writeFileSync(resolve(OUTPUT_DIR, "bilstm/labels.json"), JSON.stringify(labels, null, 2));
}

// Write training manifest for the training script
const manifest = {
  version: currentVersion,
  created_at: new Date().toISOString(),
  dataset: {
    production_samples: productionSamples,
    approved_samples: approvedSamples,
    campaign_samples: campaignSamples,
    total_samples: totalAllSamples,
  },
  sources: {
    production_dataset: PRODUCTION_DATASET_DIR,
    training_samples: FLAGS.includeTrainingSamples ? "supabase:training_samples" : null,
    campaigns: FLAGS.includeCampaigns ? CAMPAIGNS_DIR : null,
  },
  training: {
    epochs: EPOCHS,
    learning_rate: LR,
    model_type: "BiLSTM",
    num_classes: labels?.length ?? 133,
  },
  approved_by_label: approvedByLabel,
};

writeFileSync(resolve(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
log(`\nManifest written to ${resolve(OUTPUT_DIR, "manifest.json")}`);

// Launch training
log("\n=== Launching training ===");
log(`Running: node ${TRAINING_SCRIPT}`);

if (existsSync(TRAINING_SCRIPT)) {
  log("Training script found. To execute:");
  log(`  node "${TRAINING_SCRIPT}" --data-dir "${OUTPUT_DIR}" --epochs ${EPOCHS} --lr ${LR}`);
  log("\nAfter training completes:");
  log(`  1. Export to TF.js: node scripts/export-unified-bilstm-tfjs.mjs "${OUTPUT_DIR}"`);
  log(`  2. Register version in DB: INSERT INTO dataset_versions (version, sample_count, ...)`);
  log(`  3. Update model_versions with new accuracy metrics`);
} else {
  log(`Training script not found at ${TRAINING_SCRIPT}`);
  log("Available training scripts:");
  const scriptsDir = resolve(root, "scripts");
  if (existsSync(scriptsDir)) {
    for (const f of readdirSync(scriptsDir).filter(f => f.includes("train") && f.endsWith(".mjs"))) {
      log(`  scripts/${f}`);
    }
  }
}

log("\n=== Incremental retraining pipeline complete ===");
