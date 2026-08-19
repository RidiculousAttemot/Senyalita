import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards against source files that exist locally but not in the repository.
 *
 * src/app/admin/(dashboard)/models/ was silently absent from every clone and
 * every deployment for an unknown period, because .gitignore carried an
 * unanchored `models/` rule that matched a directory of that name at ANY
 * depth. The pages were on one developer's disk and nowhere else.
 *
 * WHY NO OTHER CHECK CATCHES THIS. typecheck, lint, unit tests, the
 * production build and even the admin-nav e2e test all read the working
 * tree, where the file is present — so all five pass green while production
 * 404s. The nav-link e2e test is specifically not a substitute: it resolves
 * the route locally and reports success. Only asking git what it is ignoring
 * distinguishes "this file exists" from "this file is in the repository".
 *
 * If this fails, do not add an exception. Either the ignore pattern needs
 * anchoring (a leading slash pins it to the repo root), or the file genuinely
 * should not be under src/.
 */

const REPO_ROOT = path.resolve(__dirname, "../../..");

function ignoredUnder(dir: string): string[] {
  // --ignored=matching lists individual ignored files rather than collapsing
  // them to the containing directory, so the offending path is named exactly.
  const stdout = execFileSync(
    "git",
    ["status", "--ignored=matching", "--porcelain", "--", dir],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );

  return stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith("!!"))
    .map((line) => line.slice(3).trim());
}

function untrackedUnder(dir: string): string[] {
  const stdout = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "--", dir],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  return stdout.split(String.fromCharCode(10)).map((l) => l.trim()).filter(Boolean);
}

describe("no source file is hidden from the repository", () => {
  it("nothing under src/ is git-ignored", () => {
    const ignored = ignoredUnder("src");
    expect(
      ignored,
      `These files exist locally but are excluded from git, so they are missing ` +
        `from every clone and deployment:\n  ${ignored.join("\n  ")}\n` +
        `Anchor the offending .gitignore pattern with a leading slash.`,
    ).toEqual([]);
  });

  it("nothing under src/ is untracked", () => {
    const untracked = untrackedUnder("src");
    expect(
      untracked,
      [
        "These files exist locally but were never committed, so they are",
        "missing from every clone and deployment:",
        ...untracked,
        "Commit them, or move them out of src/ if they are genuinely scratch.",
      ].join(" "),
    ).toEqual([]);
  });

  it("nothing under e2e/ or supabase/ is git-ignored", () => {
    // Migrations and specs are history and coverage respectively; an ignored
    // migration would be even harder to notice than an ignored page.
    for (const dir of ["e2e", "supabase"]) {
      const ignored = ignoredUnder(dir);
      expect(ignored, `git-ignored files under ${dir}/:\n  ${ignored.join("\n  ")}`).toEqual([]);
    }
  });
});
