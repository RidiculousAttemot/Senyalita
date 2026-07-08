# Sign Animation Pipeline

## Architecture

The sign animation pipeline converts recognized/translated text into
data-driven skeletal animation rendered from real MediaPipe landmarks.

```
Text Input
    ↓
Translation Pipeline (runPipeline)
    ↓
Gloss Labels
    ↓
Animation Loader (fetches from public/animations/*.json)
    ↓
Animation Clips (GestureAnimationAsset[])
    ↓
Playback Engine (requestAnimationFrame-based)
    ↓
Landmark Canvas Renderer (draws MediaPipe hand skeleton)
```

## Module Structure

```
src/features/sign-animation/
  types/index.ts          — TypeScript types (LandmarkPoint, GestureAnimationAsset, etc.)
  renderer/               — Canvas-based landmark renderer
  loader/                 — AnimationLoader with caching
  player/                 — PlaybackEngine + SignAnimationPlayer React component
  engine/                 — (reserved for future physics/engine work)
  interpolation/          — Landmark interpolation helpers
  timeline/               — Frame-at-time lookup
  hooks/                  — React hooks (useAnimationClip, useAnimationQueue)
  assets/                 — (reserved for asset management)
```

## Files Created

- `src/features/sign-animation/types/index.ts`
- `src/features/sign-animation/renderer/LandmarkCanvasRenderer.ts`
- `src/features/sign-animation/renderer/index.ts`
- `src/features/sign-animation/loader/AnimationLoader.ts`
- `src/features/sign-animation/loader/index.ts`
- `src/features/sign-animation/player/PlaybackEngine.ts`
- `src/features/sign-animation/player/SignAnimationPlayer.tsx`
- `src/features/sign-animation/player/index.ts`
- `src/features/sign-animation/interpolation/index.ts`
- `src/features/sign-animation/timeline/index.ts`
- `src/features/sign-animation/hooks/useAnimationClip.ts`
- `src/features/sign-animation/index.ts`
- `scripts/generate-animation-assets.mjs`
- `scripts/audit-animation-coverage.mjs`
- `src/app/admin/animations/page.tsx`

## Files Modified

- `src/features/text-to-sign/TextToSignInterface.tsx` — uses SignAnimationPlayer + AnimationLoader

## Integration Flow

The recognition system (src/features/recognition) and animation system
(src/features/sign-animation) remain completely independent. The pipeline
connects them via the TranslationResult model from Phase 38.1.
