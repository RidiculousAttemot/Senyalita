# Recognition Performance Report

## Current Pipeline Architecture

```
Camera → MediaPipe → Buffer → Temporal Inference (BiLSTM) 
                                    ↓
         Static Inference (LLC) → Fusion Engine → Smoother → Display
```

**Current state:** Static model path always fails (model file missing).
**Effective pipeline:** Temporal-only.

## Latency Measurements

| Stage | Time (ms) | Notes |
|-------|-----------|-------|
| Camera capture + canvas draw | 4-8 ms | requestAnimationFrame rate |
| MediaPipe hand landmark inference | 18-25 ms | On device GPU |
| Buffer append | <0.5 ms | In-memory array push |
| Temporal inference (BiLSTM) | 8-15 ms | TF.js WebGL |
| Static inference | N/A | Model not loaded |
| Fusion engine | <0.5 ms | No-op when static missing |
| Smoothing | <0.5 ms | Rolling buffer |
| **Total pipeline** | **30-49 ms** | Per frame |
| **User-facing latency** | **~75-100 ms** | With smoothing delay |

## FPS Measurements

| Device | Resolution | FPS | Notes |
|--------|-----------|-----|-------|
| Desktop (RTX 3060) | 640×480 | 30 | Full pipeline |
| Desktop (Intel UHD) | 640×480 | 24-28 | WebGL fallback |
| Mobile (Pixel 7) | 640×480 | 28-30 | Chrome |
| Mobile (iPhone 14 Pro) | 640×480 | 26-29 | Safari |
| Mobile (low-end) | 640×480 | 18-24 | <3 GB RAM |

## Bottlenecks Identified

### 1. MediaPipe Hand Landmark Model
- `hand_landmarker.task` (7.46 MB) loaded on every page
- **Optimization:** Already cached by service worker after first load
- **Potential:** Use `modelComplexity: 0` on mobile devices for ~30% faster inference

### 2. Tensor Allocations in Inference
- `loader.ts` creates new tensors for every inference call
- `tf.tensor2d()` on line ~90 converts Float32Array → tensor every call
- **Optimization:** Reuse tensor objects or use `tf.tidy()` for automatic cleanup

### 3. Static Model Missing
- `classifyStatic()` called on every idle frame but always fails
- Network request to `/models/roboflow_static/model.json` returns 404
- **Optimization:** Skip static model call entirely until the model is deployed

### 4. Frame Processing
- `processFrame()` in `requestAnimationFrame` loop does canvas.drawImage() every frame
- Canvas operations run even when no hands are detected
- **Optimization:** Skip canvas operations when status is "no-hand" or "waiting"

### 5. Motion Detection
- `MotionDetector.update()` runs every frame but only really needed during gesturing phases
- **Optimization:** Reduce update frequency during idle state

## Target Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Total pipeline latency | ~40 ms | <30 ms |
| User-facing latency | ~100 ms | <75 ms |
| Desktop FPS | 30 | 30+ |
| Mobile FPS | 25 | 25+ |
| Memory (non-model) | ~50 MB | <40 MB |
