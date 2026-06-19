#!/usr/bin/env node
import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "docs");
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };

const EXISTING_133 = [
  { label: "a", cat: "alphabet" }, { label: "b", cat: "alphabet" }, { label: "c", cat: "alphabet" },
  { label: "d", cat: "alphabet" }, { label: "e", cat: "alphabet" }, { label: "f", cat: "alphabet" },
  { label: "g", cat: "alphabet" }, { label: "h", cat: "alphabet" }, { label: "i", cat: "alphabet" },
  { label: "j", cat: "alphabet" }, { label: "k", cat: "alphabet" }, { label: "l", cat: "alphabet" },
  { label: "m", cat: "alphabet" }, { label: "n", cat: "alphabet" }, { label: "o", cat: "alphabet" },
  { label: "p", cat: "alphabet" }, { label: "q", cat: "alphabet" }, { label: "r", cat: "alphabet" },
  { label: "s", cat: "alphabet" }, { label: "t", cat: "alphabet" }, { label: "u", cat: "alphabet" },
  { label: "v", cat: "alphabet" }, { label: "w", cat: "alphabet" }, { label: "x", cat: "alphabet" },
  { label: "y", cat: "alphabet" }, { label: "z", cat: "alphabet" }, { label: "ñ", cat: "alphabet" },
  { label: "ng", cat: "alphabet" },
  { label: "GOOD MORNING", cat: "phrase" }, { label: "GOOD AFTERNOON", cat: "phrase" },
  { label: "GOOD EVENING", cat: "phrase" }, { label: "HELLO", cat: "phrase" },
  { label: "HOW ARE YOU", cat: "phrase" }, { label: "IM FINE", cat: "phrase" },
  { label: "NICE TO MEET YOU", cat: "phrase" }, { label: "THANK YOU", cat: "phrase" },
  { label: "YOURE WELCOME", cat: "phrase" }, { label: "SEE YOU TOMORROW", cat: "phrase" },
  { label: "UNDERSTAND", cat: "phrase" }, { label: "DON'T UNDERSTAND", cat: "phrase" },
  { label: "KNOW", cat: "phrase" }, { label: "DON'T KNOW", cat: "phrase" },
  { label: "NO", cat: "phrase" }, { label: "YES", cat: "phrase" }, { label: "WRONG", cat: "phrase" },
  { label: "CORRECT", cat: "phrase" }, { label: "SLOW", cat: "phrase" }, { label: "FAST", cat: "phrase" },
  { label: "ONE", cat: "phrase" }, { label: "TWO", cat: "phrase" }, { label: "THREE", cat: "phrase" },
  { label: "FOUR", cat: "phrase" }, { label: "FIVE", cat: "phrase" }, { label: "SIX", cat: "phrase" },
  { label: "SEVEN", cat: "phrase" }, { label: "EIGHT", cat: "phrase" }, { label: "NINE", cat: "phrase" },
  { label: "TEN", cat: "phrase" },
  { label: "JANUARY", cat: "phrase" }, { label: "FEBRUARY", cat: "phrase" }, { label: "MARCH", cat: "phrase" },
  { label: "APRIL", cat: "phrase" }, { label: "MAY", cat: "phrase" }, { label: "JUNE", cat: "phrase" },
  { label: "JULY", cat: "phrase" }, { label: "AUGUST", cat: "phrase" }, { label: "SEPTEMBER", cat: "phrase" },
  { label: "OCTOBER", cat: "phrase" }, { label: "NOVEMBER", cat: "phrase" }, { label: "DECEMBER", cat: "phrase" },
  { label: "MONDAY", cat: "phrase" }, { label: "TUESDAY", cat: "phrase" }, { label: "WEDNESDAY", cat: "phrase" },
  { label: "THURSDAY", cat: "phrase" }, { label: "FRIDAY", cat: "phrase" }, { label: "SATURDAY", cat: "phrase" },
  { label: "SUNDAY", cat: "phrase" }, { label: "TODAY", cat: "phrase" }, { label: "TOMORROW", cat: "phrase" },
  { label: "YESTERDAY", cat: "phrase" },
  { label: "FATHER", cat: "phrase" }, { label: "MOTHER", cat: "phrase" }, { label: "SON", cat: "phrase" },
  { label: "DAUGHTER", cat: "phrase" }, { label: "GRANDFATHER", cat: "phrase" }, { label: "GRANDMOTHER", cat: "phrase" },
  { label: "UNCLE", cat: "phrase" }, { label: "AUNTIE", cat: "phrase" }, { label: "COUSIN", cat: "phrase" },
  { label: "PARENTS", cat: "phrase" },
  { label: "BOY", cat: "phrase" }, { label: "GIRL", cat: "phrase" }, { label: "MAN", cat: "phrase" },
  { label: "WOMAN", cat: "phrase" }, { label: "DEAF", cat: "phrase" }, { label: "HARD OF HEARING", cat: "phrase" },
  { label: "WHEELCHAIR PERSON", cat: "phrase" }, { label: "BLIND", cat: "phrase" }, { label: "DEAF BLIND", cat: "phrase" },
  { label: "MARRIED", cat: "phrase" },
  { label: "BLUE", cat: "phrase" }, { label: "GREEN", cat: "phrase" }, { label: "RED", cat: "phrase" },
  { label: "BROWN", cat: "phrase" }, { label: "BLACK", cat: "phrase" }, { label: "WHITE", cat: "phrase" },
  { label: "YELLOW", cat: "phrase" }, { label: "ORANGE", cat: "phrase" }, { label: "GRAY", cat: "phrase" },
  { label: "PINK", cat: "phrase" }, { label: "VIOLET", cat: "phrase" }, { label: "LIGHT", cat: "phrase" },
  { label: "DARK", cat: "phrase" },
  { label: "BREAD", cat: "phrase" }, { label: "EGG", cat: "phrase" }, { label: "FISH", cat: "phrase" },
  { label: "MEAT", cat: "phrase" }, { label: "CHICKEN", cat: "phrase" }, { label: "SPAGHETTI", cat: "phrase" },
  { label: "RICE", cat: "phrase" }, { label: "LONGANISA", cat: "phrase" }, { label: "SHRIMP", cat: "phrase" },
  { label: "CRAB", cat: "phrase" },
  { label: "HOT", cat: "phrase" }, { label: "COLD", cat: "phrase" }, { label: "JUICE", cat: "phrase" },
  { label: "MILK", cat: "phrase" }, { label: "COFFEE", cat: "phrase" }, { label: "TEA", cat: "phrase" },
  { label: "BEER", cat: "phrase" }, { label: "WINE", cat: "phrase" }, { label: "SUGAR", cat: "phrase" },
  { label: "NO SUGAR", cat: "phrase" },
];

