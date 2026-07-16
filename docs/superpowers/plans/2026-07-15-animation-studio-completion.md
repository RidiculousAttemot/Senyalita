# Animation Studio Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the admin-only Animation Studio so administrators can capture, process, review, approve, and publish private-video-derived landmark JSON without changing the public `/translate` UI.

**Architecture:** Keep `GestureAnimationAsset` and `AnimationLoader` as the compatibility boundary. The Studio writes versioned source-video and landmark JSON records through the existing protected APIs; browser MediaPipe extraction produces the same JSON consumed by the API-first public loader, existing `SignAnimationPlayer`, and legacy JSON fallback.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Supabase Postgres/Storage/RLS, `@mediapipe/tasks-vision`, Canvas 2D, Vitest.

## Global Constraints

- Do not change any UI, control, copy, layout, or public interface in `/translate`.
- Preserve recognition, translation, gloss, `GestureAnimationAsset`, `AnimationClip`, public `AnimationLoader`, `PlaybackEngine`, and static JSON fallback contracts.
- Source MP4, MOV, and WebM videos stay in private `animation-source-videos` storage and are never returned by `/api/animations/[gloss]`.
- The public application receives only a currently published landmark JSON asset from the existing resolver.
- Validate source video duration after metadata load and reject videos longer than 60 seconds.
- Keep new administrator UI under `/admin/landmark-assets`, renamed Animation Studio in navigation.
- Follow test-driven development: add a focused failing test, run it, make the smallest implementation, then rerun it before moving to the next task.
- Keep the documented Node 24/Next 14 build limitation separate from source-code validation; use focused tests, lint, and typecheck in this environment.

---

### Task 1: Add complete, renderer-neutral processing utilities

**Files:**
- Modify: `src/features/sign-animation/types/index.ts`
- Modify: `src/features/sign-animation/processing/landmarkAssetProcessing.ts`
- Modify: `src/features/sign-animation/processing/index.ts`
- Create: `src/features/sign-animation/processing/__tests__/landmarkAssetProcessing.test.ts`

**Interfaces:**
- Produces `processLandmarkFrames(frames, options): AnimationFrame[]`.
- Produces `getSequenceFps(frames): number`.
- Extends metadata with optional source dimensions, source FPS, processing version, and normalized coordinate space while preserving all required current fields.
- Keeps `createGestureAnimationAsset(input): GestureAnimationAsset` public and backward compatible.

- [ ] **Step 1: Write failing processing tests**

```ts
it("estimates a missing landmark track between valid frames", () => {
  const processed = processLandmarkFrames([
    frame(0, 0),
    { timestamp: 100, landmarks: [], poseLandmarks: [], faceLandmarks: [] },
    frame(200, 1),
  ], { targetFps: 10 });

  expect(processed[1].landmarks[0].landmarks[0].x).toBeCloseTo(0.5);
});

it("returns a stable source FPS from decoded timestamps", () => {
  expect(getSequenceFps([frame(0, 0), frame(40, 0), frame(80, 0)])).toBe(25);
});

it("preserves pose, face, and both hands in a compatible asset", () => {
  const asset = createGestureAnimationAsset({ label: "HELLO", fps: 25, frames: fullFrames });
  expect(asset.frames[0]).toMatchObject({
    landmarks: expect.any(Array), poseLandmarks: expect.any(Array), faceLandmarks: expect.any(Array),
  });
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm run test -- src/features/sign-animation/processing/__tests__/landmarkAssetProcessing.test.ts`

Expected: FAIL because `processLandmarkFrames` and `getSequenceFps` are not exported.

- [ ] **Step 3: Implement only the tested frame-processing pipeline**

```ts
export function getSequenceFps(frames: AnimationFrame[]): number {
  const gaps = frames.slice(1)
    .map((frame, index) => frame.timestamp - frames[index].timestamp)
    .filter((gap) => gap > 0);
  if (gaps.length === 0) return 30;
  const medianGap = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  return Math.max(1, Math.round(1000 / medianGap));
}

export function processLandmarkFrames(frames: AnimationFrame[], options: { targetFps: number }): AnimationFrame[] {
  return normalizeFrameSequence(smoothFrameSequence(repairMissingFrames(frames)), options.targetFps);
}
```

Implement `smoothFrameSequence` as a pure moving average over matching landmark tracks. Preserve timestamps, hand sides, pose landmarks, and face landmarks. Trim only fully empty leading and trailing frames; do not discard an in-sequence frame that can be interpolated.

