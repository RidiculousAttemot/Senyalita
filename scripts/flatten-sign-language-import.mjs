/**
 * Flattens the imported `Sign Language/` wrapper into label directories.
 *
 * extract-holistic-videos.mjs takes the directory name AS the label
 * (`const label = entry.name`), so the import's numbered folders -- `1.goodmorning`,
 * `46.daugther` -- would become labels verbatim. They have to be renamed, not just
 * moved up a level.
 *
 * Renaming also dissolves the `daugther` typo into one row of the mapping rather
 * than a special case carried through the rest of the pipeline. That folder is the
 * class SYSTEM_DOCUMENTATION.md 1.1 records as "recovered by explicit mapping":
 * the recording exists, only its folder was misspelled.
 *
 * GUARDS, because the parent already holds the 37 source directories behind the
 * published fingerspelling assets and losing one costs a take that cannot be
 * re-derived:
 *   - every target is checked for existence BEFORE anything moves, case-insensitively
 *     (Windows: `A/` and `a/` are the same directory, so a casing difference merges
 *     silently instead of erroring)
 *   - the run aborts as a whole if any target is occupied; it does not move what it
 *     can and report the rest
 *   - nothing is deleted or overwritten in any path through this script
 *
 * Usage:  node scripts/flatten-sign-language-import.mjs [--apply]
 * Default is a dry run.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "datasets", "raw", "user_videos");
const WRAPPER = path.join(ROOT, "Sign Language");
const APPLY = process.argv.includes("--apply");

/**
 * Folder-name typos corrected on import. Keyed by the folder as it appears in the
 * archive, so the archive stays untouched and the correction lives in one place.
 */
const FOLDER_TYPOS = {
  // Misspelled in the source archive; the recording itself is DAUGHTER.
  "46.daugther": "DAUGHTER",
};

const inventory = JSON.parse(fs.readFileSync(".inventory.json", "utf8"));
const glossByFolder = new Map(inventory.map((v) => [v.folder, v.gloss]));

if (!fs.existsSync(WRAPPER)) {
  console.error(`Nothing to flatten: ${WRAPPER} does not exist.`);
  process.exit(1);
}

// Case-insensitive index of what already lives in the parent.
const occupied = new Map();
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name !== "Sign Language") {
    occupied.set(entry.name.toLowerCase(), entry.name);
  }
}

const planned = [];
const problems = [];
const seen = new Map();

for (const entry of fs.readdirSync(WRAPPER, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const folder = entry.name;
  const gloss = FOLDER_TYPOS[folder] ?? glossByFolder.get(folder);

  if (!gloss) {
    problems.push(`${folder}: no gloss in inventory and no typo mapping`);
    continue;
  }
  const key = gloss.toLowerCase();
  if (occupied.has(key)) {
    problems.push(`${folder} -> ${gloss}: target already exists as "${occupied.get(key)}"`);
    continue;
  }
  if (seen.has(key)) {
    problems.push(`${folder} -> ${gloss}: collides with ${seen.get(key)} (case-insensitive)`);
    continue;
  }
  seen.set(key, folder);
  planned.push({ from: path.join(WRAPPER, folder), to: path.join(ROOT, gloss), folder, gloss });
}

console.log(`planned renames: ${planned.length}`);
console.log(`problems: ${problems.length}`);
for (const p of problems) console.log(`  ! ${p}`);

if (problems.length > 0) {
  console.error("\nAborted. Nothing was moved. Resolve the problems above and re-run.");
  process.exit(1);
}

if (!APPLY) {
  console.log("\nDry run. Sample:");
  for (const p of planned.slice(0, 5)) console.log(`  ${p.folder} -> ${p.gloss}`);
  console.log("\nRe-run with --apply to perform the renames.");
  process.exit(0);
}

let moved = 0;
for (const p of planned) {
  fs.renameSync(p.from, p.to);
  moved++;
}
console.log(`\nmoved ${moved} directories.`);

const leftover = fs.readdirSync(WRAPPER);
if (leftover.length === 0) {
  fs.rmdirSync(WRAPPER);
  console.log("removed the empty Sign Language/ wrapper.");
} else {
  console.log(`Sign Language/ still holds ${leftover.length} entries; left in place.`);
}
