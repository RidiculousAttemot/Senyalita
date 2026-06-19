#!/usr/bin/env node
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_alphabet_combined");
const OUTPUT_DIR = path.join(process.cwd(), "models", "fsl_alphabet", "bilstm_v3");

if (!fs.existsSync(INPUT_DIR)) {
  console.error(`Combined dataset not found at ${INPUT_DIR}`);
  console.error(`Run: npm run merge:fsl-datasets`);
  process.exit(1);
}

const v2Script = path.join(__dirname, "train-fsl-alphabet-bilstm-v2.mjs");
if (!fs.existsSync(v2Script)) {
  console.error(`v2 trainer not found at ${v2Script}`);
  process.exit(1);
}

console.log("BiLSTM v3 training");
console.log("===================");
console.log(`Input:  ${INPUT_DIR}`);
console.log(`Output: ${OUTPUT_DIR}`);
console.log(`Reusing proven v2 trainer with same architecture, hyperparameters, and preprocessing.`);
console.log(`Only dataset composition and output directory differ.`);
console.log("");

const result = spawnSync(process.execPath, [v2Script], {
  stdio: "inherit",
  env: {
    ...process.env,
    INPUT_DIR,
    OUTPUT_DIR
  }
});

if (result.error) {
  console.error("Failed to launch v2 trainer:", result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
