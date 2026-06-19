#!/usr/bin/env node
// Seed script: inserts missing FSL-105 gestures into the DB and creates
// default reply suggestions for each new gesture.
//
// Usage: node scripts/seed-fsl105-gestures.mjs
//
// Reads the deployed model labels from public/models/fsl_unified/bilstm_tfjs/labels.json,
// queries the existing gestures table, and inserts any missing rows plus replies.

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const LABELS_PATH = join(
  __dirname, "..", "public", "models", "fsl_unified", "bilstm_tfjs", "labels.json"
);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Default reply suggestions per gesture category
// ---------------------------------------------------------------------------
const CATEGORY_REPLIES = {
  alphabet: [
    { reply_text: "Letter {label}", display_order: 1 },
    { reply_text: "Spell it again", display_order: 2 },
  ],
  greeting: [
    { reply_text: "Hello!", display_order: 1 },
    { reply_text: "How are you?", display_order: 2 },
    { reply_text: "Nice to see you", display_order: 3 },
  ],
  survival: [
    { reply_text: "I understand", display_order: 1 },
    { reply_text: "I don't know", display_order: 2 },
    { reply_text: "Please repeat", display_order: 3 },
  ],
  number: [
    { reply_text: "Number {label}", display_order: 1 },
    { reply_text: "Count again", display_order: 2 },
  ],
  calendar: [
    { reply_text: "Month {label}", display_order: 1 },
    { reply_text: "Mark my calendar", display_order: 2 },
  ],
  days: [
    { reply_text: "Day {label}", display_order: 1 },
    { reply_text: "Schedule it", display_order: 2 },
    { reply_text: "What day?", display_order: 3 },
  ],
  family: [
    { reply_text: "My {label}", display_order: 1 },
    { reply_text: "Family member", display_order: 2 },
    { reply_text: "Tell me more", display_order: 3 },
  ],
  relationships: [
    { reply_text: "I understand", display_order: 1 },
    { reply_text: "That's good to know", display_order: 2 },
  ],
  color: [
    { reply_text: "Color {label}", display_order: 1 },
    { reply_text: "Nice color", display_order: 2 },
    { reply_text: "I like that color", display_order: 3 },
  ],
  food: [
    { reply_text: "I want {label}", display_order: 1 },
    { reply_text: "Delicious!", display_order: 2 },
    { reply_text: "Let's eat", display_order: 3 },
  ],
  drink: [
    { reply_text: "I want {label}", display_order: 1 },
    { reply_text: "Refreshing", display_order: 2 },
    { reply_text: "Another please", display_order: 3 },
  ],
  default: [
    { reply_text: "I understand", display_order: 1 },
    { reply_text: "Good", display_order: 2 },
    { reply_text: "Please repeat", display_order: 3 },
  ],
};

// ---------------------------------------------------------------------------
// Simple category detection from label name
// ---------------------------------------------------------------------------
const GREETING_LABELS = new Set([
  "GOOD MORNING", "GOOD AFTERNOON", "GOOD EVENING", "HELLO",
  "HOW ARE YOU", "IM FINE", "NICE TO MEET YOU", "THANK YOU",
  "YOURE WELCOME", "SEE YOU TOMORROW",
]);
const SURVIVAL_LABELS = new Set([
  "UNDERSTAND", "DON'T UNDERSTAND", "KNOW", "DON'T KNOW",
  "NO", "YES", "WRONG", "CORRECT", "SLOW", "FAST",
]);
const CALENDAR_LABELS = new Set([
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
]);
const DAYS_LABELS = new Set([
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY",
  "SATURDAY", "SUNDAY", "TODAY", "TOMORROW", "YESTERDAY",
]);
const FAMILY_LABELS = new Set([
  "FATHER", "MOTHER", "SON", "DAUGHTER", "GRANDFATHER",
  "GRANDMOTHER", "UNCLE", "AUNTIE", "COUSIN", "PARENTS",
]);
const RELATIONSHIPS_LABELS = new Set([
  "BOY", "GIRL", "MAN", "WOMAN", "DEAF", "HARD OF HEARING",
  "WEELCHAIR PERSON", "BLIND", "DEAF BLIND", "MARRIED",
]);
const COLOR_LABELS = new Set([
  "BLUE", "GREEN", "RED", "BROWN", "BLACK", "WHITE", "YELLOW",
  "ORANGE", "GRAY", "PINK", "VIOLET", "LIGHT", "DARK",
]);
const FOOD_LABELS = new Set([
  "BREAD", "EGG", "FISH", "MEAT", "CHICKEN", "SPAGHETTI",
  "RICE", "LONGANISA", "SHRIMP", "CRAB",
]);
const DRINK_LABELS = new Set([
  "HOT", "COLD", "JUICE", "MILK", "COFFEE", "TEA", "BEER",
  "WINE", "SUGAR", "NO SUGAR",
]);

