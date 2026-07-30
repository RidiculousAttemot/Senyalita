#!/usr/bin/env node
/**
 * Secret scanner for git history.
 *
 * Written 2026-07-31 after a live Supabase `service_role` JWT sat on
 * `origin/main` for six weeks while two earlier checks reported the repo
 * clean. Both checks failed the same way: they scanned the local working tree
 * and stated the conclusion about the repository. See ROTATION.md §0.5.
 *
 * So this scans OBJECTS, not files — every blob reachable from every ref,
 * including blobs whose commits are no longer on any branch tip. A file
 * cleaned on your branch is still published if an ancestor of origin/main
 * carries it.
 *
 * Usage:
 *   node scripts/audit-secrets.mjs                     # all refs, all history
 *   node scripts/audit-secrets.mjs --range A..B        # only that range
 *   node scripts/audit-secrets.mjs --range "S --not --remotes"
 *
 * Exit code 1 on any finding, so it works as a gate.
 * Values are NEVER printed — only path, line, kind, and a masked preview.
 */
import { execSync, spawnSync } from "node:child_process";

const MAX_BLOB = 2_000_000;

/**
 * Binary and model formats. Excluded because a secret cannot hide in them in a
 * form this scanner could recognise, and they dominate the pack (31.9 GiB, of
 * which >99% is PNG frames and MP4 source video).
 */
const SKIP_EXT = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp4|mov|webm|zip|gz|tgz|7z|rar|pdf|bin|h5|onnx|tflite|pb|npy|npz|pt|pth|ckpt|safetensors|wasm|node|dll|exe|so|dylib|class|jar|mp3|wav)$/i;

/**
 * Generated or vendored trees. `datasets/` and `models/` are landmark and
 * weight data. Nothing here is hand-authored, and hand-authoring is how
 * credentials get committed.
 */
const SKIP_PATH = /(^|\/)(node_modules|\.next|dist|build|coverage|datasets|public\/models|models)\//i;

