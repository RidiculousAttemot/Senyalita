# Cleanup Plan — Final Architecture

**Status: proposal. Nothing has been deleted.**

Baseline `20fa89da`, tag `pre-cleanup`, branch `cleanup/final-architecture`.
All four commands pass at baseline (typecheck 10s, lint 7s, test 20s, build 431s),
so the bar is "still all green".

Recovery for anything below: `git show pre-cleanup:<path>`, or
`git checkout pre-cleanup -- <dir>` for a whole directory.

---

## Three things that block a naive deletion

Found while tracing; each contradicts the obvious reading of the scope doc.

**1. `features/fsl-translation` is load-bearing for Sign-to-Text.**
`suggestions/vocabulary.ts:9` imports `globalDictionary` from
`fsl-translation/dictionary/gestureDictionary`. That dictionary *is* the word
list behind the suggestion engine. Deleting `fsl-translation` breaks the primary
workflow. → Only its unreachable subtrees are proposed.

**2. `features/ai-assist` is animation tooling, not an LLM.**
The name suggests it falls under "remove AI", but it is imported by the
Animation Studio, which is an explicit keeper:
- `AnimationStudio/PoseExtractionTab.tsx:19` → `suggestGloss`
- `AnimationStudio/PublishTab.tsx:24` → `validateAsset`, `analyzeQuality`, `generateMetadata`
- `AdminDashboardOverview.tsx:12` → `detectMissingAnimations`

It is heuristic gloss-matching over the local dictionary, with no network call.
→ **Keep.**

**3. `features/translation-pipeline` is the Text-to-Sign dictionary lookup.**
`TypeToSignInterface.tsx:121` uses it only as
`globalPipeline.translate(text).animationPlan.items.map(i => i.animationKey)` —
text in, animation keys out. That is exactly the "dictionary lookup" the final
scope calls for. → Keep the lookup path; only its provably unused adapters are
proposed (Tier A), and full simplification is deferred as a separate task.

---

## TIER A — tracked, reversible via tag. Proposed for deletion.

### A1. Orphan feature directories (zero inbound imports)

| Path | Size | Files | Evidence | Outside |
|---|---|---|---|---|
| `src/features/adaptive-memory` | 29K | 5 | 0 inbound imports repo-wide | neither workflow |
| `src/features/adaptive-thresholds` | 13K | 3 | 0 inbound | neither workflow |
| `src/features/dataset` | 6.0K | 3 | 0 inbound | superseded by `server/services/datasetCatalog` |
| `src/features/feedback` | 13K | 3 | 0 inbound | feedback is out of scope |
| `src/features/gestures` | 21K | 3 | 0 inbound | gesture CRUD, not alphabet |
| `src/features/knowledge-expansion` | 9.0K | 2 | 0 inbound | research prototype |

### A2. Mutually-circular orphan pair

`text-to-sign` and `translation-result` import **only each other**; nothing else
in the repo imports either. A naive "is it imported?" check keeps both alive —
they are dead as a pair.

| Path | Size | Files | Evidence | Outside |
|---|---|---|---|---|
| `src/features/text-to-sign` | 88K | 10 | sole importer is `translation-result/index.ts` | superseded by `type-to-sign` |
| `src/features/translation-result` | 1.0K | 1 | sole importer is `text-to-sign/TextToSignInterface.tsx` | same |

### A3. Features reachable only from out-of-scope pages

Alive today, dead once the pages in A4 go. Sequence after A4.

| Path | Size | Files | Reachable only from | Outside |
|---|---|---|---|---|
| `src/features/conversation` | 117K | 18 | `/conversation`, `analytics`, `assistant` | conversation mode |
| `src/features/assistant` | 8.0K | 1 | `/conversation` | chat assistant |
| `src/features/analytics` | 100K | 12 | `/learn` | learning analytics |
| `src/features/logging` | 85K | 11 | `/(routes)/history` | session history |

### A4. Out-of-scope routes (judged by route, not by import)

Each has **0 inbound links** in `src/`. `/type-to-sign` additionally
short-circuits: `next.config.mjs:28` redirects it to `/translate`, so the page is
unreachable in production regardless.

| Route | Size | Evidence | Outside |
|---|---|---|---|
| `src/app/conversation` (+`[id]`) | 44K | 0 links | conversation mode |
| `src/app/evaluation` | 12K | 0 links | research page |
| `src/app/learn` | 12K | 0 links | learning module |
| `src/app/presentation` | 16K | 0 links | demo deck |
| `src/app/(routes)/history` | 32K | 0 links | session history |
| `src/app/type-to-sign` | 5.0K | 0 links **and** redirected away | duplicate of `/translate` |

⚠️ `/type-to-sign` deletion must also drop its `next.config.mjs` redirect, and
`/sign-to-text` redirects to `/translate` while no such route exists — vestigial,
propose removing both redirect entries.

### A5. `scripts/` — 130 of 134 unreferenced

