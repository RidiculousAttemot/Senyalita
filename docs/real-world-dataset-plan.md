# Real-World Dataset Collection Plan

Generated: 2026-06-16

## Goal

Collect recordings from 5+ signers with diverse skin tones, lighting, camera positions, and backgrounds.

## Diversity Targets

| Category | Targets |
|----------|---------|
| **Skin tones** | light, medium, dark, olive, brown |
| **Lighting** | bright-indoor, dim-indoor, outdoor-shade, outdoor-sun, backlit, side-lit |
| **Camera positions** | chest-level, face-level, slightly-above, slightly-below, angled-left, angled-right |
| **Backgrounds** | solid-wall, cluttered, window, outdoor, dark |

## Signs to Collect

1. a
2. b
3. c
4. d
5. e
6. f
7. g
8. h
9. i
10. j
11. THANK YOU
12. GOOD MORNING
13. HELLO
14. YES
15. NO

## Collection Pipeline

**Step 1:** Setup MediaPipe hand tracking in browser

**Step 2:** Capture 120-frame sequence at 30fps per sign

**Step 3:** Extract 126 MediaPipe landmarks per frame

**Step 4:** Validate landmark quality (>60% nonzero)

**Step 5:** Store as JSON with metadata (signer, lighting, background, position)

**Step 6:** Review and label each capture

## Validation Criteria

| Criterion | Threshold |
|-----------|:---------:|
| Minimum frames | 30 |
| Maximum frames | 300 |
| Landmark completeness | 60% |
| Min confidence | 70% |

## Output Structure

```
datasets/real_world/
  metadata.json
  signer_001/
    a.json
    b.json
    ...
  signer_002/
    ...
  ...
```

## Usage

```
node scripts/prepare-real-world-dataset.mjs
```

This creates the directory structure and metadata. Collection must be done via the web app's data collection interface.