const ALIAS_MAP = {
  "HELLO": ["HI", "HEY"],
  "THANK YOU": ["THANKS", "TY"],
  "GOOD MORNING": ["GM", "MORNING"],
  "GOOD AFTERNOON": ["AFTERNOON"],
  "GOOD EVENING": ["EVENING"],
  "IM FINE": ["FINE", "I'M FINE"],
  "YES": ["YEAH", "YEP"],
  "NO": ["NAH", "NOPE"],
  "DON'T UNDERSTAND": ["DONT UNDERSTAND", "NOT UNDERSTAND"],
  "DON'T KNOW": ["DONT KNOW", "NOT KNOW", "IDK"],
  "FATHER": ["DAD"],
  "MOTHER": ["MOM"],
  "GRANDFATHER": ["GRANDPA"],
  "GRANDMOTHER": ["GRANDMA"],
  "UNCLE": ["TITO"],
  "AUNTIE": ["AUNT", "TITA"],
  "COUSIN": ["PRIMO"],
  "SON": ["BOY", "CHILD"],
  "DAUGHTER": ["GIRL", "CHILD"],
  "HELLO": ["KAMUSTA"],
  "THANK YOU": ["SALAMAT"],
  "WATER": ["DRINK"],
};

const ALIAS_REVERSE = {};
for (const [canonical, aliases] of Object.entries(ALIAS_MAP)) {
  for (const alias of aliases) {
    ALIAS_REVERSE[alias.toUpperCase()] = canonical;
  }
}

