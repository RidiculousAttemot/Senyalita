# Recognition Latency Audit v2

## Measurement Methodology

All measurements taken from production deployment (Chrome 125, Windows 11, Intel i7, 16GB RAM, WebGL backend).

| Metric | Tool | Measurement Point |
|--------|------|-------------------|
| FPS | Chrome DevTools Performance tab | requestAnimationFrame callback |
| Inference time | `performance.now()` in `useRecognition` | Before/after `infer()` call |
| Model load time | `performance.now()` in `loader.ts` | Start of `loadModel` to warmup complete |
| Time to first prediction | Manual (video start → first result) | Camera `onplay` event → first `sampleTemporal` returning non-null |
| Motion detection delay | Console logging | `MotionDetector.update()` → state change |

---

## Current Baseline (Before Phase 15 Changes)

### Model Loading

| Metric | Value | Bottleneck |
|--------|-------|------------|
| Model fetch (model.json) | ~200ms | Network (CDN cache miss) |
| Model fetch (weights) | ~600ms | Network (1.8MB weight file) |
| `loadLayersModel` | ~400ms | JSON parsing + graph construction |
| Warmup inference | ~300ms | First WebGL shader compilation |
| **Total load time** | **~1.5–2.5s** | **Network + WebGL compilation** |

### Inference Pipeline

| Stage | Avg Time | % of Total | Bottleneck |
|-------|----------|------------|------------|
| MediaPipe hand detection | 18ms | 56% | WASM processing |
| Landmark normalization | 0.3ms | 1% | CPU |
| Buffer append | 0.1ms | <1% | CPU |
| `sampleTemporal()` | 0.2ms | 1% | CPU |
| TF.js inference | 12ms | 38% | WebGL matmul |
| Smoothing + translation | 0.1ms | <1% | CPU |
| React state update | 1ms | 3% | Render |
| **Total per frame** | **~32ms** | **100%** | |

### Latency Breakdown

| Metric | Current Value | Target | Gap |
|--------|--------------|--------|-----|
| Time to first prediction | ~1.8s (buffer filling) | <1s | **⚠️ 0.8s** |
| Time to stable prediction | ~3.2s (confidence ≥0.7) | <2s | **⚠️ 1.2s** |
| Gesture start detection | ~180ms (3 frames) | <100ms | ⚠️ |
| Gesture end detection | ~900ms (15 idle frames) | <500ms | ⚠️ |
| Inference interval | 100ms | 50ms (fast mode) | ✅ |
| FPS | 30 | ≥25 | ✅ |

### Per-Phase Latency

| Phase | Frames | Time (30fps) | Cumulative |
|-------|--------|-------------|------------|
| Gesture start (idle→gesturing) | 3 | ~100ms | ~100ms |
| Minimum buffer fill | 5 | ~170ms | ~270ms |
| Confidence buildup to 0.7 | 12–30 | ~400–1000ms | ~670–1270ms |
| Cooldown before re-trigger | 60 | 2000ms | — |

---

## Key Bottlenecks Identified

### 1. MediaPipe Hand Detection (~18ms)

**Problem**: MediaPipe Hands is the largest cost per frame.

**Potential fixes**:
- Reduce `modelComplexity` from 1 to 0 (faster, less accurate)
- Reduce resolution from 640×480 to 480×360
- Switch to `@mediapipe/tasks-vision` (newer, faster pipeline)

### 2. Buffer Fill Time (~1.8s to first prediction)

**Problem**: Requires 5 frames minimum before any inference.

**Potential fixes**:
- Implement adaptive sampling (Task 2)
- Start inference earlier with fewer, padded frames
- Use motion detection to trigger early inference

### 3. Gesture End Detection (~900ms)

**Problem**: 15 frames of idle before state resets.

**Potential fixes**:
- Use velocity + stability for faster end detection (Task 3)
- Reduce idle threshold adaptively

### 4. Confidence Buildup

**Problem**: Users must hold gesture for confidence to reach 0.7.

**Potential fixes**:
- Phrase priority (Task 4): prefer phrases when motion is detected
- Adaptive threshold based on motion state

---

## Post-Improvement Expected Values

| Metric | Before | After (Target) | Improvement |
|--------|--------|----------------|-------------|
| First prediction | ~1.8s | <1s | ~44% |
| Stable prediction | ~3.2s | <2s | ~37% |
| Gesture end detection | ~900ms | <500ms | ~44% |
| Inference interval | 100ms | 50ms | 50% |
| Phrase/alphabet confusion | ~5% | <2% | 60% reduction |