const getLabelCategory = (label) => {
  const upper = label.toUpperCase();
  if (GREETING_LABELS.has(upper)) return "greeting";
  if (SURVIVAL_LABELS.has(upper)) return "survival";
  if (CALENDAR_LABELS.has(upper)) return "calendar";
  if (DAYS_LABELS.has(upper)) return "days";
  if (FAMILY_LABELS.has(upper)) return "family";
  if (RELATIONSHIPS_LABELS.has(upper)) return "relationships";
  if (COLOR_LABELS.has(upper)) return "color";
  if (FOOD_LABELS.has(upper)) return "food";
  if (DRINK_LABELS.has(upper)) return "drink";
  if (/^[A-Z]$/.test(upper) || upper === "Ñ" || upper === "NG") return "alphabet";
  if (/^[0-9]+$/.test(upper.replace(/^NUMBER\s*/, ""))) return "number";
  return "default";
};

const getRepliesForLabel = (label) => {
  const category = getLabelCategory(label);
  const templates = CATEGORY_REPLIES[category] ?? CATEGORY_REPLIES.default;
  return templates.map((t) => ({
    reply_text: t.reply_text.replace("{label}", label.toLowerCase()),
    display_order: t.display_order,
  }));
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const main = async () => {
  // 1. Load model labels
  if (!existsSync(LABELS_PATH)) {
    console.error(`Model labels file not found at ${LABELS_PATH}`);
    process.exit(1);
  }
  const labelsData = JSON.parse(readFileSync(LABELS_PATH, "utf8"));
  const modelLabels = labelsData.labels;
  console.log(`Model has ${modelLabels.length} labels.`);

  // 2. Connect to DB
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // 3. Get existing gesture labels from DB
    const { rows: existingRows } = await pool.query(
      "SELECT label FROM public.gestures"
    );
    const existingLabels = new Set(existingRows.map((r) => r.label));
    console.log(`DB has ${existingLabels.size} existing gesture labels.`);

    // 4. Find missing labels
    const missingLabels = modelLabels.filter((l) => !existingLabels.has(l));
    console.log(`Missing ${missingLabels.length} labels.`);

    if (missingLabels.length === 0) {
      console.log("All model labels already registered. Nothing to do.");
      return;
    }

    // 5. Insert missing gestures
    const insertedIds = [];
    for (const label of missingLabels) {
      const displayOrder = modelLabels.indexOf(label) + 1000;
      const description = `FSL sign: ${label}`;
      const { rows } = await pool.query(
        `INSERT INTO public.gestures (label, description, display_order, is_active, status)
         VALUES ($1, $2, $3, true, 'approved')
         ON CONFLICT (label) DO UPDATE SET description = EXCLUDED.description
         RETURNING id`,
        [label, description, displayOrder]
      );
      insertedIds.push({ label, id: rows[0].id });
      console.log(`  Inserted: ${label}`);
    }
    console.log(`Inserted ${insertedIds.length} new gestures.`);

    // 6. Insert reply suggestions for newly inserted gestures
    let replyCount = 0;
    for (const { label, id } of insertedIds) {
      const replies = getRepliesForLabel(label);
      for (const reply of replies) {
        await pool.query(
          `INSERT INTO public.gesture_replies (gesture_id, reply_text, display_order, is_active)
           VALUES ($1, $2, $3, true)`,
          [id, reply.reply_text, reply.display_order]
        );
        replyCount++;
      }
    }
    console.log(`Inserted ${replyCount} reply suggestions.`);

    // 7. Verify
    const { rows: finalRows } = await pool.query(
      "SELECT count(*) as cnt FROM public.gestures"
    );
    console.log(`Final gesture count: ${finalRows[0].cnt}`);
    console.log("Done.");
  } finally {
    await pool.end();
  }
};

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