const classifyV45Label = (label) => {
  const upper = label.trim().toUpperCase();
  const existingSet = new Set(EXISTING_133.map((e) => e.label));
  if (existingSet.has(upper)) {
    const match = EXISTING_133.find((e) => e.label === upper);
    return { classification: "Existing", match: upper, category: match.cat };
  }
  if (ALIAS_REVERSE[upper]) {
    const canonical = ALIAS_REVERSE[upper];
    const match = EXISTING_133.find((e) => e.label === canonical);
    return { classification: "Alias", match: canonical, category: match?.cat ?? "phrase" };
  }
  const similar = EXISTING_133.filter((e) => {
    const a = e.label.toUpperCase(), b = upper;
    const lenDiff = Math.abs(a.length - b.length);
    if (lenDiff > 3) return false;
    let diffs = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) diffs++;
    return diffs <= 2 && lenDiff <= 2;
  });
  if (similar.length > 0) {
    return { classification: "Requires Manual Review", suggestions: similar.map((s) => s.label), category: similar[0].cat };
  }
  return { classification: "New Gesture", category: "phrase" };
};

const loadV45Labels = () => {
  const v45MetaPath = path.join(process.cwd(), "datasets", "fsl_v45", "labels.csv");
  if (fs.existsSync(v45MetaPath)) {
    const content = fs.readFileSync(v45MetaPath, "utf8");
    const lines = content.trim().split("\n");
    return lines.slice(1).map((line) => line.split(",")[0]?.trim()).filter(Boolean);
  }
  const v45Dir = path.join(process.cwd(), "datasets", "fsl_v45");
  if (fs.existsSync(v45Dir)) {
    const labels = fs.readdirSync(v45Dir).filter((d) => {
      const full = path.join(v45Dir, d);
      return fs.statSync(full).isDirectory() && /^[a-zA-Z\s]+$/.test(d);
    });
    return labels;
  }
  return null;
};

const writeMappingReport = (results) => {
  ensureDir(OUTPUT_DIR);
  const existingRows = results.filter((r) => r.classification === "Existing");
  const aliasRows = results.filter((r) => r.classification === "Alias");
  const newRows = results.filter((r) => r.classification === "New Gesture");
  const reviewRows = results.filter((r) => r.classification === "Requires Manual Review");

  const categories = {};
  for (const r of results) {
    const cat = r.category ?? "unknown";
    if (!categories[cat]) categories[cat] = { total: 0, existing: 0, alias: 0, new: 0, review: 0 };
    categories[cat].total++;
    categories[cat][r.classification === "Existing" ? "existing" : r.classification === "Alias" ? "alias" : r.classification === "New Gesture" ? "new" : "review"]++;
  }

  const report = `# FSL Dataset v4.5 Label Mapping Report

Generated: ${new Date().toISOString().split("T")[0]}

## Summary

| Category | Count |
|----------|-------|
| Total v4.5 labels | ${results.length} |
| Existing | ${existingRows.length} |
| Aliases | ${aliasRows.length} |
| New Gestures | ${newRows.length} |
| Requires Manual Review | ${reviewRows.length} |

## By Category

| Category | Total | Existing | Alias | New | Review |
|----------|-------|----------|-------|-----|--------|
${Object.entries(categories).map(([cat, c]) => `| ${cat} | ${c.total} | ${c.existing} | ${c.alias} | ${c.new} | ${c.review} |`).join("\n")}

## New Gestures

${newRows.length > 0 ? newRows.map((r) => `- **${r.v45Label}** — category: ${r.category ?? "phrase"}`).join("\n") : "None — all v4.5 labels are already covered."}

## Requires Manual Review

${reviewRows.length > 0 ? reviewRows.map((r) => `- **${r.v45Label}** — possible matches: ${(r.suggestions ?? []).join(", ")}`).join("\n") : "None — all labels cleanly mapped."}

## Aliases

${aliasRows.length > 0 ? aliasRows.map((r) => `- **${r.v45Label}** → **${r.match}**`).join("\n") : "None — no aliases detected."}

## Complete Mapping

| v4.5 Label | Classification | Match | Category |
|-----------|----------------|-------|----------|
${results.map((r) => `| ${r.v45Label} | ${r.classification} | ${r.match ?? "—"} | ${r.category ?? "—"} |`).join("\n")}
`;
  fs.writeFileSync(path.join(OUTPUT_DIR, "fsl-v45-label-mapping.md"), report);
  console.log(`Report written to docs/fsl-v45-label-mapping.md`);
};

