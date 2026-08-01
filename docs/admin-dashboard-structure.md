# Admin Dashboard Structure

**Rewritten to match the code on 2026-08-01.** The 7-group, 30-page dashboard
this document used to describe was cut to a single animation-management console
by the `cleanup/final-architecture` effort — see `CLEANUP_PLAN.md`. If you find
this file describing a page that 404s, trust `src/lib/admin/navigation.ts` and
`e2e/admin-nav.spec.ts` over this doc; the latter fails the build if a nav entry
ever points at a route that doesn't exist.

## What the admin panel is for

Senyalita ships exactly two public workflows — Sign-to-Text (`/translate`,
camera tab) and Type-to-Sign (`/translate`, type tab). The admin panel manages
**one** thing in support of them: the animation assets Type-to-Sign plays back.
There is no dataset-collection, training, or model-retraining UI in the running
app — the recognition model is trained offline (`scripts/`) and deployed as a
static artifact under `public/models/`.

## Routes (8 total)

| Route | Auth | Purpose |
|---|---|---|
| `/admin` | `requireAdmin()` | Overview: recognition health metrics, animation pipeline counts, recent activity |
| `/admin/login` | public | Supabase email/password sign-in |
| `/admin/logout` | public | Clears the Supabase session, redirects to login |
| `/admin/system` | `requireAdmin()` | Service checks (DB, storage, telemetry), recognition runtime status, animation publishing pipeline counts |
| `/admin/animation-studio` | `requireAdmin()` | Upload a signer video → extract landmarks → preview skeleton → publish |
| `/admin/animation-dataset` | `requireAdmin()` | Animation Dataset Manager |
| `/admin/animation-library` | `requireAdmin()` | Browse/search published + in-progress animation assets |
| `/admin/animation-inspector` | `requireAdmin()` | Look up a gloss, see which resolution strategy served it, preview the skeleton |

Every page above now calls `requireAdmin()` itself (defense in depth) in
addition to the global `src/middleware.ts` check — four of the eight used to
rely on the middleware alone.

## Auth

Supabase Auth; an account is an admin if `app_metadata.role === "admin"`.
`requireAdmin()` (`src/lib/supabase/queries/profiles.ts`) throws
`UnauthenticatedError` (401) or `ForbiddenError` (403) accordingly — see
`src/lib/supabase/__tests__/profiles.test.ts`. The login server action
(`src/lib/supabase/actions.ts`) rate-limits to 5 attempts/minute per caller.
There is no separate cookie-based admin session anymore; `ADMIN_PASSWORD` and
`src/lib/admin-auth.ts` were removed as dead code.

## Animation Studio workflow

1. **Video Upload** — file picker or webcam recording, capped at 60s / 500MB.
2. **Pose Extraction** — MediaPipe Holistic runs client-side over the video,
   producing a landmark sequence.
3. **Skeleton Preview** — scrub the extracted skeleton against the source video.
4. **Publish** — uploads the source recording (`POST /api/admin/animation-assets/upload`)
   and the landmark JSON (`POST /api/admin/animation-assets/[versionId]/action`).
   Both come from the same recording, which is what keeps Human Mode (video)
   and Skeleton Mode in sync on the public Type-to-Sign viewer.

## Component architecture

- `AdminShell` / `AdminSidebar` — shell + nav, driven entirely by
  `ADMIN_NAVIGATION` in `src/lib/admin/navigation.ts`. Add a page there, not by
  hand-editing the sidebar.
- Dashboard pages are async Server Components that call `requireAdmin()` then
  render a client component from `src/components/admin/`.


## Animation Library

The single source of truth for every animation asset (`/admin/animation-library`).
Each version row carries: original source video, landmark JSON, thumbnail,
gloss, language, fps, duration, frame count, storage size (landmark JSON
bytes), quality score, created/published dates, version number, and status.

- **Preview** — opens the real `SignAnimationPlayer` (Human / Skeleton / Split
  / Overlay, lazy-loaded) against that version's actual asset, not just the
  published one — an admin can preview a draft before approving it.
- **Edit Metadata** — language only; gloss is the lookup key and isn't
  renameable from here, and category/difficulty/keywords fields were removed
  from Publish (the schema never persisted them — see `git log` on
  `PublishTab.tsx`).
- **Replace Version** — links to `/admin/animation-studio?gloss=<gloss>`,
  which pre-fills Publish's gloss field. Publishing there creates version N+1;
  version N is kept (archived once N+1 publishes), never overwritten.
- **Delete** — hard delete, asset + all versions + storage objects. Distinct
  from Archive (reversible, keeps history). Confirmation required, not undoable.
- **Download Video / Download JSON** — signed URLs, generated on demand
  (`GET /api/admin/animation-assets/[versionId]/asset`), not preloaded.

Search/lookup normalization (`src/features/sign-animation/gloss.ts`,
`normalizeGloss()`) is centralised: uppercase, trim, hyphens and whitespace
both collapse to `_`. Applied at upload, at every cache/resolver lookup, and
server-side in `lib/supabase/queries/animationAssets.ts` — "hello-world",
"hello_world" and "Hello World" all resolve to the same asset.

Lookup order (`src/server/services/animationAssets.ts`): published Supabase
asset, then a local dev-only directory fallback (disabled in production
regardless of flag), then the caller fingerspells on a miss. Never a local
search before the published lookup.

## Verified correct, left unchanged

- Human/Skeleton/Split/Overlay sync (time-based, not frame-based) —
  `SignAnimationPlayer.tsx`.
- No blanket asset preload — Type-to-Sign warms only the debounced
  currently-typed message, not the whole alphabet on mount.
- Fingerspelling fallback messaging — `TranslationResult.tsx` already shows
  "Spelled letter by letter: X — no recorded sign for these yet."; never an error.

