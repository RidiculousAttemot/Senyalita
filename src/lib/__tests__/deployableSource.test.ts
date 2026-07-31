import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the class of bug where a route serves content from the local
 * filesystem that is never deployed.
 *
 * The /api/videos route read datasets/raw/user_videos off process.cwd().
 * That directory existed during development and was absent from every
 * deployment, because .vercelignore excludes `datasets`. Every request 404'd
 * in production while the same request worked locally, and the player drew a
 * silent blank pane. This is the same shape as the git-ignored admin pages
 * guarded by ignoredSource.test.ts: content that exists on one machine and
 * ships nowhere.
 *
 * WHY ROUTES SPECIFICALLY. The build, typecheck, lint and unit tests all
 * read the working tree, so a route that reads disk at request time passes
 * every local check and breaks on Vercel, where the function bundle is
 * read-only and only the deployed files exist. Route handlers read request
 * input and Storage, never process.cwd() via fs. A file that must be served
 * lives in public/ (deployed) or Storage — not in a directory the deploy
 * excludes.
 */
const REPO_ROOT = path.resolve(__dirname, "../../..");

function routeFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(p);
      } else if (/^route\.(ts|tsx)$/.test(entry.name)) {
        out.push(p);
      }
    }
  };
  walk(path.join(REPO_ROOT, "src", "app", "api"));
  return out;
}

describe("route handlers do not read from the working tree at request time", () => {
  it("no src/app/api route combines an fs import with process.cwd()", () => {
    const offenders: string[] = [];
    for (const file of routeFiles()) {
      const source = fs.readFileSync(file, "utf-8");
      const usesFs = /(?:from\s+["'](?:node:)?fs["']|require\(["'](?:node:)?fs["']\))/.test(source);
      const usesCwd = /process\.cwd\(\)/.test(source);
      if (usesFs && usesCwd) {
        offenders.push(path.relative(REPO_ROOT, file).replace(/\\/g, "/"));
      }
    }
    expect(
      offenders,
      "These route handlers read from process.cwd() via fs. Anything outside the deployed " +
        "bundle (i.e. not under public/) 404s in production while working locally. Serve it " +
        "from Storage or public/ instead:\n" + offenders.map((f) => `  ${f}`).join("\n"),
    ).toEqual([]);
  });
});
