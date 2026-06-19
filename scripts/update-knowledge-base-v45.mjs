#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const V45_DIR = path.join(process.cwd(), "datasets", "processed", "fsl_v45");
const DOCS_DIR = path.join(process.cwd(), "docs");

const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };

const EXISTING_133 = [
  "a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","ñ","ng",
  "GOOD MORNING","GOOD AFTERNOON","GOOD EVENING","HELLO","HOW ARE YOU","IM FINE","NICE TO MEET YOU","THANK YOU","YOURE WELCOME","SEE YOU TOMORROW",
  "UNDERSTAND","DON'T UNDERSTAND","KNOW","DON'T KNOW","NO","YES","WRONG","CORRECT","SLOW","FAST",
  "ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE","TEN",
  "JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER",
  "MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY","TODAY","TOMORROW","YESTERDAY",
  "FATHER","MOTHER","SON","DAUGHTER","GRANDFATHER","GRANDMOTHER","UNCLE","AUNTIE","COUSIN","PARENTS",
  "BOY","GIRL","MAN","WOMAN","DEAF","HARD OF HEARING","WHEELCHAIR PERSON","BLIND","DEAF BLIND","MARRIED",
  "BLUE","GREEN","RED","BROWN","BLACK","WHITE","YELLOW","ORANGE","GRAY","PINK","VIOLET","LIGHT","DARK",
  "BREAD","EGG","FISH","MEAT","CHICKEN","SPAGHETTI","RICE","LONGANISA","SHRIMP","CRAB",
  "HOT","COLD","JUICE","MILK","COFFEE","TEA","BEER","WINE","SUGAR","NO SUGAR"
];

const CATEGORY_MAP = {
  "a":"alphabet","b":"alphabet","c":"alphabet","d":"alphabet","e":"alphabet","f":"alphabet","g":"alphabet",
  "h":"alphabet","i":"alphabet","j":"alphabet","k":"alphabet","l":"alphabet","m":"alphabet","n":"alphabet",
  "o":"alphabet","p":"alphabet","q":"alphabet","r":"alphabet","s":"alphabet","t":"alphabet","u":"alphabet",
  "v":"alphabet","w":"alphabet","x":"alphabet","y":"alphabet","z":"alphabet","ñ":"alphabet","ng":"alphabet",
};

const DIFFICULTY_MAP = {
  "a":1,"b":1,"c":1,"d":1,"e":1,"f":1,"g":1,"h":1,"i":1,"j":1,"k":2,"l":1,"m":1,"n":1,"o":1,"p":1,"q":2,"r":1,"s":1,"t":1,"u":1,"v":2,"w":2,"x":3,"y":2,"z":3,"ñ":3,"ng":2,
};

const COMMON_CONFUSIONS = {
  "m":["n","w"],"n":["m","ñ"],"w":["m","v"],"v":["w","u"],"u":["v","w"],
  "d":["b"],"b":["d"],"p":["q","b"],"q":["p"],"ñ":["n","ng"],"ng":["ñ","n"],
  "HELLO":["HI","HOW ARE YOU"],"THANK YOU":["YOURE WELCOME"],"NO":["DON'T KNOW"],
  "YES":["NO"],"FATHER":["MOTHER"],"MOTHER":["FATHER"],
};

const FREQUENCY_MAP = {
  "HELLO":10,"THANK YOU":10,"YES":10,"NO":10,"PLEASE":8,"SORRY":7,"HELP":7,
  "ONE":6,"TWO":6,"THREE":6,"GOOD MORNING":5,"GOOD EVENING":5,"HOW ARE YOU":6,
  "IM FINE":5,"WATER":6,"EAT":6,"DRINK":5,"HOT":4,"COLD":4,
};

const generateKBEntry = (label, existingSet, analysis) => {
  if (existingSet.has(label)) return null;
  const upper = label.toUpperCase();
  const category = CATEGORY_MAP[upper] || (upper.length <= 2 ? "alphabet" : "phrase");
  const difficulty = DIFFICULTY_MAP[upper] || (category === "alphabet" ? 2 : 3);
  const confusions = COMMON_CONFUSIONS[upper] || COMMON_CONFUSIONS[upper.toUpperCase()] || [];
  const related = confusions.length > 0 ? confusions : ["HELLO", "THANK YOU", "YES", "NO"];
  const freq = FREQUENCY_MAP[upper] || 5;
  const sampleCount = analysis?.perLabel?.find((p) => p.label === label)?.count || 0;

  return {
    label,
    display_name: label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(),
    category,
    description: `${label} — ${
      category === "alphabet" ? `The letter "${label}" in FSL alphabet.` : `Common FSL phrase: "${label}".`
    }`,
    usage_explanation: `Used in everyday FSL communication. Appropriate for conversations about ${category === "alphabet" ? "spelling and finger-spelling" : "daily topics and discussions"}.`,
    difficulty_level: difficulty,
    frequency_of_use: freq,
    common_mistakes: confusions.length > 0 ? `Often confused with: ${confusions.join(", ")}` : null,
    related_gestures: related,
    suggested_replies: category === "phrase" ? [label] : [],
    reference_video_url: null,
  };
};

const computeConfusionPairs = (analysis) => {
  const pairs = [];
  if (!analysis?.perLabel) return pairs;
  const sorted = analysis.perLabel.sort((a, b) => b.count - a.count);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const diff = Math.abs(sorted[i].count - sorted[j].count);
      if (diff < 5 && sorted[i].count > 0 && sorted[j].count > 0) {
        pairs.push({ gesture_label: sorted[i].label, confused_with: sorted[j].label, count: Math.max(1, Math.floor(diff / 2)) });
      }
    }
  }
  return pairs.slice(0, 20);
};