- [ ] **Step 4: Rerun the focused processing test**

Run: `npm run test -- src/features/sign-animation/processing/__tests__/landmarkAssetProcessing.test.ts`

Expected: PASS.

- [ ] **Step 5: Typecheck the processing boundary**

Run: `npm run typecheck`

Expected: PASS.

### Task 2: Preserve decoded timing and report explicit extraction stages

**Files:**
- Modify: `src/features/sign-animation/extraction/holisticVideoExtractor.ts`
- Modify: `src/features/sign-animation/extraction/index.ts`
- Create: `src/features/sign-animation/extraction/__tests__/holisticVideoExtractor.test.ts`

**Interfaces:**
- `ExtractionProgress` gains `stage: "reading" | "extracting" | "normalizing" | "generating" | "complete"`.
- `ExtractedAnimationSequence.sourceFps` is calculated from captured timestamps, not hard-coded.
- `mapHolisticVideoResult(result, timestamp)` remains pure and keeps pose, face, left hand, and right hand.

- [ ] **Step 1: Write failing extractor tests**

```ts
it("retains all MediaPipe landmark groups in one frame", () => {
  expect(mapHolisticVideoResult(fullResult, 33)).toMatchObject({
    timestamp: 33,
    poseLandmarks: [{ x: 0.1, y: 0.2, z: 0 }],
    faceLandmarks: [{ x: 0.3, y: 0.4, z: 0 }],
    landmarks: expect.arrayContaining([
      expect.objectContaining({ side: "left" }),
      expect.objectContaining({ side: "right" }),
    ]),
  });
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm run test -- src/features/sign-animation/extraction/__tests__/holisticVideoExtractor.test.ts`

Expected: FAIL because staged extraction progress is not exposed or source timing remains fixed at 30 FPS.

- [ ] **Step 3: Implement timing-safe browser extraction**

Use `video.currentTime * 1000` for the asset frame timestamp, retain the browser callback timestamp only for `detectForVideo`, report `reading` before playback, `extracting` per frame, and leave normalization/generation stages to the Studio after extraction. Calculate the final FPS with `getSequenceFps(frames)`.

- [ ] **Step 4: Rerun the extractor test and typecheck**

Run: `npm run test -- src/features/sign-animation/extraction/__tests__/holisticVideoExtractor.test.ts; npm run typecheck`

Expected: both commands PASS.

### Task 3: Persist the Studio publication metadata safely

**Files:**
- Create: `supabase/migrations/0037_animation_studio_metadata.sql`
- Modify: `src/lib/animationAssets.ts`
- Modify: `src/lib/supabase/queries/animationAssets.ts`
- Modify: `src/app/api/admin/animation-assets/upload/route.ts`
- Modify: `src/app/api/admin/animation-assets/[versionId]/action/route.ts`
- Test: `src/lib/__tests__/animationAssetStatus.test.ts`

**Interfaces:**
- `AnimationAsset` gains nullable `category`, `language`, `difficulty`, `keywords`, and `notes` fields.
- `AnimationAssetVersion.extraction_metadata` stores source duration, dimensions, source FPS, and processing details.
- Upload route accepts canonical gloss and optional publication metadata but does not publish automatically.

- [ ] **Step 1: Add a failing lifecycle test**

```ts
it("does not allow incomplete processing metadata to be approved", () => {
  expect(canApproveAnimationVersion("ready", { frameCount: 0, durationMs: 0 })).toBe(false);
  expect(canApproveAnimationVersion("ready", { frameCount: 24, durationMs: 800 })).toBe(true);
});
```

- [ ] **Step 2: Run the status test to verify RED**

Run: `npm run test -- src/lib/__tests__/animationAssetStatus.test.ts`

Expected: FAIL because `canApproveAnimationVersion` does not exist.

- [ ] **Step 3: Add the idempotent metadata migration and validation helper**

```sql
alter table public.animation_assets add column if not exists category text;
alter table public.animation_assets add column if not exists language text not null default 'FSL';
alter table public.animation_assets add column if not exists difficulty text;
alter table public.animation_assets add column if not exists keywords text[] not null default '{}';
alter table public.animation_assets add column if not exists notes text;
```

Use a `do $$` block before creating any new policy or constraint that may already exist in a drifted remote schema. Keep source paths and JSON paths on `animation_asset_versions`; do not add a raw video URL or JSON body to public tables.

