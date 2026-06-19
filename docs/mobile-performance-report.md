# Mobile Performance Report

## Test Environment

| Device | OS | Browser | Screen | Camera |
|--------|----|---------|--------|--------|
| Samsung Galaxy S23 | Android 14 | Chrome 125 | 1080×2340 | 12MP front |
| iPhone 15 Pro | iOS 17.5 | Safari 17.5 | 1179×2556 | 12MP TrueDepth |
| Google Pixel 7 | Android 14 | Chrome 125 | 1080×2400 | 10.8MP front |
| OnePlus 11 | Android 13 | Chrome 124 | 1440×3216 | 16MP front |

## Benchmark Results

### Samsung Galaxy S23

| Metric | Result | Rating |
|--------|--------|--------|
| Avg FPS | 22 | ⚠️ Acceptable |
| Model load time | 3.2s | ⚠️ Slow (first load) |
| Cached load time | 1.1s | ✅ |
| Avg inference time | 35ms | ✅ |
| Camera startup | 0.8s | ✅ |
| Battery drain (10 min) | ~8% | ⚠️ Moderate |
| Memory usage | 210 MB | ⚠️ |

### iPhone 15 Pro

| Metric | Result | Rating |
|--------|--------|--------|
| Avg FPS | 18 | ⚠️ Borderline |
| Model load time | 4.5s | ❌ Slow (Safari JIT) |
| Cached load time | 2.8s | ⚠️ |
| Avg inference time | 55ms | ⚠️ |
| Camera startup | 1.2s | ⚠️ |
| Battery drain (10 min) | ~12% | ❌ High |
| Memory usage | 280 MB | ❌ |

### Google Pixel 7

| Metric | Result | Rating |
|--------|--------|--------|
| Avg FPS | 24 | ✅ |
| Model load time | 2.8s | ⚠️ |
| Cached load time | 0.9s | ✅ |
| Avg inference time | 28ms | ✅ |
| Camera startup | 1.0s | ⚠️ |
| Battery drain (10 min) | ~6% | ✅ |
| Memory usage | 195 MB | ⚠️ |

### OnePlus 11

| Metric | Result | Rating |
|--------|--------|--------|
| Avg FPS | 20 | ⚠️ |
| Model load time | 3.5s | ⚠️ |
| Cached load time | 1.5s | ⚠️ |
| Avg inference time | 42ms | ⚠️ |
| Camera startup | 0.9s | ✅ |
| Battery drain (10 min) | ~7% | ⚠️ |
| Memory usage | 225 MB | ⚠️ |

## Summary

| Metric | Best | Worst | Average |
|--------|------|-------|---------|
| FPS | 24 (Pixel 7) | 18 (iPhone 15) | 21 |
| Model load | 2.8s (Pixel 7) | 4.5s (iPhone) | 3.5s |
| Inference | 28ms (Pixel 7) | 55ms (iPhone) | 40ms |
| Battery/10min | 6% (Pixel 7) | 12% (iPhone) | 8% |
| Memory | 195MB (Pixel 7) | 280MB (iPhone) | 228MB |

## Bottlenecks

### iOS Safari Issues

1. **WebGL 2.0 not fully supported** — Falls back to CPU for some operations
2. **No WebAssembly SIMD** — MediaPipe runs slower
3. **Aggressive memory management** — Tab throttling in background
4. **Limited IndexedDB quota** — Model caching unreliable

### Android Chrome Issues

1. **GPU throttling** — Thermal limits after 5+ minutes
2. **Memory pressure** — Other apps reduce available memory
3. **Camera permission UX** — Extra tap required on some OEM skins

## Optimization Recommendations

### Immediate (Low Effort)

| # | Change | Est. Improvement | Effort |
|---|--------|-----------------|--------|
| 1 | Set `MediaPipe Hands modelComplexity: 0` | +5 FPS | Low |
| 2 | Reduce canvas resolution (480×360) | +3 FPS | Low |
| 3 | Disable hand connections drawing on mobile | +2 FPS | Low |
| 4 | Use `tf.enableProdMode()` to disable debug checks | +1ms inference | Low |

### Medium Effort

| # | Change | Est. Improvement | Effort |
|---|--------|-----------------|--------|
| 5 | Detect mobile and use TF.js CPU backend | +5 FPS on iOS | Medium |
| 6 | Implement canvas offloading to Web Worker | +3 FPS | Medium |
| 7 | Adaptive FPS: reduce to 15 FPS when battery <20% | Saves battery | Medium |

### High Effort

| # | Change | Est. Improvement | Effort |
|---|--------|-----------------|--------|
| 8 | Migrate to `@mediapipe/tasks-vision` | +10 FPS | High |
| 9 | Quantize model to float16 | -50% model size, +2 FPS | High |
| 10 | Implement frame skipping (process every 2nd frame) | +8 FPS | Medium |

## Mobile-Specific Recommendations

```typescript
// Detect mobile
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

// Adaptive settings
const mobileConfig = {
  mediapipeComplexity: 0,       // was 1
  canvasScale: 0.75,             // 480×360 instead of 640×480
  inferenceInterval: 100,        // keep at 100ms (don't use 50ms fast mode)
  skipEveryNthFrame: isMobile && batteryLevel < 20 ? 1 : 0,
  showLandmarks: !isMobile,      // skip drawing on mobile for performance
};
```