const writeKBReport = (newEntries, confusionPairs) => {
  ensureDir(DOCS_DIR);
  const report = `# Knowledge Base Expansion — FSL v4.5 Integration

Generated: ${new Date().toISOString().split("T")[0]}

## New Knowledge Base Entries

| Label | Category | Difficulty | Frequency | Related |
|-------|----------|------------|-----------|---------|
${newEntries.map((e) => `| ${e.label} | ${e.category} | ${e.difficulty_level} | ${e.frequency_of_use} | ${(e.related_gestures ?? []).join(", ")} |`).join("\n")}
${newEntries.length === 0 ? "No new entries — all v4.5 labels are already in the knowledge base." : ""}

## Generated Confusion Pairs

| Gesture | Confused With | Count |
|---------|--------------|-------|
${confusionPairs.map((p) => `| ${p.gesture_label} | ${p.confused_with} | ${p.count} |`).join("\n")}

## Update Commands

To populate the knowledge base in Supabase, run these SQL statements:

\`\`\`sql
${newEntries.map((e) => `INSERT INTO gesture_knowledge_base (label, display_name, category, description, usage_explanation, difficulty_level, frequency_of_use, common_mistakes, related_gestures, suggested_replies)
VALUES ('${e.label}', '${e.display_name}', '${e.category}', '${e.description.replace(/'/g, "''")}', '${(e.usage_explanation ?? "").replace(/'/g, "''")}', ${e.difficulty_level}, ${e.frequency_of_use}, ${e.common_mistakes ? `'${e.common_mistakes.replace(/'/g, "''")}'` : "NULL"}, ARRAY${JSON.stringify(e.related_gestures)}::text[], ARRAY${JSON.stringify(e.suggested_replies)}::text[]);`).join("\n")}
\`\`\`

## Sync SQL for Confusion Pairs

\`\`\`sql
${confusionPairs.map((p) => `INSERT INTO gesture_confusion_pairs (gesture_label, confused_with, count) VALUES ('${p.gesture_label}', '${p.confused_with}', ${p.count})
ON CONFLICT (gesture_label, confused_with) DO UPDATE SET count = gesture_confusion_pairs.count + ${p.count};`).join("\n")}
\`\`\`
`;
  fs.writeFileSync(path.join(DOCS_DIR, "knowledge-base-v45-expansion.md"), report);
  console.log("KB expansion report written to docs/knowledge-base-v45-expansion.md");
};

const main = async () => {
  console.log("Knowledge Base Expansion — FSL v4.5");
  console.log("=".repeat(55));

  const v45Data = readJson(path.join(V45_DIR, "metadata.json")) || { totalSamples: 0, totalLabels: 0 };
  const v45Labels = v45Data.labels || [];
  const labelsFromSplit = readJson(path.join(V45_DIR, "labels.json"));
  const labelsList = labelsFromSplit?.labels || v45Labels || [];

  const existingSet = new Set(EXISTING_133.map((l) => l.toUpperCase()));
  const newLabels = labelsList.filter((l) => !existingSet.has(l.toUpperCase()));
  const newSet = new Set(newLabels.map((l) => l.toUpperCase()));

  const existingLabelsInV45 = labelsList.filter((l) => existingSet.has(l.toUpperCase()));
  console.log(`Total v4.5 labels: ${labelsList.length}`);
  console.log(`Existing in 133: ${existingLabelsInV45.length}`);
  console.log(`New labels: ${newLabels.length}`);

  const v45TrainData = readJson(path.join(V45_DIR, "train.json"));
  const analysis = v45TrainData ? { perLabel: v45TrainData.samples?.reduce((acc, s) => { const p = acc.find((x) => x.label === s.label); if (p) p.count++; else acc.push({ label: s.label, count: 1 }); return acc; }, []) } : null;

  const newEntries = [];
  for (const label of newLabels) {
    const entry = generateKBEntry(label, existingSet, analysis);
    if (entry) newEntries.push(entry);
  }

  if (newSet.size > 0) {
    const allLabels = [...new Set([...existingSet, ...newSet])];
    for (const label of allLabels) {
      if (!existingSet.has(label)) {
        if (!newEntries.find((e) => e.label.toUpperCase() === label)) {
          const entry = generateKBEntry(label, existingSet, analysis);
          if (entry) newEntries.push(entry);
        }
      }
    }
  }

  const confusionPairs = computeConfusionPairs(analysis);

  console.log(`\nNew KB entries to create: ${newEntries.length}`);
  console.log(`Confusion pairs to insert: ${confusionPairs.length}`);

  writeKBReport(newEntries, confusionPairs);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    console.log("\nSupabase credentials found. Inserting knowledge base entries...");
    const supabase = createClient(supabaseUrl, supabaseKey);

    for (const entry of newEntries) {
      const { error } = await supabase.from("gesture_knowledge_base").upsert(entry, { onConflict: "label" });
      if (error) console.error(`Failed to insert ${entry.label}: ${error.message}`);
      else console.log(`  Inserted: ${entry.label}`);
    }

    for (const pair of confusionPairs) {
      const { data: existing } = await supabase.from("gesture_confusion_pairs").select("*").eq("gesture_label", pair.gesture_label).eq("confused_with", pair.confused_with).single();
      if (existing) {
        await supabase.from("gesture_confusion_pairs").update({ count: existing.count + pair.count }).eq("id", existing.id);
      } else {
        await supabase.from("gesture_confusion_pairs").insert(pair);
      }
    }
    console.log("Database update complete.");
  } else {
    console.log("\nNo Supabase credentials in env. SQL commands written to docs/knowledge-base-v45-expansion.md");
    console.log("Run with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set to auto-insert.");
  }
};

main().catch((err) => { console.error("Error:", err.message); process.exit(1); });
