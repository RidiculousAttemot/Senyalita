# Type-to-Sign Landmark Asset Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let administrators generate, review, approve, and publish private-video-derived MediaPipe landmark animations that Type-to-Sign resolves through the existing animation queue and canvas player.

**Architecture:** Private source-video and generated-landmark JSON objects are tracked by versioned Supabase rows. A browser-only MediaPipe extraction module produces an extended `GestureAnimationAsset`; an authenticated API resolver returns only published JSON to the public animation loader. Existing translation and playback keep their current responsibilities.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Supabase Storage/Postgres/RLS, `@mediapipe/tasks-vision`, Vitest, existing animation renderer/player.

## Global Constraints

- Preserve translation engine, gloss dictionary, recognition, TensorFlow, `GestureAnimationAsset`, `AnimationClip`, playback engine, and queue APIs.
- Source MP4, MOV, and WebM files are private and admin-only.
- Public Type-to-Sign may resolve only a published landmark JSON asset, never a source-video URL.
- The renderer must support legacy hand-only assets and new pose/face/hand assets.
- Do not add a second animation system or duplicate renderer logic.
- Use scoped admin styles in `src/app/admin/admin.css`; do not add inline styles in new admin code.
- Only one version per canonical gloss may be published.

---

### Task 1: Add database schema and storage policies

**Files:**
- Create: `supabase/migrations/0035_landmark_animation_assets.sql`
- Modify: `src/lib/supabase/types.ts`
- Test: `src/lib/__tests__/animationAssetStatus.test.ts`

**Interfaces:**
- Produces `AnimationAsset`, `AnimationAssetVersion`, `AnimationAssetReview`, `AnimationProcessingJob`, `AnimationAssetStatus`, and `AnimationProcessingStatus` types.
- Produces private `animation-source-videos` and `animation-landmarks` buckets and admin-only RLS policies using `public.is_admin()`.

- [ ] Write a failing type/status test for publishability: only `approved` versions can publish; `published`, `archived`, `failed`, and `processing` cannot.
- [ ] Run `npm test -- src/lib/__tests__/animationAssetStatus.test.ts` and verify the import fails before status helpers exist.
- [ ] Add the idempotent migration with four tables, foreign keys, timestamps, an active-version reference, a partial unique index for `status = 'published'`, and RLS policies limited to `public.is_admin()`.
- [ ] Add Storage bucket definitions with `public = false`, a 100 MB limit, and `video/mp4`, `video/webm`, and `video/quicktime` source MIME types; landmark JSON accepts `application/json`.
- [ ] Add the TypeScript entity/status types and a `canPublishAnimationVersion(status)` helper.
- [ ] Rerun the focused test and `npm run typecheck`.

### Task 2: Define the compatible landmark frame representation and processing utilities

**Files:**
- Modify: `src/features/sign-animation/types/index.ts`
- Create: `src/features/sign-animation/processing/landmarkAssetProcessing.ts`
- Create: `src/features/sign-animation/processing/index.ts`
- Test: `src/features/sign-animation/processing/__tests__/landmarkAssetProcessing.test.ts`

**Interfaces:**
- Produces optional `poseLandmarks` and `faceLandmarks` on an animation frame while retaining required `landmarks: HandLandmarks[]`.
- Produces `createGestureAnimationAsset(input)`, `normalizeFrameSequence(frames)`, `repairMissingFrames(frames)`, and `scoreAnimationQuality(asset)`.

- [ ] Write tests for wrist-centered coordinate normalization, filling a missing hand frame from neighboring landmarks, stable FPS resampling, and legacy hand-only compatibility.
- [ ] Run `npm test -- src/features/sign-animation/processing/__tests__/landmarkAssetProcessing.test.ts` and verify the module is absent.
- [ ] Implement pure processing helpers that accept MediaPipe output converted to project landmarks; do not import browser APIs in this module.
- [ ] Serialize the output as a versioned `GestureAnimationAsset` with source/extraction metadata, FPS, duration, frame count, and quality score.
- [ ] Rerun focused tests and `npm run typecheck`.

