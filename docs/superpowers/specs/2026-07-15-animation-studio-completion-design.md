# Animation Studio Completion Design

## Objective

Complete the existing landmark asset pipeline as an admin-only Animation Studio. Administrators upload or record short FSL reference videos, extract normalized MediaPipe pose, face, left-hand, and right-hand landmarks in the browser, review the generated skeleton, and publish versioned JSON assets. The public Type-to-Sign interface and its UI remain unchanged.

## Compatibility Contract

The public path remains:

```text
Text -> FSL gloss -> AnimationLoader -> /api/animations/[gloss] -> GestureAnimationAsset -> SignAnimationPlayer
```

`AnimationLoader` continues to prefer a published asset returned by the API and falls back to the legacy static JSON library. Every generated asset retains the required `GestureAnimationAsset` fields (`label`, `fps`, `duration`, `totalFrames`, `frames`, and metadata). New pose and face arrays remain optional, so legacy hand-only assets continue to play.

`/translate` receives no layout, copy, control, or interface changes.

## Asset Production Flow

1. An administrator selects, drags in, or records an MP4, MOV, or WebM video.
2. The Studio validates the video after metadata loads: a valid duration greater than zero and no more than 60 seconds.
3. The protected upload route creates an asset version and writes the source video only to the private `animation-source-videos` bucket.
4. Browser-side MediaPipe Holistic extraction samples decoded video frames at their observed timestamps, reports staged progress, and returns pose, face, and both hand collections.
5. Pure processing removes unusable leading and trailing frames, estimates missing tracks from adjacent valid frames, resamples to a stable output FPS, applies temporal smoothing, and centers/scales the coordinate system without changing the JSON contract.
6. The generated JSON and processing metadata are saved against the new version. The source video stays available only to administrators for review and retraining.
7. An administrator reviews the source video, skeleton, or a synchronized side-by-side view, then saves as draft, approves, publishes, or archives the version.

The browser owns landmark extraction because the installed MediaPipe Tasks implementation requires browser video decoding. The persisted job row makes progress and failures visible; a future worker can process the same version and JSON format without changing public playback.

## Animation Studio

The existing `/admin/landmark-assets` route becomes the named **Animation Studio** in admin navigation. It has four tabs:

- **Video Upload:** drag/drop, file picker, and webcam recorder; displays duration, resolution, FPS, and file size after validation.
- **Pose Extraction:** shows the current stage (`Reading video`, `Extracting landmarks`, `Normalizing`, `Generating animation`, or `Complete`) and non-blocking progress while the browser processes frames.
- **Skeleton Preview:** provides video-only, skeleton-only, and side-by-side review modes. It uses canvas output for the skeleton, with play, pause, stop, loop, speed, timeline, and frame step controls. This review-only tab is the sole place source video can appear.
- **Publish:** exposes canonical gloss, category, language, difficulty, keywords, notes, quality score, animation length, frame count, and draft/approve/publish/archive actions.

The existing version tables remain authoritative. Optional publication metadata is stored in `animation_assets` / `animation_asset_versions` without exposing a source path through public routes.

## Rendering

`AdvancedCanvasRenderer` and `LandmarkCanvasRenderer` consume the same `AnimationFrame` structure. They render a complete skeleton when pose landmarks are present: head outline, neck, shoulders, torso, hips, arms, legs, wrist/hand connections, rounded joints, and finger bones. Face landmarks supply an unobtrusive head outline rather than individually rendering the entire dense mesh.

Playback preserves the original asset FPS and blends neighboring frames using eased interpolation. The format stays renderer-neutral so a later SVG or 3D avatar adapter can consume the same landmark JSON.

## Privacy And Failure Rules

- Raw videos remain private and admin-only. They are never returned by `/api/animations/[gloss]` and are never used by public playback.
- A version can only be published after approval. Publishing archives the prior version for the same gloss.
- Invalid, over-60-second, unsupported, failed, or incomplete assets cannot be approved or published.
- A failed extraction records its job failure and leaves a previously published animation unchanged.
- A missing published asset retains the existing `Animation unavailable.` behavior and legacy-static fallback.

## Validation

- Add pure unit coverage for frame selection, missing-track estimation, smoothing, coordinate normalization, native timestamp/FPS calculation, and valid asset serialization.
- Add focused component coverage for upload constraints and lifecycle controls.
- Preserve and run existing public-loader and published-resolver tests.
- Run TypeScript validation and the focused test suite after each implementation slice.