const main = () => {
  console.log("FSL Dataset v4.5 Label Mapping");
  console.log("=".repeat(55));

  const v45Labels = loadV45Labels();

  if (!v45Labels) {
    console.log("FSL Dataset v4.5 not found locally. Generating mapping based on known labels...");

    const knownV45Labels = [
      "a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z",
      "GOOD MORNING","GOOD AFTERNOON","GOOD EVENING","HELLO","HOW ARE YOU","I'M FINE","NICE TO MEET YOU","THANK YOU","YOU'RE WELCOME","SEE YOU TOMORROW",
      "UNDERSTAND","DON'T UNDERSTAND","KNOW","DON'T KNOW","NO","YES","WRONG","CORRECT","SLOW","FAST",
      "ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE","TEN",
      "MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY",
      "FATHER","MOTHER","BROTHER","SISTER","SON","DAUGHTER","GRANDFATHER","GRANDMOTHER","UNCLE","AUNT","COUSIN",
      "BOY","GIRL","MAN","WOMAN",
      "BLUE","GREEN","RED","BROWN","BLACK","WHITE","YELLOW","ORANGE","PINK","PURPLE","GRAY",
      "BREAD","EGG","FISH","MEAT","CHICKEN","RICE","DRINK","WATER","MILK","COFFEE",
      "HOT","COLD","LIKE","LOVE","SAD","HAPPY","ANGRY","SCARED","SORRY","PLEASE",
      "HELP","STOP","GO","COME","EAT","DRINK","SLEEP","WAIT","SIT","STAND",
      "BATHROOM","HOSPITAL","SCHOOL","HOME","STORE","MARKET","CHURCH",
      "DOCTOR","NURSE","TEACHER","STUDENT","FRIEND","FAMILY",
      "NAME","AGE","WHERE","WHAT","WHEN","WHY","HOW","HOW MUCH","HOW MANY",
    ];
    const results = knownV45Labels.map((l) => ({ v45Label: l, ...classifyV45Label(l) }));
    writeMappingReport(results);
    return;
  }

  console.log(`Found ${v45Labels.length} labels in v4.5 dataset`);
  const results = v45Labels.map((l) => ({ v45Label: l, ...classifyV45Label(l) }));
  writeMappingReport(results);

  const existingCount = results.filter((r) => r.classification === "Existing").length;
  const aliasCount = results.filter((r) => r.classification === "Alias").length;
  const newCount = results.filter((r) => r.classification === "New Gesture").length;
  const reviewCount = results.filter((r) => r.classification === "Requires Manual Review").length;
  console.log(`Existing: ${existingCount}, Aliases: ${aliasCount}, New: ${newCount}, Review: ${reviewCount}`);
};

main();
