# Landmark Renderer

## Overview

The `LandmarkCanvasRenderer` draws MediaPipe hand landmarks as a
skeleton on an HTML Canvas element. Unlike the previous SVG-based
stickman renderer, this renders the actual captured landmark positions
from the training data.

## Architecture

```typescript
class LandmarkCanvasRenderer {
  constructor(canvas: HTMLCanvasElement, options?: LandmarkRendererOptions)
  render(frame: AnimationFrame | null): void
  setSize(width: number, height: number): void
  clear(): void
  dispose(): void
}
```

## Rendering

- Draws MediaPipe hand connections (21 landmarks × 21 connections)
- Two hand colors: left=#C0593A (orange), right=#60A5FA (blue)
- Optional landmark index labels
- Background: dark (#0f172a)

## Connections

Standard MediaPipe HAND_CONNECTIONS are used:
- Thumb: 0-1, 1-2, 2-3, 3-4
- Index: 0-5, 5-6, 6-7, 7-8
- Middle: 0-9, 9-10, 10-11, 11-12
- Ring: 0-13, 13-14, 14-15, 15-16
- Little: 0-17, 17-18, 18-19, 19-20
- Inter-finger: 5-9, 9-13, 13-17

## Future

- WebGL renderer for performance
- Full body skeleton (pose landmarks)
- Facial expression rendering
