/**
 * Local production build + server, for verifying things `next dev` cannot show.
 *
 * Dev mode differs from the deployed build in ways that hide real bugs. The one
 * that prompted this: React StrictMode double-invokes effects in dev, so a ref
 * that a production build leaves null gets initialised locally -- and the
 * player's "human" view mode painted 100% of its canvas in dev while painting
 * 0.0% on production.
 *
 * Verifying that against deploys costs a deploy per iteration. This runs the
 * same bundle production gets, locally.
 *
 * NEXT_DIST_DIR=.next-prod keeps the build out of .next, so it cannot clobber a
 * dev server running from the same working tree -- this repo often has more
 * than one up at once.
 *
 * ANIMATION_LOCAL_FALLBACK=0 matches production's asset resolution, the same
 * reason dev:prod-assets exists.
 *
 * `next start` prints:
 *     "next start" does not work with "output: standalone" configuration.
 * Ignore it here. next.config.mjs sets `output: standalone` for the Docker
 * runtime stage, and next start warns whenever it sees that -- but it serves
 * correctly regardless, and this harness was validated against production on a
 * case where they could have disagreed: the player's "human" view mode paints
 * 0.0% and "overlay" 4.5% in both, matching the deployed build exactly while
 * `next dev` reported 100% for human. The warning costs someone an hour if they
 * take it at face value.
 *
 * Usage:  node scripts/prod-build-harness.mjs [--port 3400] [--skip-build]
 */

import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const PORT = portIndex !== -1 && args[portIndex + 1] ? args[portIndex + 1] : process.env.PORT || "3400";
const SKIP_BUILD = args.includes("--skip-build");

const env = { ...process.env, NEXT_DIST_DIR: ".next-prod", ANIMATION_LOCAL_FALLBACK: "0", PORT };

const run = (cmd, cmdArgs) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: "inherit", shell: true, env });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });

if (!SKIP_BUILD) {
  console.log("[harness] building into .next-prod (dev servers on .next are untouched)");
  await run("npx", ["next", "build"]);
}

console.log(`[harness] starting production server on :${PORT}`);
await run("npx", ["next", "start", "--port", PORT]);
