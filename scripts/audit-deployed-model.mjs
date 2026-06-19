#!/usr/bin/env node
// Runtime model audit script.
//
// Cross-references the deployed model's labels.json against:
//   1. The translation layer (GESTURE_DISPLAY_MAP in src/features/recognition/translation.ts)
//   2. The gestures table in the database
//   3. The gesture_replies table
//
// Reports:
//   - Labels present in the model but missing from the translation layer
//   - Labels present in the model but missing from the DB
//   - Labels present in the DB but missing from the model (orphans)
//   - Gestures with zero reply suggestions
//   - Model output shape / class count
//
// Usage:
//   DATABASE_URL=postgresql://... node scripts/audit-deployed-model.mjs
//   DATABASE_URL=postgresql://... node scripts/audit-deployed-model.mjs --report or --json

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ROOT = join(__dirname, "..");
const LABELS_PATH = join(
  ROOT, "public", "models", "fsl_unified", "bilstm_tfjs", "labels.json"
);
const TRANSLATION_PATH = join(
  ROOT, "src", "features", "recognition", "translation.ts"
);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required.");
  process.exit(1);
}

const FLAG_REPORT = process.argv.includes("--report");
const FLAG_JSON = process.argv.includes("--json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmt = (label) => `  ${"[MISSING]".padEnd(12)} ${label}`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const main = async () => {
  // 1. Load model labels
  if (!existsSync(LABELS_PATH)) {
    console.error(`Model labels file not found: ${LABELS_PATH}`);
    process.exit(1);
  }
  const raw = readFileSync(LABELS_PATH, "utf8");
  const { labels: modelLabels } = JSON.parse(raw);
  const modelSet = new Set(modelLabels);

  console.log(`\n=== Audit: Deployed Model Labels ===`);
  console.log(`Model: fsl_unified/bilstm_tfjs`);
  console.log(`Total labels: ${modelLabels.length}`);

  // 2. Parse translation layer
  if (!existsSync(TRANSLATION_PATH)) {
    console.error(`Translation file not found: ${TRANSLATION_PATH}`);
    process.exit(1);
  }
  const transContent = readFileSync(TRANSLATION_PATH, "utf8");

  // Extract labels from GESTURE_DISPLAY_MAP keys via regex
  const displayMapRegex = /['"](\S+)['"]:\s*['"]/g;
  const transLabels = new Set();
  let m;
  while ((m = displayMapRegex.exec(transContent)) !== null) {
    transLabels.add(m[1]);
  }

  const missingFromTrans = modelLabels.filter((l) => !transLabels.has(l));
  const transExtras = [...transLabels].filter((l) => !modelSet.has(l));

  console.log(`\n--- Translation Layer ---`);
  console.log(`Labels in GESTURE_DISPLAY_MAP: ${transLabels.size}`);
  if (missingFromTrans.length > 0) {
    console.log(`Missing from translation layer (${missingFromTrans.length}):`);
    missingFromTrans.forEach((l) => console.log(fmt(l)));
  } else {
    console.log("All model labels present in translation layer.");
  }
  if (transExtras.length > 0) {
    console.log(`Extra labels in translation layer (${transExtras.length}):`);
    transExtras.forEach((l) => console.log(`  [EXTRA] ${l}`));
  }

  // 3. Database labels
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const { rows: gestureRows } = await pool.query(
      "SELECT id, label FROM public.gestures ORDER BY display_order"
    );
    const dbLabels = new Map(gestureRows.map((r) => [r.label, r.id]));

    const missingFromDb = modelLabels.filter((l) => !dbLabels.has(l));
    const dbOrphans = [...dbLabels.keys()].filter((l) => !modelSet.has(l));

    console.log(`\n--- Database (gestures table) ---`);
    console.log(`Total gestures in DB: ${gestureRows.length}`);
    if (missingFromDb.length > 0) {
      console.log(`Missing from DB (${missingFromDb.length}):`);
      missingFromDb.forEach((l) => console.log(fmt(l)));
    } else {
      console.log("All model labels present in DB.");
    }
    if (dbOrphans.length > 0) {
      console.log(`DB orphans (not in model) (${dbOrphans.length}):`);
      dbOrphans.forEach((l) =>
        console.log(`  [ORPHAN] ${l} (id: ${dbLabels.get(l)})`)
      );
    }

    // 4. Missing replies
    const gestureIds = [...dbLabels.values()];
    const { rows: replyRows } = await pool.query(
      `SELECT gesture_id, count(*) as cnt
       FROM public.gesture_replies
       WHERE gesture_id = ANY($1::uuid[])
       GROUP BY gesture_id`,
      [gestureIds]
    );
    const replyCountMap = new Map(replyRows.map((r) => [r.gesture_id, parseInt(r.cnt, 10)]));

    const zeroReplies = gestureRows.filter(
      (g) => !replyCountMap.has(g.id) || replyCountMap.get(g.id) === 0
    );

    console.log(`\n--- Replies (gesture_replies table) ---`);
    const totalReplyCount = replyRows.reduce((acc, r) => acc + parseInt(r.cnt, 10), 0);
    console.log(`Total replies: ${totalReplyCount}`);
    if (zeroReplies.length > 0) {
      console.log(`Gestures with zero replies (${zeroReplies.length}):`);
      zeroReplies.forEach((g) => console.log(`  [NO REPLIES] ${g.label} (id: ${g.id})`));
    } else {
      console.log("All gestures have at least one reply.");
    }

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    console.log(`\n=== Summary ===`);
    console.log(`Model labels:             ${modelLabels.length}`);
    console.log(`In translation layer:     ${transLabels.size}`);
    console.log(`In DB (gestures):         ${gestureRows.length}`);
    console.log(`Total replies:            ${totalReplyCount}`);
    console.log(`Missing from translation: ${missingFromTrans.length}`);
    console.log(`Missing from DB:          ${missingFromDb.length}`);
    console.log(`DB orphans:               ${dbOrphans.length}`);
    console.log(`Gestures w/o replies:     ${zeroReplies.length}`);

    const allGood =
      missingFromTrans.length === 0 &&
      missingFromDb.length === 0 &&
      dbOrphans.length === 0 &&
      zeroReplies.length === 0;

    if (allGood) {
      console.log("\nStatus: ALL CLEAN — model, translation, DB, and replies are in sync.");
    } else {
      console.log("\nStatus: ISSUES FOUND — see details above.");
    }

    if (FLAG_JSON) {
      console.log(
        JSON.stringify(
          {
            model: { path: LABELS_PATH, count: modelLabels.length },
            translation: { count: transLabels.size, missing: missingFromTrans, extras: transExtras },
            database: { count: gestureRows.length, missing: missingFromDb, orphans: dbOrphans },
            replies: { total: totalReplyCount, zeroReplies: zeroReplies.map((g) => g.label) },
            issues: {
              missingFromTranslation: missingFromTrans.length,
              missingFromDb: missingFromDb.length,
              dbOrphans: dbOrphans.length,
              zeroReplies: zeroReplies.length,
            },
            clean: allGood,
          },
          null,
          2
        )
      );
    }
  } finally {
    await pool.end();
  }
};

main().catch((err) => {
  console.error("Audit failed:", err.message);
  process.exit(1);
});
