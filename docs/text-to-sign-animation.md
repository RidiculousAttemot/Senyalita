# Text-to-Sign Animation Module

## Overview

The Text-to-Sign Animation module enables SignLangVisual to translate written or spoken sentences into animated sign language using an SVG stickman avatar. It is integrated alongside the existing FSL camera-based recognition system.

## Architecture

```
User Input (Text)
     │
     ▼
┌─────────────────────┐
│   Text Normalizer   │  →  Clean, tokenize, detect language
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Gloss Translator   │  →  Map words → gesture labels
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Gesture Mapper     │  →  Lookup animation by label
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Animation Queue    │  →  Build animation clip sequence
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Animation Engine   │  →  Playback with interpolation
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Stickman Renderer  │  →  SVG skeleton display
└─────────────────────┘
```

## Pipeline Stages

### 1. Text Normalization
- Remove punctuation and special characters
- Tokenize into words
- Language detection (English / Tagalog)
- Stop word removal

### 2. Gloss Translation
- Dictionary-based word-to-gloss mapping
- Multi-word phrase matching (e.g., "thank you" → "THANK YOU")
- Synonym normalization
- Fallback to uppercase word for unknown terms

### 3. Gesture Mapping
- Look up gloss in animation registry
- Map to existing 133-class gesture labels
- Knowledge base metadata integration

### 4. Animation Queue
- Build ordered list of AnimationClip objects
- Priority: animated gesture > finger spelling > placeholder
- Sequential queue playback with crossfade

### 5. Playback Engine
- RequestAnimationFrame loop targeting 60 FPS
- Lerp interpolation between keyframes
- Easing functions (ease-in-out, ease-out, bounce, elastic)
- Cross-fade transitions between gestures
- Playback speed control

## Files

| File | Purpose |
|------|---------|
| `src/features/text-to-sign/normalizer.ts` | Text normalization and language detection |
| `src/features/text-to-sign/glossTranslator.ts` | Word-to-gloss translation |
| `src/features/text-to-sign/animationQueue.ts` | Animation clip queue building |
| `src/features/text-to-sign/fallback.ts` | Finger spelling and placeholder animations |
| `src/features/text-to-sign/pipeline.ts` | Orchestrates the full pipeline |
| `src/features/text-to-sign/TextToSignInterface.tsx` | React UI component |
| `src/features/text-to-sign/index.ts` | Public exports |

## Dependencies

- `@/features/animation` — Animation engine, renderer, types
- `@/features/gesture-mapping` — Gloss dictionary and gesture mapper
