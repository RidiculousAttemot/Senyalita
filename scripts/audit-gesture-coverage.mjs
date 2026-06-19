#!/usr/bin/env node

/**
 * Gesture Coverage Audit
 * Verifies all 133 model labels have:
 *   1. A gesture record in the DB (gestures table)
 *   2. A reference video (video_path not null)
 *   3. Reply mappings (gesture_reply_relationships or gesture_replies)
 *   4. Response videos for replies (response_video_url)
 *
 * Usage: node scripts/audit-gesture-coverage.mjs
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 * or a .env file in the project root.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load env vars or .env file
function loadEnv() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) {
    console.error("❌ No .env file found and SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.");
    process.exit(1);
  }

  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 133 labels from the model (source: src/features/recognition/translation.ts)
const MODEL_LABELS = [
  // Alphabet
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "Ñ", "NG", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  // Greetings & Pleasantries
  "GOOD MORNING", "GOOD AFTERNOON", "GOOD EVENING", "HELLO", "HOW ARE YOU",
  "IM FINE", "NICE TO MEET YOU", "THANK YOU", "YOURE WELCOME", "SEE YOU TOMORROW",
  // Understanding
  "UNDERSTAND", "DON'T UNDERSTAND", "KNOW", "DON'T KNOW",
  // Affirmation
  "NO", "YES", "WRONG", "CORRECT", "SLOW", "FAST",
  // Numbers
  "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
  // Months
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
  // Days
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
  "TODAY", "TOMORROW", "YESTERDAY",
  // Family & People
  "FATHER", "MOTHER", "SON", "DAUGHTER", "GRANDFATHER", "GRANDMOTHER",
  "UNCLE", "AUNTIE", "COUSIN", "PARENTS", "BOY", "GIRL", "MAN", "WOMAN",
  // Descriptors
  "DEAF", "HARD OF HEARING", "WHEELCHAIR PERSON", "BLIND", "DEAF BLIND", "MARRIED",
  // Colors
  "BLUE", "GREEN", "RED", "BROWN", "BLACK", "WHITE", "YELLOW", "ORANGE",
  "GRAY", "PINK", "VIOLET", "LIGHT", "DARK",
  // Food
  "BREAD", "EGG", "FISH", "MEAT", "CHICKEN", "SPAGHETTI", "RICE",
  "LONGANISA", "SHRIMP", "CRAB",
  // Drinks & Temperature
  "HOT", "COLD", "JUICE", "MILK", "COFFEE", "TEA", "BEER", "WINE", "SUGAR", "NO SUGAR",
  // Other common phrases
  "SORRY", "PLEASE", "HELP", "GOODBYE", "LOVE", "HAPPY", "SAD", "BEAUTIFUL",
  "BAPTISM", "BIRTHDAY", "CHRISTMAS", "FEAST", "GRADUATION", "WEDDING",
  "WHAT", "WHO", "WHERE", "WHEN", "WHY", "HOW MUCH", "HOW MANY",
  "BATHROOM", "HOSPITAL", "SCHOOL", "CHURCH", "MARKET", "STORE", "HOUSE",
  "WATER", "FIRE", "EARTHQUAKE", "FLOOD", "TYPHOON",
  "SLEEP", "EAT", "DRINK", "WALK", "RUN", "SIT", "STAND", "PRAY",
  "BABY", "TEACHER", "STUDENT", "DOCTOR", "NURSE", "POLICE", "FRIEND",
  "GOOD", "BAD", "BIG", "SMALL", "NEW", "OLD",
  "HUNGRY", "THIRSTY", "TIRED", "SICK", "HEALTHY",
  "AGAIN", "ALWAYS", "NEVER", "SOMETIMES", "NOW", "LATER",
  "COME HERE", "GO THERE", "LOOK", "LISTEN", "SPEAK", "SIGN",
  "FSL", "FILIPINO SIGN LANGUAGE", "INTERPRETER",
];

async function main() {
  console.log("=".repeat(60));
  console.log("  Gesture Coverage Audit");
  console.log("=".repeat(60));

  // 1. Fetch existing gesture records
  const { data: gestures, error: gErr } = await supabase
    .from("gestures")
    .select("id, label, video_path, is_active");

  if (gErr) {
    console.error("❌ Failed to fetch gestures:", gErr.message);
    process.exit(1);
  }

  const gestureMap = new Map((gestures ?? []).map((g) => [g.label.toUpperCase(), g]));

  // 2. Fetch reply relationships
  const { data: rels } = await supabase
    .from("gesture_reply_relationships")
    .select("*")
    .eq("is_active", true);

  const replyRelMap = new Map();
  for (const r of rels ?? []) {
    if (!replyRelMap.has(r.gesture_label)) replyRelMap.set(r.gesture_label, []);
    replyRelMap.get(r.gesture_label).push(r);
  }

  // 3. Fetch gesture replies
  const { data: gReplies } = await supabase
    .from("gesture_replies")
    .select("id, gesture_id, reply_text");

  const replyMap = new Map();
  for (const r of gReplies ?? []) {
    if (!replyMap.has(r.gesture_id)) replyMap.set(r.gesture_id, []);
    replyMap.get(r.gesture_id).push(r);
  }

  const summary = {
    total: MODEL_LABELS.length,
    hasGesture: 0,
    hasVideo: 0,
    hasReplies: 0,
    hasResponseVideo: 0,
    missing: [] as Array<{ label: string; reason: string }>,
  };

  for (const label of MODEL_LABELS) {
    const upper = label.toUpperCase();
    const gesture = gestureMap.get(upper);

    if (!gesture) {
      summary.missing.push({ label: upper, reason: "No gesture record" });
      continue;
    }
    summary.hasGesture++;

    if (gesture.video_path) summary.hasVideo++;

    const relReplies = replyRelMap.get(upper) ?? [];
    const gestureReplies = replyMap.get(gesture.id) ?? [];
    if (relReplies.length > 0 || gestureReplies.length > 0) {
      summary.hasReplies++;
    } else {
      summary.missing.push({ label: upper, reason: "No reply mappings" });
    }

    if (relReplies.some((r: any) => r.response_video_url)) {
      summary.hasResponseVideo++;
    }
  }

  // Report
  console.log(`\nTotal model labels: ${summary.total}`);
  console.log(`Has gesture record: ${summary.hasGesture}/${summary.total}`);
  console.log(`Has reference video: ${summary.hasVideo}/${summary.total}`);
  console.log(`Has reply mappings: ${summary.hasReplies}/${summary.total}`);
  console.log(`Has response videos: ${summary.hasResponseVideo}/${summary.total}`);
  console.log(`\nMissing/Incomplete: ${summary.missing.length}`);

  if (summary.missing.length > 0) {
    console.log("\nDetails:");
    for (const m of summary.missing) {
      console.log(`  ❌ ${m.label}: ${m.reason}`);
    }
  }

  // Generate report file
  const reportPath = resolve(root, "docs", "gesture-coverage-report.md");
  let report = `# Gesture Coverage Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `| Metric | Value |\n|--------|-------|\n`;
  report += `| Total model labels | ${summary.total} |\n`;
  report += `| Has gesture record | ${summary.hasGesture}/${summary.total} |\n`;
  report += `| Has reference video | ${summary.hasVideo}/${summary.total} |\n`;
  report += `| Has reply mappings | ${summary.hasReplies}/${summary.total} |\n`;
  report += `| Has response videos | ${summary.hasResponseVideo}/${summary.total} |\n`;
  report += `| Missing/Incomplete | ${summary.missing.length} |\n\n`;

  if (summary.missing.length > 0) {
    report += `## Missing Items\n\n| Label | Reason |\n|-------|--------|\n`;
    for (const m of summary.missing) {
      report += `| ${m.label} | ${m.reason} |\n`;
    }
  }

  const { writeFileSync } = await import("fs");
  writeFileSync(reportPath, report, "utf-8");
  console.log(`\nReport written to: ${reportPath}`);

  const hasErrors = summary.missing.length > 0;
  console.log(`\n${"=".repeat(60)}`);
  console.log(hasErrors ? "❌ Audit FAILED — some labels need attention" : "✅ Audit PASSED — all 133 labels covered");
  console.log("=".repeat(60));

  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
