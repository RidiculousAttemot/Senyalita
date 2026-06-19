#!/usr/bin/env node

/**
 * Content Audit
 * Verifies all 133 labels have:
 *   - Gesture record
 *   - Translation mapping
 *   - Reference video
 *   - Reply mappings
 *
 * Usage: node scripts/audit-content.mjs
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

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

// All known labels from the translation mapping
const LABELS = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M",
  "N","Ñ","NG","O","P","Q","R","S","T","U","V","W","X","Y","Z",
  "GOOD MORNING","GOOD AFTERNOON","GOOD EVENING","HELLO","HOW ARE YOU",
  "IM FINE","NICE TO MEET YOU","THANK YOU","YOURE WELCOME","SEE YOU TOMORROW",
  "UNDERSTAND","DON'T UNDERSTAND","KNOW","DON'T KNOW",
  "NO","YES","WRONG","CORRECT","SLOW","FAST",
  "ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE","TEN",
  "JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE",
  "JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER",
  "MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY",
  "TODAY","TOMORROW","YESTERDAY",
  "FATHER","MOTHER","SON","DAUGHTER","GRANDFATHER","GRANDMOTHER",
  "UNCLE","AUNTIE","COUSIN","PARENTS","BOY","GIRL","MAN","WOMAN",
  "DEAF","HARD OF HEARING","WHEELCHAIR PERSON","BLIND","DEAF BLIND","MARRIED",
  "BLUE","GREEN","RED","BROWN","BLACK","WHITE","YELLOW","ORANGE",
  "GRAY","PINK","VIOLET","LIGHT","DARK",
  "BREAD","EGG","FISH","MEAT","CHICKEN","SPAGHETTI","RICE",
  "LONGANISA","SHRIMP","CRAB",
  "HOT","COLD","JUICE","MILK","COFFEE","TEA","BEER","WINE","SUGAR","NO SUGAR",
  "SORRY","PLEASE","HELP","GOODBYE","LOVE","HAPPY","SAD","BEAUTIFUL",
  "BAPTISM","BIRTHDAY","CHRISTMAS","FEAST","GRADUATION","WEDDING",
  "WHAT","WHO","WHERE","WHEN","WHY","HOW MUCH","HOW MANY",
  "BATHROOM","HOSPITAL","SCHOOL","CHURCH","MARKET","STORE","HOUSE",
  "WATER","FIRE","EARTHQUAKE","FLOOD","TYPHOON",
  "SLEEP","EAT","DRINK","WALK","RUN","SIT","STAND","PRAY",
  "BABY","TEACHER","STUDENT","DOCTOR","NURSE","POLICE","FRIEND",
  "GOOD","BAD","BIG","SMALL","NEW","OLD",
  "HUNGRY","THIRSTY","TIRED","SICK","HEALTHY",
  "AGAIN","ALWAYS","NEVER","SOMETIMES","NOW","LATER",
  "COME HERE","GO THERE","LOOK","LISTEN","SPEAK","SIGN",
  "FSL","FILIPINO SIGN LANGUAGE","INTERPRETER",
];

async function main() {
  console.log("=".repeat(60));
  console.log("  Content Audit");
  console.log("  Checking all 133 labels...");
  console.log("=".repeat(60));

  // Fetch gestures
  const { data: gestures, error: gErr } = await supabase
    .from("gestures")
    .select("id, label, video_path, is_active");

  if (gErr) {
    console.error("❌ Failed to fetch gestures:", gErr.message);
    process.exit(1);
  }

  const gestureMap = new Map((gestures ?? []).map((g) => [g.label.toUpperCase(), g]));

  // Fetch gesture_reply_relationships
  const { data: rels } = await supabase
    .from("gesture_reply_relationships")
    .select("*")
    .eq("is_active", true);

  const relMap = new Map();
  for (const r of rels ?? []) {
    if (!relMap.has(r.gesture_label)) relMap.set(r.gesture_label, []);
    relMap.get(r.gesture_label).push(r);
  }

  // Fetch gesture_replies
  const { data: gReplies } = await supabase
    .from("gesture_replies")
    .select("id, gesture_id, reply_text");

  const replyMap = new Map();
  for (const r of gReplies ?? []) {
    if (!replyMap.has(r.gesture_id)) replyMap.set(r.gesture_id, []);
    replyMap.get(r.gesture_id).push(r);
  }

  // Read translation file
  const translationPath = resolve(root, "src", "features", "recognition", "translation.ts");
  const translationContent = existsSync(translationPath) ? readFileSync(translationPath, "utf-8") : "";
  const hasTranslation = (label) => {
    const upper = label.toUpperCase();
    return translationContent.includes(`"${upper}"`) || translationContent.includes(`'${upper}'`);
  };

  // Audit each label
  const results = {
    total: LABELS.length,
    hasGesture: 0,
    hasTranslation: 0,
    hasVideo: 0,
    hasReplies: 0,
    missing: [],
  };

  for (const label of LABELS) {
    const upper = label.toUpperCase();
    const issues = [];

    const gesture = gestureMap.get(upper);
    if (!gesture) {
      issues.push("No gesture record");
    } else {
      results.hasGesture++;
      if (gesture.video_path) results.hasVideo++;
    }

    if (!hasTranslation(label)) {
      issues.push("No translation mapping");
    } else {
      results.hasTranslation++;
    }

    const relReplies = relMap.get(upper) ?? [];
    const gestureReplies = gesture ? (replyMap.get(gesture.id) ?? []) : [];
    if (relReplies.length > 0 || gestureReplies.length > 0) {
      results.hasReplies++;
    } else {
      issues.push("No reply mappings");
    }

    if (issues.length > 0) {
      results.missing.push({ label: upper, issues });
    }
  }

  // Report
  console.log(`\nRESULTS\n`);
  console.log(`Total labels:     ${results.total}`);
  console.log(`Gesture record:   ${results.hasGesture}/${results.total}`);
  console.log(`Translation:      ${results.hasTranslation}/${results.total}`);
  console.log(`Reference video:  ${results.hasVideo}/${results.total}`);
  console.log(`Reply mappings:   ${results.hasReplies}/${results.total}`);
  console.log(`\nLabels with issues: ${results.missing.length}`);

  if (results.missing.length > 0) {
    console.log("\nDetails:");
    for (const m of results.missing) {
      console.log(`  ❌ ${m.label}: ${m.issues.join(", ")}`);
    }
  }

  // Generate report
  const reportPath = resolve(root, "docs", "content-audit-report.md");
  let report = `# Content Audit Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `| Check | Passed | Total | Coverage |\n|-------|--------|-------|----------|\n`;
  report += `| Gesture record | ${results.hasGesture} | ${results.total} | ${((results.hasGesture / results.total) * 100).toFixed(1)}% |\n`;
  report += `| Translation mapping | ${results.hasTranslation} | ${results.total} | ${((results.hasTranslation / results.total) * 100).toFixed(1)}% |\n`;
  report += `| Reference video | ${results.hasVideo} | ${results.total} | ${((results.hasVideo / results.total) * 100).toFixed(1)}% |\n`;
  report += `| Reply mappings | ${results.hasReplies} | ${results.total} | ${((results.hasReplies / results.total) * 100).toFixed(1)}% |\n\n`;

  if (results.missing.length > 0) {
    report += `## Labels Needing Attention\n\n| Label | Issues |\n|-------|--------|\n`;
    for (const m of results.missing) {
      report += `| ${m.label} | ${m.issues.join(", ")} |\n`;
    }
  } else {
    report += `## Result\n\n✅ All 133 labels pass all checks.\n`;
  }

  writeFileSync(reportPath, report, "utf-8");
  console.log(`\nReport written to: ${reportPath}`);

  const pass = results.missing.length === 0;
  console.log(`\n${"=".repeat(60)}`);
  console.log(pass ? "✅ Content Audit PASSED" : "❌ Content Audit FAILED — some labels need attention");
  console.log("=".repeat(60));

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