### Task 3: Implement browser-side MediaPipe video extraction

**Files:**
- Create: `src/features/sign-animation/extraction/holisticVideoExtractor.ts`
- Create: `src/features/sign-animation/extraction/index.ts`
- Test: `src/features/sign-animation/extraction/__tests__/holisticVideoExtractor.test.ts`

**Interfaces:**
- Produces `extractLandmarksFromVideo(video, options, onProgress): Promise<ExtractedAnimationSequence>`.
- `ExtractedAnimationSequence` contains raw pose, face, left hand, right hand, source FPS, duration, and frame timestamps.

- [ ] Write a test for MediaPipe result mapping that retains pose, face, and both hands and skips invalid frames without throwing.
- [ ] Run the focused test and verify it fails before the extractor exists.
- [ ] Implement a client-only extractor using `FilesetResolver` and `HolisticLandmarker` from `@mediapipe/tasks-vision`; sample video frames with `requestVideoFrameCallback` where available and a time-based fallback otherwise.
- [ ] Convert MediaPipe normalized landmarks to project `LandmarkPoint` values; report total/current frames through `onProgress` and release video/object URLs in a `finally` block.
- [ ] Rerun focused tests and `npm run typecheck`.

### Task 4: Extend the existing renderers for complete landmark frames

**Files:**
- Modify: `src/features/sign-animation/renderer/AdvancedCanvasRenderer.ts`
- Modify: `src/features/sign-animation/renderer/LandmarkCanvasRenderer.ts`
- Test: `src/features/sign-animation/renderer/__tests__/landmarkRendering.test.ts`

**Interfaces:**
- Consumes optional pose and face landmark arrays from the existing `AnimationFrame`.
- Keeps `render(frame)` APIs unchanged.

- [ ] Add a rendering test that supplies a full MediaPipe-style frame and verifies calls are made for face, pose, and hands, plus a legacy hand-only frame that still renders.
- [ ] Run the focused test and verify current renderers do not draw pose/face data.
- [ ] Add MediaPipe pose and face connection constants to the existing types module.
- [ ] Extend renderer internals to draw pose in red, face in dark red, left hand in green, and right hand in blue on a transparent/light-neutral configurable canvas; retain current theme behavior in `AdvancedCanvasRenderer`.
- [ ] Rerun focused tests and `npm run typecheck`.

### Task 5: Create protected asset-management query and API boundaries

**Files:**
- Create: `src/lib/supabase/queries/animationAssets.ts`
- Create: `src/app/api/admin/animation-assets/upload/route.ts`
- Create: `src/app/api/admin/animation-assets/[versionId]/action/route.ts`
- Create: `src/app/api/animations/[gloss]/route.ts`
- Test: `src/lib/supabase/__tests__/animationAssetResolver.test.ts`

**Interfaces:**
- Produces `listAnimationAssets`, `createAnimationVersion`, `updateProcessingJob`, `approveAnimationVersion`, `publishAnimationVersion`, and `getPublishedAnimationAsset`.
- Public route returns `GestureAnimationAsset` JSON or HTTP 404 with `{ error: "Animation unavailable." }`.

- [ ] Write resolver tests for published JSON, absent assets, and approved-but-not-published assets.
- [ ] Run the focused test and verify it fails before resolver helpers exist.
- [ ] Implement server-only query helpers with `requireAdmin()` enforced in mutation routes and a transactional publish function that archives the previous published version for the same gloss.
- [ ] Generate signed source-video URLs only in admin routes; do not return them from the public resolver.
- [ ] Rerun tests and `npm run typecheck`.

### Task 6: Resolve published assets through the existing animation loader

**Files:**
- Modify: `src/features/sign-animation/loader/AnimationLoader.ts`
- Modify: `src/features/text-to-sign/TextToSignInterface.tsx`
- Modify: `src/features/type-to-sign/TypeToSignInterface.tsx`
- Test: `src/features/sign-animation/loader/__tests__/AnimationLoader.test.ts`

