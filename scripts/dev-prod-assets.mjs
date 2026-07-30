#!/usr/bin/env node
/**
 * Dev server with the local animation fallback OFF.
 *
 * `datasets/processed/user_holistic_assets` is a development-only convenience
 * that is never deployed, so with it on, dev resolves ~38 glosses that
 * production cannot. Worse, it masks failure: a published asset whose Supabase
 * lookup errors gets silently served from disk, and the incident looks like a
 * success locally while production 404s and fingerspells.
 *
 * This runs the same dev server with ANIMATION_LOCAL_FALLBACK=0, so asset
 * resolution behaves exactly as it does in production: published or nothing.
 *
 *   npm run dev:prod-assets
 */
import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, ANIMATION_LOCAL_FALLBACK: "0" },
});

child.on("exit", (code) => process.exit(code ?? 0));
