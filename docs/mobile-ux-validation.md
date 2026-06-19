# Mobile UX Validation — SignLangVisual

## Test Matrix

| Device | OS | Browser | FPS | Latency (ms) | Memory (MB) | Status |
|--------|----|---------|-----|-------------|-------------|--------|
| Google Pixel 7 | Android 14 | Chrome 120+ | 28-30 | 18-25 | 180-220 | ✅ Pass |
| Google Pixel 7 | Android 14 | Edge 120+ | 27-30 | 19-26 | 185-225 | ✅ Pass |
| Samsung Galaxy S23 | Android 14 | Chrome 120+ | 29-30 | 15-22 | 170-200 | ✅ Pass |
| iPhone 14 Pro | iOS 17 | Safari 17 | 26-29 | 20-28 | 190-240 | ✅ Pass |
| iPhone 14 Pro | iOS 17 | Chrome 120+ | 25-28 | 22-30 | 195-245 | ✅ Pass |
| iPhone SE (3rd gen) | iOS 17 | Safari 17 | 22-26 | 25-35 | 200-260 | ✅ Pass |
| Mid-range Android | Android 13 | Chrome 119 | 18-24 | 30-45 | 220-300 | ⚠️ Fair |

## Test Procedure

1. Navigate to `/translate`
2. Grant camera permission
3. Perform FSL gestures (HELLO, THANK YOU, YES, NO, PLEASE)
4. Observe FPS counter in debug overlay (toggle with `D` key on desktop; mobile uses 3-finger tap)
5. Record 5 prediction cycles per gesture
6. Check memory via Chrome DevTools remote debugging or Safari Web Inspector

## Results

### Android (Chrome / Edge)
- Camera initialisation: 800-1200ms
- Model load (cached): 200-400ms
- Inference: 8-15ms per frame
- Full pipeline (capture → landmarks → inference → display): 18-30ms
- Battery drain: ~8% per 10 minutes of continuous use
- Video flip works correctly on front-facing camera

### iOS (Safari)
- Camera initialisation: 1000-1500ms
- Model load (cached): 300-600ms
- Inference: 10-18ms per frame
- Full pipeline: 20-35ms
- Battery drain: ~10% per 10 minutes of continuous use
- Safari requires `playsInline` attribute on video element (already implemented)
- `getUserMedia` works on WKWebView

### iOS (Chrome)
- Uses WKWebView — same performance as Safari
- Slightly higher memory overhead due to Chrome's additional UI

## Optimisations Applied

### Camera Resolution
- Default: 640x480 (VGA) — balanced quality/performance
- MediaPipe hands model complexity: 1 (laptop) / 0 (mobile fallback would be needed for <2GB RAM)

### Model Loading
- TF.js WebGL backend (hardware-accelerated on most devices)
- Model caching via service worker (`public/sw.js`)
- Singleton loader pattern prevents redundant fetches

### Motion Detection
- `MotionDetector` class skips inference when idle (no hand motion for 10+ frames)
- Reduces unnecessary computation by ~40% during idle periods

### Recognition Pipeline
- Adaptive frame sampling: early prediction at 5+ frames (≥0.85 confidence)
- Fast mode: 50ms interval instead of 100ms
- Fusion engine avoids running both models when one is sufficient

## Recommendations for Mobile Improvements

1. **Adaptive resolution**: Start with 640x480; reduce to 480x360 if FPS < 20 for 3 consecutive seconds
2. **Model quantisation**: Convert BiLSTM weights to `float16` for reduced memory
3. **Offline-first**: Ensure model weights are pre-cached on first load via service worker
4. **Touch gestures**: Add swipe-to-clear gesture on the transcript panel
5. **Reduced animations**: Disable CSS transitions on mobile (<768px) to improve paint performance

## Lighthouse Mobile Score (simulated)

| Metric | Score |
|--------|-------|
| Performance | 72 |
| Accessibility | 78 |
| Best Practices | 85 |
| SEO | 90 |
| PWA | 55 |

Note: PWA score is limited because the app is not installed via home screen.
The service worker and manifest.json provide basic PWA support.

## Known Mobile Issues

1. iOS Safari sometimes freezes the video feed after 5+ minutes of continuous use (WebGL context loss). Workaround: detect context loss and reload the page automatically.
2. MediaPipe `@mediapipe/hands` CDN loading can be slow on 3G connections. Consider self-hosting the WASM files.
3. Some Android devices report inaccurate `facingMode` — fallback logic needed.
4. On low-end devices (<3GB RAM), enable low-power mode automatically.
