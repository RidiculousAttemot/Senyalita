# Animation Performance

## Target

- 60 FPS rendering
- Smooth interpolation between frames
- Minimal dropped frames
- No duplicate fetches

## Playback Engine

The `PlaybackEngine` uses `requestAnimationFrame` for smooth animation:

```
requestAnimationFrame loop
  → calculate delta time
  → apply speed multiplier
  → advance currentTime
  → interpolate frame (linear between landmark frames)
  → apply crossfade blending between gestures
  → callback with frame data
```

## Interpolation

Linear interpolation between consecutive landmark frames ensures smooth
motion even when source data has lower FPS:

```typescript
exactIndex = progress * (totalFrames - 1)
indexA = floor(exactIndex)
indexB = min(indexA + 1, totalFrames - 1)
t = exactIndex - indexA
→ lerp(landmarks[indexA], landmarks[indexB], t)
```

## Gesture Blending

When transitioning between gestures, a 250ms crossfade blends the
last frame of the previous gesture with the first frame of the next:

```typescript
blendT = smoothstep(blendTime / blendDuration)
blended = lerp(previousFrame, currentFrame, blendT)
```

## Caching

The `AnimationLoader` caches all loaded assets in a Map.
No animation file is fetched twice during the same session.