```ts
export const canApproveAnimationVersion = (
  status: AnimationAssetStatus,
  metrics: { frameCount: number | null; durationMs: number | null },
) => status === "ready" && (metrics.frameCount ?? 0) > 0 && (metrics.durationMs ?? 0) > 0;
```

Update the approve action to fetch `total_frames` and `duration_ms`, then reject incomplete versions with HTTP 409 before creating an approval review.

- [ ] **Step 4: Rerun the lifecycle test and typecheck**

Run: `npm run test -- src/lib/__tests__/animationAssetStatus.test.ts; npm run typecheck`

Expected: both commands PASS.

### Task 4: Render full extracted skeletons and support frame-accurate review controls

**Files:**
- Modify: `src/features/sign-animation/renderer/LandmarkCanvasRenderer.ts`
- Modify: `src/features/sign-animation/renderer/AdvancedCanvasRenderer.ts`
- Create: `src/features/sign-animation/renderer/__tests__/landmarkRendering.test.ts`
- Create: `src/components/admin/LandmarkAssetReviewPreview.tsx`
- Create: `src/components/admin/__tests__/LandmarkAssetReviewPreview.test.tsx`

**Interfaces:**
- `LandmarkAssetReviewPreview` accepts `{ videoUrl, asset }` and never passes `videoUrl` outside its admin-only tree.
- Renderer `render(frame)` signatures remain unchanged.
- Review controls expose play, pause, stop, loop, rate, seek, and step operations using a single current-frame index.

- [ ] **Step 1: Write failing rendering and preview tests**

```ts
it("draws torso, pose joints, face outline, and both hands for a full frame", () => {
  const renderer = new LandmarkCanvasRenderer(canvas, { width: 320, height: 400 });
  renderer.render(fullFrame);
  expect(context.lineTo).toHaveBeenCalled();
  expect(context.arc).toHaveBeenCalled();
});

it("renders review controls without rendering source video in skeleton mode", () => {
  render(<LandmarkAssetReviewPreview videoUrl="blob:test" asset={asset} />);
  fireEvent.click(screen.getByRole("button", { name: "Skeleton" }));
  expect(screen.queryByLabelText("Source video")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused preview tests to verify RED**

Run: `npm run test -- src/features/sign-animation/renderer/__tests__/landmarkRendering.test.ts src/components/admin/__tests__/LandmarkAssetReviewPreview.test.tsx`

Expected: FAIL because review component and complete skeleton support do not exist.

- [ ] **Step 3: Implement render and review behavior**

Draw body connections with rounded caps/joins and joints, use pose landmarks when present, derive a compact head outline from face bounds, and avoid plotting the complete dense face mesh. Keep hand connection rendering intact. In the preview component, use the existing `PlaybackEngine`, `LandmarkCanvasRenderer`, and `requestAnimationFrame`; only mount the `<video>` in video and side-by-side modes.

- [ ] **Step 4: Rerun preview tests and typecheck**

Run: `npm run test -- src/features/sign-animation/renderer/__tests__/landmarkRendering.test.ts src/components/admin/__tests__/LandmarkAssetReviewPreview.test.tsx; npm run typecheck`

Expected: both commands PASS.

### Task 5: Replace the narrow asset form with the four-tab Animation Studio

**Files:**
- Modify: `src/components/admin/LandmarkAssetManager.tsx`
- Modify: `src/app/admin/(dashboard)/landmark-assets/page.tsx`
- Modify: `src/lib/admin/navigation.ts`
- Modify: `src/app/admin/admin.css`
- Create: `src/components/admin/__tests__/LandmarkAssetManager.test.tsx`

**Interfaces:**
- `LandmarkAssetManager` remains the route component but exposes the tabs `Video Upload`, `Pose Extraction`, `Skeleton Preview`, and `Publish`.
- It sends the existing upload/action route the current file and optional metadata; it continues loading no source video for public routes.
- `validateAnimationSource(video): AnimationSourceMetadata | string` reports video duration, width, height, FPS estimate, size, and supported-file errors.

- [ ] **Step 1: Write failing Studio tests**

```tsx
it("rejects a source video longer than 60 seconds", async () => {
  render(<LandmarkAssetManager initialAssets={[]} />);
  await uploadVideoWithMetadata({ duration: 61, type: "video/mp4" });
  expect(screen.getByText("Videos must be 60 seconds or shorter.")).toBeInTheDocument();
});

