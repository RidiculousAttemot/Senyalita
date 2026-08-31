const fs = require("fs");
const p = "playwright.config.ts";
const lines = fs.readFileSync(p, "utf8").split("\n");

// Only the firefox and webkit projects: chromium can run camera-announcements.
let changed = 0;
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].includes("testIgnore: /camera-recognition\.spec\.ts/")) continue;
  // Find which project this belongs to by scanning back for the name.
  let name = "";
  for (let j = i; j >= 0 && j > i - 8; j--) {
    const m = lines[j].match(/name:\s*'([^']+)'/);
    if (m) { name = m[1]; break; }
  }
  if (name !== "firefox" && name !== "webkit") continue;
  lines[i] = lines[i].replace(
    "testIgnore: /camera-recognition\.spec\.ts/,",
    "testIgnore: /camera-(recognition|announcements)\.spec\.ts/,",
  );
  changed++;
}
if (changed !== 2) { console.error(`expected 2 edits, made ${changed}`); process.exit(1); }

// Explain the second name where the first is already explained.
const i = lines.findIndex((l) => l.includes("The fake-camera flags are Chromium-only."));
if (i !== -1) {
  lines.splice(i, 1,
    "      /*",
    "       * Both camera specs are Chromium-only, for two different reasons.",
    "       * camera-recognition needs the fake-capture launch flags; ",
    "       * camera-announcements declares permissions: [\"camera\"], and only",
    "       * Chromium implements Playwright's permission grants. Neither is a",
    "       * product limitation -- the pages work in all three browsers.",
    "       */",
  );
}
fs.writeFileSync(p, lines.join("\n"));
console.log(`updated ${changed} projects`);