`package.json` wires only four (the canonical pipeline per `AGENTS.md` Phase 45):
`standardize-fsl-alphabet-dataset.mjs`, `build-unified-dataset-v4.mjs`,
`train-unified-bilstm-v2.mjs`, `export-unified-bilstm-tfjs.mjs`.

I am **not** proposing a blanket delete of the other 130. They are one-off
research tools whose output is thesis evidence, and several (`db-*.mjs`,
`api-verify.mjs`, `seed-animation-assets.mjs`) are operationally useful. Proposed
instead: delete only the explicitly superseded versioned duplicates
(`*-v2/-v3/-v4` where a later one exists), listed at execution time after a
per-file check. Everything else stays pending your call.

---

## TIER B — needs your decision

You said you have recent uncommitted work in several of these areas, so I am not
assuming they are dead even where the evidence points that way.

### B1. Admin pages — 30 exist, 6 are keepers

Keepers per scope: `animation-studio`, `animation-dataset`, `animation-library`,
`login`, `system`, `models` (only if genuinely used).

Candidates: `ai-insights`, `ai-review-queue`, `analytics`, `animation-inspector`,
`audits`, `audits/logs`, `capture`, `collection`, `dataset`,
`experiment-tracking`, `hard-case-dataset`, `model-comparison`, `model-health`,
`models/training`, `monitoring`, `notifications`, `playback-analytics`,
`recognition-analysis`, `review`, `training`, `translation-debug`,
`translation-evaluation`, `users`.

All are linked from the admin nav, so all are *reachable*; the question is scope,
not reachability. **Note `admin/gesture-library/import` is linked in the nav but
has no page — a dead nav entry, broken today.**

### B2. API routes — 6 of 14 outside the two workflows

| Route | Note |
|---|---|
| `/api/ai/replies` | LLM calls; I added rate limiting + injection guards this session |
| `/api/collection` | data collection |
| `/api/feedback` | feedback |
| `/api/predictions/correct` | active-learning corrections |
| `/api/signers/register` | signer profiles |
| `/api/text-to-sign/log` | telemetry |

Keepers: `/api/animations/[gloss]`, `/api/assets/dataset`, `/api/admin/*` (4),
`/api/videos/[label]/[file]`.

### B3. npm packages

Deferred to Stage 6 and verified with `knip` after the source deletions land —
removing a package before its importers are gone gives a false reading.
Early candidates: `ffmpeg-static`, `sharp` (no `src/` imports found), and the
`@mediapipe/{camera_utils,drawing_utils,hands}` trio, which appear superseded by
`@mediapipe/tasks-vision`. Not proposed yet.

---

## TIER C — unrecoverable. Listed only, not proposed.

`git` cannot restore these. **Nothing here will be deleted by me.**

| Path | Size | Observation |
|---|---|---|
| `datasets/` | 37G | Largely gitignored |
| `datasets/processed/user_holistic_assets` | 933M | **Now redundant** — all 37 glosses are published to Supabase and serve from `published`. Verified with the local fallback disabled. Safe to archive offline. |
| `datasets/archive/` | 7.1G | Explicitly "archive", gitignored |
| `datasets/processed/fsl_105`, `fsl_unified_augmented`, `fsl_unified_balanced`, `fsl_unified_v4` | part of 27G | Superseded by `fsl_alphabet_kaggle_v2` (production per Phase 45) |
| `models/fsl_unified/bilstm_v4`, `bilstm_v4_bak` | small | Phase 43 records "Decision: not deployed" |
| `.claude/worktrees/suspicious-lichterman-17dc78` | **38G** | Stale git worktree at old commit; duplicates all datasets. `git worktree remove` reclaims it. Biggest single win. |

**Migrations: never deleted.** All 41 stay. Several were never applied, but they
are history, not code.

**Keep:** `datasets/processed/fsl_alphabet_kaggle_v2` (production dataset),
`models/fsl_unified/bilstm_v2` (production model),
`public/models/fsl_unified/bilstm_tfjs/` (what the browser loads).

---

## knip cross-check

`npm run knip` reports **191 unused files**, concentrated in `text-to-sign` (10),
`analytics` (10), `fsl-translation` (8), `active-learning` (5), `conversation`
(3). This corroborates A1–A3 but is **not** treated as authoritative: it
under-reports App Router files (it cannot see route conventions) and flags
`fsl-translation` broadly despite `gestureDictionary` being load-bearing.

---

## Proposed order

1. A1 orphan features (zero inbound — safest)
2. A2 circular pair
3. A4 routes, plus the two `next.config.mjs` redirects
4. A3 features orphaned by step 3
5. A5 superseded scripts only
6. **Stop for Tier B decisions**

Typecheck + lint + test + build after each; commit per stage; revert only the
offending stage on regression.

## Not proposed

- Any migration
- Anything under `datasets/`, `models/`, `public/`
- `features/fsl-translation` wholesale (dictionary is load-bearing)
- `features/ai-assist` (Animation Studio depends on it)
- `features/translation-pipeline` wholesale (Text-to-Sign lookup)
- `features/suggestions`, `recognition`, `sign-animation`, `sign-to-text`,
  `type-to-sign`, `profiles` — all core to the two workflows