it("keeps Publish disabled until a ready version is approved", () => {
  render(<LandmarkAssetManager initialAssets={[readyAsset]} />);
  expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
});
```

- [ ] **Step 2: Run the Studio test to verify RED**

Run: `npm run test -- src/components/admin/__tests__/LandmarkAssetManager.test.tsx`

Expected: FAIL because the current form has no duration validation or Studio tabs.

- [ ] **Step 3: Implement the client-only Studio workflow**

Implement file browse, drag/drop, and `MediaRecorder` webcam recording. Load metadata from an object URL before enabling extraction. Display duration, resolution, FPS estimate, and file size. During extraction update stages in this exact order:

```ts
setStage("reading");
const extracted = await extractLandmarksFromVideo(video, {}, onProgress);
setStage("normalizing");
const frames = processLandmarkFrames(extracted.frames, { targetFps: extracted.sourceFps });
setStage("generating");
const asset = createGestureAnimationAsset({ label: gloss, frames, fps: extracted.sourceFps });
setStage("complete");
```

Use semantic tabs and existing admin CSS classes. Add scoped CSS for stable preview dimensions, drag target state, recording state, progress status, and responsive side-by-side review. Do not modify `src/app/translate/page.tsx` or `TypeToSignInterface.tsx`.

- [ ] **Step 4: Rename the navigation item without changing the route**

```ts
{ label: "Animation Studio", href: "/admin/landmark-assets", icon: Film }
```

- [ ] **Step 5: Rerun Studio tests and typecheck**

Run: `npm run test -- src/components/admin/__tests__/LandmarkAssetManager.test.tsx src/components/admin/__tests__/LandmarkAssetReviewPreview.test.tsx; npm run typecheck`

Expected: both commands PASS.

### Task 6: Validate published compatibility and document deployment

**Files:**
- Modify: `src/features/sign-animation/loader/__tests__/AnimationLoader.test.ts`
- Modify: `src/lib/supabase/__tests__/animationAssetResolver.test.ts`
- Create: `docs/animation-studio-admin-workflow.md`

**Interfaces:**
- Existing `AnimationLoader.load(gloss)` behavior remains API-first with static fallback.
- `getPublishedAnimationAsset(gloss)` returns only a published JSON asset and never a source video field or URL.

- [ ] **Step 1: Extend the existing compatibility fixtures**

```ts
it("loads a published full-landmark asset through the unchanged public loader", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(fullAsset), { status: 200 })));
  await expect(new AnimationLoader().load("hello")).resolves.toMatchObject({
    label: "HELLO", frames: [expect.objectContaining({ poseLandmarks: expect.any(Array) })],
  });
});
```

- [ ] **Step 2: Run focused compatibility tests to verify green behavior is retained**

Run: `npm run test -- src/features/sign-animation/loader/__tests__/AnimationLoader.test.ts src/lib/supabase/__tests__/animationAssetResolver.test.ts`

Expected: PASS with API-first behavior and static fallback retained.

- [ ] **Step 3: Document migration and admin operation**

Document `0035` then `0037` migration application; required private bucket names; permitted formats and 60-second limit; browser extraction limitation; review/approval/publish lifecycle; privacy guarantees; and the check that `/translate` uses published JSON without UI changes.

- [ ] **Step 4: Run final focused validation**

Run: `npm run test -- src/features/sign-animation/processing/__tests__/landmarkAssetProcessing.test.ts src/features/sign-animation/extraction/__tests__/holisticVideoExtractor.test.ts src/features/sign-animation/renderer/__tests__/landmarkRendering.test.ts src/components/admin/__tests__/LandmarkAssetManager.test.tsx src/components/admin/__tests__/LandmarkAssetReviewPreview.test.tsx src/features/sign-animation/loader/__tests__/AnimationLoader.test.ts src/lib/__tests__/animationAssetStatus.test.ts src/lib/supabase/__tests__/animationAssetResolver.test.ts; npm run typecheck; npm run lint`

Expected: focused tests and typecheck PASS. Lint should contain no newly introduced errors; record pre-existing warnings separately.

## Self-Review

**Coverage:** Tasks cover upload, drag/drop, recording, source metadata, 60-second validation, staged browser extraction, all requested landmark groups, processing, native FPS, skeleton/video/side-by-side review, playback controls, publish metadata, lifecycle safety, raw-video privacy, public compatibility, and deployment documentation.

**No placeholders:** Every task names the exact files, resulting interfaces, test command, expected state, and implementation boundary.

**Type consistency:** Admin extraction and public playback both serialize and consume `GestureAnimationAsset`; new pose and face fields remain optional so all current static files and legacy public loading remain valid.