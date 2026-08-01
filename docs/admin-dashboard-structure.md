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


## Key Database Tables

### Recognition Pipeline
- `gestures` - Core gesture definitions (133 classes)
- `gesture_captures` - Training data (14K+ labeled samples)
- `translation_sessions` - Recognition sessions (metadata)
- `translation_logs` - Per-frame predictions (timestamp, confidence, label)
- `recognition_logs` - Audit trail (future: enabled in Phase 6)

### Asset Management
- `gesture_definitions` - Gesture library with pose sequences
- `gesture_replies` - Pre-defined response gestures

### Type-to-Sign (Future)
- `gloss_mappings` - English text → FSL gloss
- `pose_sequences` - Stored animation data
- `animation_assets` - Video clips and motion data

---

## Authentication & Authorization

### Admin Access
- Supabase admin auth via `app_metadata.role = 'admin'`
- Each page calls `requireAdmin()` server action
- Layout does NOT gate (each page enforces independently)
- `/admin/login` redirects non-admin users

### RLS Policies
- Admin users have full read/write access to:
  - gesture_definitions
  - gesture_captures
  - translation_sessions
  - translation_logs
  - model_versions (future)
- Regular users only see public gesture library and their own session history

---

## Upcoming Phases

### Phase 6 - Recognition Logging
- Enable audit trail of all predictions
- Populate recognition_logs table on each prediction
- Implement `/admin/audits/logs` table view with filtering
- Add confidence reports and gesture history analysis

### Phase 7 - Gesture Coverage & Translation
- `/admin/gesture-coverage` - Analyze class coverage (weak classes, confusion pairs)
- `/admin/translation-coverage` - Check FSL gloss mapping completeness
- Recommend dataset expansion priorities

### Phase 8 - Type-to-Sign Asset Creation
- `/admin/capture/record` - Video recording UI for pose capture
- Pose sequence extraction pipeline (automated MediaPipe processing)
- Batch import tool for gesture animation assets
- Status tracking: which alphabet letters/glosses have pose sequences

### Phase 9 - Settings & Monitoring
- `/admin/settings` - System configuration (recognition thresholds, logging levels, etc.)
- Enhanced `/admin/system` with real-time Vercel/Supabase metrics
- Sentry error tracking dashboard

---

## File Changes Summary

### New Files Created
- `/src/app/admin/(dashboard)/library/page.tsx` - Library overview
- `/src/app/admin/(dashboard)/library/alphabet/page.tsx` - Alphabet grid
- `/src/app/admin/(dashboard)/capture/page.tsx` - Capture Studio hub
- `/src/app/admin/(dashboard)/training/page.tsx` - Training hub
- `/src/app/admin/(dashboard)/audits/page.tsx` - Audits overview
- `/src/app/admin/(dashboard)/audits/logs/page.tsx` - Recognition logs viewer

### Files Modified
- `/src/components/admin/AdminSidebar.tsx` - Updated SECTIONS array (4 groups → 7 groups), added coming-soon support, updated navigation rendering
- `/src/components/admin/AdminSidebar.module.css` - Added 50+ lines for coming-soon badges and disabled item styling
- `/src/app/admin/(dashboard)/page.tsx` - Simplified dashboard landing with thesis workflow focus

### Files Unchanged
- `/src/app/admin/layout.tsx` - Single sidebar provider (confirmed working)
- `/src/app/admin/(dashboard)/layout.tsx` - Pass-through (confirmed working)
- All existing admin pages (analytics, models, etc.) - Backward compatible

---

## Testing Checklist

- [x] Build passes with `npm run build` (no new errors)
- [x] Lint clean with `npm run lint` (0 new warnings from admin changes)
- [x] Sidebar renders single instance (no duplication)
- [x] Active link detection working (pathname matching)
- [x] Coming-soon items non-navigable (preventDefault on click)
- [x] Responsive at breakpoints (1024px, 768px)
- [x] Dark theme active by default (#1e293b)
- [x] Light theme works via @media (prefers-color-scheme: light)
- [ ] Manual login test (Supabase admin auth)
- [ ] Expand/collapse groups (collapsible state)
- [ ] Click implemented links (navigate to correct pages)
- [ ] Sign-to-Text unaffected (/translate still works)
- [ ] Type-to-Sign unaffected (/type-to-sign still works)

---

## References

- **Main Dashboard:** [/admin](/admin)
- **Navigation Code:** [src/components/admin/AdminSidebar.tsx](src/components/admin/AdminSidebar.tsx)
- **Styles:** [src/components/admin/AdminSidebar.module.css](src/components/admin/AdminSidebar.module.css)
- **Thesis Overview:** [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md)
- **Training Pipeline:** [docs/model-training-reference.md](docs/model-training-reference.md)
- **Recognition Analysis:** [docs/recognition-analysis-guide.md](docs/recognition-analysis-guide.md)