const PATTERNS = [
  ["private-key", /-----BEGIN (RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/g],
  ["aws-access-key", /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ["github-token", /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g],
  ["github-pat", /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ["slack-token", /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g],
  ["stripe-live", /\b(sk|rk)_live_[0-9A-Za-z]{20,}\b/g],
  ["anthropic-key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g],
  ["openai-key", /\bsk-(proj-)?[A-Za-z0-9]{40,}\b/g],
  ["supabase-secret", /\bsb_secret_[A-Za-z0-9_-]{10,}\b/g],
  ["supabase-publishable", /\bsb_publishable_[A-Za-z0-9_-]{10,}\b/g],
  /**
   * Three segments, all present. A two-segment match would fire on the bare
   * header `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`, which is the base64 of
   * {"alg":"HS256","typ":"JWT"} and therefore identical in every HS256 token
   * ever issued. Docs quote that prefix constantly; it is not a secret. The
   * signature is what makes a JWT usable, so require it.
   */
  ["jwt-full", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g],
  ["pg-url-with-password", /postgres(?:ql)?:\/\/[^:\s"']+:[^@\s"']+@[^\s"'/]+/g],
  ["generic-assignment", /\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd)\s*[:=]\s*["'][^"'\s]{16,}["']/gi],
];

/**
 * Placeholder filter. Every entry here exists because a real string in this
 * repo matched a pattern above and was not a secret. Do not loosen these
 * casually, and do not add one without a concrete example — each is the
 * difference between a scanner people trust and one they learn to ignore.
 *
 *   \[...\]  `[PASSWORD]`  — the redaction style ROTATION.md standardised on
 *   <...>    `<pwd>`       — docs/production-deployment-report.md:34
 *   ${...}   `${process.env.DB_PASSWORD}` — scripts/db-find-region.mjs.
 *            Its absence caused a false positive on 2026-07-31 that was
 *            escalated as a live public credential. It is a template literal.
 *   {{...}}  moustache templating in docs
 *   your-/example/placeholder/changeme/dummy/sample — .env.example conventions
 *   ***, ..., …  — truncation markers in audit reports
 *
 * This filter is why the scanner must also print its own coverage: a filter
 * that silently swallows a real secret is worse than no filter.
 */
const PLACEHOLDER = /\[[^\]]+\]|<[^>]+>|\{\{|\$\{|\$[A-Z_]{3,}|xxx+|your[-_]|example|placeholder|redact|changeme|dummy|sample|\*\*\*|\.\.\.|…/i;

const args = process.argv.slice(2);
const rangeIdx = args.indexOf("--range");
const range = rangeIdx >= 0 ? args[rangeIdx + 1] : null;

const git = (cmd) => execSync(`git ${cmd}`, { maxBuffer: 1 << 30 }).toString();

// blob sha -> paths it has ever been stored under
const pathsBySha = new Map();
let skippedBinary = 0;

const keep = (sha, p) => {
  if (!p) return;
  if (SKIP_EXT.test(p) || SKIP_PATH.test(p)) { skippedBinary += 1; return; }
  if (!pathsBySha.has(sha)) pathsBySha.set(sha, new Set());
  pathsBySha.get(sha).add(p);
};

if (range) {
  /**
   * Only blobs the range ADDS or MODIFIES.
   *
   * `rev-list --objects <range>` is the wrong tool here: it walks the full
   * tree of every commit in the range, so a range that merely touches one file
   * still yields every blob in the repo at those commits. On this repo that was
   * 16289 objects for a 3-commit range -- slow, and it reports findings from
   * commits that are already on the remote, which is noise the pusher cannot
   * act on. diff-tree gives exactly what the range introduces.
   */
  const commits = git(`rev-list ${range}`).trim();
  if (commits) {
    const dt = spawnSync(
      "git",
      ["diff-tree", "-r", "--stdin", "--no-commit-id", "--diff-filter=AM"],
      { input: `${commits}\n`, maxBuffer: 1 << 30 },
    );
    for (const line of dt.stdout.toString().split(/\r?\n/)) {
      const tab = line.indexOf("\t");
      if (tab < 0 || !line.startsWith(":")) continue;
      const newSha = line.slice(0, tab).split(/\s+/)[3];
      if (!newSha || /^0+$/.test(newSha)) continue;
      keep(newSha, line.slice(tab + 1).trim());
    }
  }
} else {
  for (const line of git("rev-list --objects --all").split(/\r?\n/)) {
    const sp = line.indexOf(" ");
    if (sp < 0) continue;
    keep(line.slice(0, sp), line.slice(sp + 1).trim());
  }
}

// Drop oversized blobs before reading any content.
const sizes = git('cat-file --batch-all-objects --batch-check="%(objectname) %(objecttype) %(objectsize)"');
const wanted = [];
let skippedLarge = 0;
for (const line of sizes.split(/\r?\n/)) {
  const [sha, type, size] = line.split(" ");
  if (type !== "blob" || !pathsBySha.has(sha)) continue;
  if (Number(size) > MAX_BLOB) { skippedLarge += 1; continue; }
  wanted.push(sha);
}

const findings = [];
let scanned = 0;

if (wanted.length) {
  const proc = spawnSync("git", ["cat-file", "--batch"], {
    input: `${wanted.join("\n")}\n`,
    maxBuffer: 1 << 30,
  });
  let buf = proc.stdout;
  let off = 0;
  while (off < buf.length) {
    const nl = buf.indexOf(0x0a, off);
    if (nl < 0) break;
    const header = buf.slice(off, nl).toString();
    const m = header.match(/^([0-9a-f]{40}) blob (\d+)$/);
    if (!m) { off = nl + 1; continue; }
    const size = Number(m[2]);
    const body = buf.slice(nl + 1, nl + 1 + size);
    off = nl + 1 + size + 1;
    scanned += 1;
    if (body.includes(0)) continue; // binary despite the extension

    const text = body.toString("utf8");
    for (const [kind, re] of PATTERNS) {
      re.lastIndex = 0;
      let hit;
      while ((hit = re.exec(text))) {
        const value = hit[0];
        if (PLACEHOLDER.test(value)) continue;
        const line = text.slice(0, hit.index).split("\n").length;
        for (const p of pathsBySha.get(m[1])) {
          findings.push({
            kind,
            path: p,
            line,
            masked: `${value.slice(0, 8)}…<masked len=${value.length}>`,
            key: `${kind}::${value}`,
          });
        }
      }
    }
  }
}

// Coverage is printed unconditionally. A scanner that reports only findings
// invites the exact mistake this file was written after: reading "clean" as
// "the repository is clean" when it meant "the part I looked at is clean".
const scope = range ? `range ${range}` : "all refs, all history";
console.log(`audit-secrets: scanned ${scanned} text blobs (${scope})`);
console.log(`               skipped ${skippedLarge} blobs >${MAX_BLOB / 1e6}MB, ${skippedBinary} binary/generated paths`);

const unique = new Map();
for (const f of findings) if (!unique.has(f.key)) unique.set(f.key, f);

if (!unique.size) {
  console.log("               no secrets found");
  process.exit(0);
}

console.error(`\n${unique.size} SECRET-SHAPED VALUE(S) FOUND:\n`);
for (const f of unique.values()) {
  console.error(`  ${f.kind}`);
  console.error(`    ${f.path}:${f.line}`);
  console.error(`    ${f.masked}`);
}
console.error("\nValues are masked above by design. To inspect one:");
console.error("  git log --all --oneline -- <path>");
process.exit(1);
