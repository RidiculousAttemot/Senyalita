# Sign Animation Assets

## Asset Format

Animation assets are stored as TypeScript modules containing `GestureAnimation` objects.

### Location

- **Runtime definitions**: `src/features/animation/gestureAnimations.ts`
- **Export format**: JSON-compatible `GestureAnimation` type

### Schema

```
GestureAnimation {
  version: number        — Schema version (current: 1)
  gesture: string        — Gesture label (e.g. "HELLO")
  duration: number       — Total duration in seconds
  fps: number            — Frames per second
  keyframes: Keyframe[]  — Array of pose keyframes
}
```

### Keyframe Schema

```
Keyframe {
  time: number           — Timestamp in seconds
  pose: SkeletonPose     — Joint positions at this time
  ease?: EasingType      — Optional easing function name
}

SkeletonPose {
  joints: Record<JointName, JointPosition>
}
```

## Currently Available Animations

| Gesture | Duration | Keyframes | Category |
|---------|----------|-----------|----------|
| HELLO | 1.5s | 5 | greeting |
| THANK YOU | 1.8s | 6 | politeness |
| PLEASE | 1.5s | 6 | politeness |
| SORRY | 1.5s | 5 | politeness |
| YES | 1.0s | 6 | affirmation |
| NO | 1.0s | 5 | negation |
| HOW ARE YOU | 2.0s | 6 | greeting |
| GOOD MORNING | 2.0s | 6 | greeting |
| GOOD AFTERNOON | 2.0s | 6 | greeting |
| GOOD EVENING | 2.0s | 5 | greeting |
| IM FINE | 1.5s | 5 | greeting |
| NICE TO MEET YOU | 2.0s | 6 | greeting |
| YOURE WELCOME | 1.8s | 6 | politeness |
| SEE YOU TOMORROW | 2.0s | 6 | farewell |
| UNDERSTAND | 1.5s | 5 | cognition |
| DON'T UNDERSTAND | 1.8s | 5 | cognition |
| KNOW | 1.2s | 5 | cognition |
| DON'T KNOW | 1.5s | 6 | cognition |
| WRONG | 1.2s | 5 | negation |
| CORRECT | 1.2s | 5 | affirmation |
| SLOW | 2.0s | 5 | description |
| FAST | 0.8s | 5 | description |
| HOT | 1.2s | 5 | description |
| COLD | 1.2s | 5 | description |
| FATHER | 1.5s | 5 | family |
| MOTHER | 1.5s | 5 | family |
| DEAF | 1.3s | 5 | identity |
| HARD OF HEARING | 2.0s | 6 | identity |
| BLIND | 1.3s | 5 | identity |
| MARRIED | 1.5s | 5 | relationship |

## Finger Spelling Assets

Available letters: `a`, `b`, `c` (basic alphabet animations)

All finger spelling animations are 1.0s duration with 3 keyframes.
The system will expand to 26+ letters as needed.

## Adding New Animations

To add a new gesture animation:

1. Define the `GestureAnimation` object in `src/features/animation/gestureAnimations.ts`
2. Use the `p()` and `kf()` helper functions for clean syntax
3. Add the gesture label to the appropriate dictionary:
   - `WORD_TO_GLOSS` in `src/features/gesture-mapping/glossDictionary.ts` (for text→gloss matching)
   - `GESTURE_CATEGORIES` (for metadata)
4. The animation is automatically available through the pipeline

## Performance

- Each animation stores only keyframe joint positions (no redundant frames)
- Animations are pre-loaded into memory on first access
- Coordinate precision: 2 decimal places
- Typical animation: 5-6 keyframes × 13 joints = 65-78 values
