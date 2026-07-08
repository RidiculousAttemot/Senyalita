# sign/translate Repository Architecture Analysis

## Overview

**Repository**: [github.com/sign/translate](https://github.com/sign/translate)
**License**: CC BY-NC-SA 4.0
**Tech Stack**: Angular 21 + Ionic 8 + TypeScript + Three.js + TensorFlow.js + MediaPipe Holistic
**Website**: https://sign.mt

This document analyzes the sign/translate repository as reference architecture for integrating text-to-sign animation into SignLangVisual.

---

## 1. Translation Pipeline

```
Spoken Language Text
       │
       ▼
Normalized Text  (sign.mt/api/text-normalization)
       │
       ├──────────────────┐
       ▼                  ▼
SignWriting         Pose Sequence (Cloud Function)
       │                  │
       ▼                  ├──────────────────┐
   SW Font           3D Avatar          Skeleton Viewer
   Rendering         (GLB + Mixamo)     (Canvas overlay)
```

**Key files**:
- `src/app/modules/translate/translate.state.ts` — Central orchestrator
- `src/app/modules/translate/translate.service.ts` — Pose sequence fetching
- `src/app/modules/translate/signwriting-translation.service.ts` — SignWriting with Bergamot NMT

**Concepts to adopt**:
- Text normalization before translation
- Fallback chain: offline model → online API
- Separation of translation state from rendering

---

## 2. Pose Generation Pipeline

The pose generation is handled by a serverless Cloud Function:

```
Text → Cloud Function → Pose Sequence URL → JSON pose data → Animation Engine
```

**Key files**:
- `src/app/modules/pose/pose.service.ts` — MediaPipe Holistic wrapper
- `src/app/modules/pose/pose.state.ts` — Pose state management with NgXS
- `src/app/modules/pose/pose-normalization.service.ts` — 3D normalization using Three.js

**Concepts to adopt**:
- Pose data as normalized landmark arrays
- Centralized pose state management
- Normalization of coordinates for device independence

---

## 3. Skeleton Animation Pipeline

**Key files**:
- `src/app/modules/animation/animation.service.ts` — TFJS model: landmarks → Mixamo quaternions
- `src/app/modules/animation/animation.component.ts` — Three.js AnimationClip construction
- `src/app/components/animation/animation.component.ts` — `<model-viewer>` rendering

**Flow**:
```
Pose Landmarks (225 values: 75 × xyz)
       │
       ▼
TFJS Pose-Animation Model
       │
       ▼
48 Quaternions (Mixamo rig bones)
       │
       ▼
Three.js QuaternionKeyframeTrack
       │
       ▼
AnimationClip → model-viewer mixer
```

**Concepts to adopt**:
- Keyframe-based animation with time/value pairs
- Mixamo-compatible bone hierarchy
- Dynamic clip construction

---

## 4. Avatar Rendering

**Rendering modes**:
1. **Skeleton (Pose)**: Canvas-based MediaPipe skeleton overlay
2. **3D Avatar**: GLB character via `<model-viewer>` (Three.js)
3. **Person (GAN)**: Pix2Pix converts skeleton → photorealistic human

**Key files**:
- `src/app/components/animation/animation.component.ts` — model-viewer integration
- `3d/character.glb` — Mixamo-rigged 3D character
- `src/app/modules/pix2pix/` — GAN generator + upscaler in web worker

**For SignLangVisual**: SVG stickman is appropriate (no 3D assets needed), using joint hierarchy and interpolated keyframes.

---

## 5. Sign Dictionary & Writing

**Key files**:
- `src/app/modules/sign-writing/sign-writing.service.ts` — FSW normalization, font compositing
- `src/app/modules/sign-writing/body.service.ts` — Body factor computation
- `src/app/modules/sign-writing/hands.service.ts` — Hand shape → SW symbols (261 shapes)
- `src/app/modules/sign-writing/face.service.ts` — Face landmarks → SW symbols

**Concepts to adopt**:
- Pre-computed gesture-to-animation mappings
- Category-based organization
- Metadata linking (meaning, gloss, difficulty, related gestures)

---

## 6. Animation Assets

**Notable**: The reference repo has **no static JSON keyframe files**. All animation data is generated dynamically:
- Pose landmarks → TFJS model → quaternion keyframes (3D)
- No pre-authored 2D keyframe animations

**For SignLangVisual**: We define JSON keyframe files manually for the 133 gestures, providing pre-authored 2D skeleton poses.

---

## 7. Playback Engine

The reference repo uses **Three.js AnimationMixer** for playback:
- `QuaternionKeyframeTrack` per bone
- `AnimationClip` per gesture sequence
- Mixer handles blending, crossfade, speed

**For SignLangVisual**: Custom animation engine with:
- RequestAnimationFrame loop
- Lerp interpolation between keyframes
- Easing functions (ease-in-out, ease-out)
- Queue-based sequential playback

---

## 8. Translation API

- `POST https://sign.mt/api/spoken-text-to-signwriting` — Online SW translation
- `POST https://us-central1-sign-mt.cloudfunctions.net/spoken_text_to_signed_pose` — Pose sequence
- Bergamot NMT models for offline translation

---

## 9. Key Differences From SignLangVisual

| Aspect | sign/translate | SignLangVisual |
|--------|---------------|----------------|
| Framework | Angular + Ionic | React + Next.js |
| Rendering | 3D (GLB/Three.js) | 2D SVG |
| Animation | TFJS → Quaternions | JSON keyframes |
| Gesture data | Cloud Function | Local JSON + Supabase |
| Translation | NMT models | Dictionary lookup |
| State | NgXS | React hooks |

---

## 10. Integration Strategy

1. **Adapt pipeline architecture**: Text → Normalize → Gloss → Lookup → Queue → Animate
2. **Replace 3D avatar with SVG skeleton**: Simpler, lighter, sufficient for communication
3. **Use pre-authored JSON keyframes**: One file per gesture, manually crafted
4. **Reuse 133-class label set**: Map natural language → existing gesture labels
5. **Knowledge Base integration**: Link gestures with metadata from gesture_knowledge_base
6. **Fallback chain**: Animated → Finger-spell → Placeholder
