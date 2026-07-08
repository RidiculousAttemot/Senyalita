# Motion Smoothing System

## Overview

The motion smoothing system eliminates robotic jitter from MediaPipe landmark playback using four complementary techniques.

## Interpolation Methods

### Linear (original)
```
value = a + (b - a) * t
```
Fast but produces sharp transitions at keyframes.

### Smoothstep (default for simple blending)
```
value = t²(3 - 2t)
```
Applies smooth easing to the lerp factor, removing sudden starts/stops.

### Cubic Interpolation
Uses 4 control points (before, a, b, after) for C¹ continuous motion:
```
value = (-0.5a + 1.5b - 1.5c + 0.5d)t³
      + (a - 2.5b + 2c - 0.5d)t²
      + (-0.5a + 0.5c)t
      + b
```

### Catmull-Rom (default)
Standard curve for keyframe animation. Passes through all keyframes with continuous derivatives:
```
value = 0.5(2b + (-a+c)t + (2a-5b+4c-d)t² + (-a+3b-3c+d)t³)
```

## Velocity Smoothing

Dampens rapid changes per-landmark using spring-damper physics:
```
accel = error × damping - velocity × 2
velocity += accel × dt
value += velocity × dt
```

## Motion Damping

Exponential smoothing toward target:
```
value = lerp(current, target, 1 - exp(-damping × dt))
```

## Jitter Removal

Hard threshold-based clamp on per-frame landmark deltas. Any movement exceeding `threshold` is capped.

## Usage

```typescript
import { interpolateHandsSmooth } from "@/features/sign-animation/interpolation/smoothing";

// Catmull-Rom interpolation (default)
const frame = interpolateHandsSmooth(asset.frames, currentTime, "catmull-rom");

// Smoothstep-based
const smoothFrame = interpolateHandsSmooth(asset.frames, currentTime, "smoothstep");
```