**Interfaces:**
- `AnimationLoader.load(label)` first asks `/api/animations/<encoded gloss>` for a published asset and falls back to the existing static `/animations/<label>.json` asset for backward compatibility.
- Missing asset returns `null`; callers show `Animation unavailable.` without failing the remaining queue.

- [ ] Add tests covering published API success, 404 fallback to legacy static JSON, and both sources absent.
- [ ] Run the test and verify current loader only requests the static public path.
- [ ] Implement API-first lookup with static fallback and preserve caching, pending-request de-duplication, stats, and `GestureAnimationAsset` return type.
- [ ] Update Type-to-Sign status copy to enumerate unavailable glosses without discarding available clips.
- [ ] Rerun focused loader tests, existing Type-to-Sign tests, and `npm run typecheck`.

### Task 7: Build the admin Landmark Assets workspace

**Files:**
- Create: `src/app/admin/(dashboard)/landmark-assets/page.tsx`
- Create: `src/components/admin/LandmarkAssetManager.tsx`
- Create: `src/components/admin/LandmarkAssetReviewPreview.tsx`
- Modify: `src/lib/admin/navigation.ts`
- Modify: `src/app/admin/admin.css`
- Test: `src/components/admin/__tests__/LandmarkAssetManager.test.tsx`

**Interfaces:**
- `LandmarkAssetManager` consumes rows returned by `listAnimationAssets` and uses the protected upload/action API routes.
- `LandmarkAssetReviewPreview` accepts a signed source video URL and `GestureAnimationAsset`, renders video and `LandmarkCanvasRenderer` in synchronized panels.

- [ ] Write a component test covering heading, upload constraints, processing progress, unavailable source/asset state, and publish control disabled until approval.
- [ ] Run the test and verify it fails before the component exists.
- [ ] Create a responsive admin workspace with live coverage metrics: total, approved, pending review, processing, missing glosses, average quality, average duration, FPS distribution, and private storage usage.
- [ ] Add upload validation for MP4/MOV/WebM and server-verified private upload creation. On extraction, create/update the job, call the browser extractor, process frames, save JSON, then update the version to `ready`.
- [ ] Add truthful `Approve`, `Reject`, `Regenerate`, `Publish`, `Archive`, and `Delete` controls. No source video is exposed outside this protected route.
- [ ] Add the new route to the existing Animations navigation group and scoped responsive styles without inline styles.
- [ ] Rerun focused workspace tests and `npm run typecheck`.

### Task 8: Validate the complete pipeline and document deployment requirements

**Files:**
- Create: `docs/landmark-animation-admin-workflow.md`
- Modify: `README.md`
- Test: `src/features/sign-animation/processing/__tests__/landmarkAssetProcessing.test.ts`

- [ ] Add an end-to-end unit integration fixture that produces an extracted sequence, processes it into `GestureAnimationAsset`, and confirms the public resolver returns only a published asset.
- [ ] Run focused landmark processing, loader, resolver, and manager tests.
- [ ] Document migration application, required private buckets, source-video privacy guarantees, browser extraction limitations, review steps, and how to test `HELLO`/`HOW ARE YOU` publishing.
- [ ] Run `npm run typecheck`, `npm run lint`, and the focused test suite. Record the existing Node 24 production-build limitation separately if `npm run build` reaches the known Webpack/WasmHash failure.

## Self-Review

Coverage: the plan includes private upload, MediaPipe extraction, normalization/repair, compatible JSON generation, synchronized preview, approval/publish/versioning, public resolver/fallback, analytics, missing assets, renderer reuse, tests, and documentation.

Type consistency: every persisted version serializes a `GestureAnimationAsset`; both admin preview and public playback consume that type. The public resolver receives only published assets and the loader preserves static JSON fallback.

Scope: the plan deliberately omits a server worker, 3D avatar, and raw-video public playback. Those can be added later without changing the stored landmark contract.