/**
 * Which model classes have an extracted asset, and which do not.
 *
 * Derived from the two authoritative sources -- the label directories on disk
 * and the deployed model's labels.json -- rather than from a snapshot.
 *
 * There was a .inventory.json reconciliation artifact that recorded an
 * archive-folder -> gloss mapping. Reading it here made `46.daugther` look
 * uncovered forever: the flatten had long since renamed that directory to
 * DAUGHTER, but the snapshot still carried `gloss: null`. A derived check sees
 * the directory and is simply right, with no mapping table to keep in sync.
 *
 * The archive->gloss corrections that ARE still needed live in
 * scripts/flatten-sign-language-import.mjs (FOLDER_TYPOS), which is tracked and
 * runs at import time.
 *
 * Usage:  node scripts/check-extraction-coverage.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ASSET_DIR = path.join(ROOT, "datasets", "processed", "user_holistic_assets");
const LABELS = path.join(ROOT, "models", "fsl_unified", "bilstm_v4", "labels.json");

/**
 * Digit directories serve the spelled-out number classes.
 *
 * The recordings are foldered 0-10; the model's classes are ONE..TEN. The app
 * bridges this at resolution time, so a coverage check that compares names
 * literally reports ten false absences and eleven false strays. There is no
 * ZERO class -- the 0 asset is a deliberate orphan, recorded in
 * SYSTEM_DOCUMENTATION.md 1.1.
 */
const DIGIT_ALIASES = {
  1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
  6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
};

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

const raw = JSON.parse(fs.readFileSync(LABELS, "utf8"));
const classes = Array.isArray(raw) ? raw : raw.labels ?? raw.classes ?? Object.values(raw)[0];

/** A label directory counts as extracted only if it holds at least one asset. */
const extracted = new Set();
for (const dir of fs.readdirSync(ASSET_DIR, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const hasAsset = fs
    .readdirSync(path.join(ASSET_DIR, dir.name))
    .some((f) => f.endsWith("_asset.json"));
  if (!hasAsset) continue;
  const key = norm(dir.name);
  extracted.add(DIGIT_ALIASES[key] ?? key);
}

const covered = classes.filter((c) => extracted.has(norm(c)));
const missing = classes.filter((c) => !extracted.has(norm(c)));

console.log(`model classes:        ${classes.length}`);
console.log(`with an extraction:   ${covered.length}`);
console.log(`missing:              ${missing.length}`);
if (missing.length) console.log(`\n${missing.join("\n")}`);

// Directories that match no class -- extra takes, test fixtures, typos.
const classSet = new Set(classes.map(norm));
const unmatched = [...extracted].filter((d) => !classSet.has(d));
if (unmatched.length) console.log(`\nextracted but not a model class (${unmatched.length}): ${unmatched.join(", ")}`);
