/**
 * Checks every tutorial link in src/data/tutorials.json still resolves.
 *
 * External links rot, and a dead link in a thesis artefact is worse than a
 * missing one. This is deliberately NOT part of the e2e gate: that would make
 * the test suite fail whenever someone else's site is down. Run it before the
 * defense, or whenever the list changes.
 *
 *   node scripts/verify-tutorials.mjs
 *
 * Exits non-zero if any link fails, so it can be wired into CI later if that
 * ever becomes worth the flakiness.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "src", "data", "tutorials.json");
const { tutorials } = JSON.parse(readFileSync(FILE, "utf8"));

// Some hosts reject non-browser clients outright; a plain fetch would report a
// working link as broken.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const results = await Promise.all(
  tutorials.map(async (t) => {
    const started = Date.now();
    try {
      const res = await fetch(t.url, {
        redirect: "follow",
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(45_000),
      });
      return { ...t, status: res.status, ms: Date.now() - started };
    } catch (error) {
      return { ...t, status: 0, ms: Date.now() - started, error: String(error?.message ?? error) };
    }
  }),
);

let failed = 0;
for (const r of results) {
  const ok = r.status >= 200 && r.status < 400;
  if (!ok) failed++;
  console.log(
    `  ${ok ? "OK  " : "FAIL"} ${String(r.status).padEnd(3)} ${r.title} — ${r.creator}` +
      (r.error ? `\n         ${r.error}` : ""),
  );
}

console.log(`\n  ${results.length - failed}/${results.length} links resolved.`);
if (failed) {
  console.log(
    "  Update the url, or drop the entry. Do not leave a dead link in a page\n" +
      "  that credits someone else's work.",
  );
  process.exit(1);
}
