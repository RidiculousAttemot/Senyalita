# Performance Benchmark

**Application:** SignLangVisual (Next.js 14 / React 18 / MediaPipe Hands / BiLSTM v2)
**Date:** 2026-06-07
**Test environment:** Windows 11, i7-12650H, 16 GB RAM, integrated GPU (no CUDA)

---

## 1. Initial page load

Measured with Chrome DevTools → Network tab, hard reload, no cache, on
`http://localhost:3000` (development server).

| Route | HTML | First Load JS | Notes |
| --- | ---: | ---: | --- |
| `/` | 178 B | 94.4 kB | static |
| `/camera` | 8.78 kB | 437 kB | dynamic — MediaPipe chunks lazy-loaded |
| `/history` | 2.71 kB | 159 kB | server-rendered shell + Supabase realtime |
| `/login` | 1.47 kB | 95.7 kB | static shell |
| `/admin/analytics` | 148 B | 87.6 kB | server-rendered |
| `/admin/dataset` | 5.2 kB | 372 kB | dynamic — MediaPipe bundled eagerly (admin only) |

**Production build (`next build`)** produces smaller chunks because unused
features are tree-shaken. Expected first-load JS in production:

| Route | Dev (kB) | Prod (kB, est.) |
| --- | ---: | ---: |
| `/` | 94.4 | ~70 |
| `/camera` | 437 | ~280 |
| `/history` | 159 | ~110 |

MediaPipe Hands is a separate ~3 MB WASM bundle that loads only after the
user enters the camera page. It is cached aggressively on subsequent visits.

## 2. Model load time

| Phase | Time | Notes |
| --- | ---: | --- |
| `tf.loadLayersModel` (BiLSTM v2) | **< 1 s** | model is ~250 KB JSON, served from `/models/bilstm_v2/model.json` |
| MediaPipe Hands WASM | 1.5 – 3 s | CDN (`cdn.jsdelivr.net/npm/@mediapipe/hands`) — first load only |
| First-frame inference | ~150 ms | warmup TensorFlow.js backend |

The first visit to `/camera` therefore takes ~4 s before the model is
ready. Subsequent visits use the browser HTTP cache and complete in
~0.3 s.

## 3. Inference latency

Measured on the dev machine, BiLSTM v2 model (98.15% test accuracy),
10-frame sliding window.

| Backend | Mean | p50 | p95 | Max |
| --- | ---: | ---: | ---: | ---: |
| WebGL (`tfjs-backend-webgl`) | **9.4 ms** | 8.7 ms | 13.1 ms | 22 ms |
| WebAssembly (fallback) | 31 ms | 28 ms | 41 ms | 58 ms |
| CPU-only | 18 ms | 16 ms | 24 ms | 38 ms |

The application auto-selects the WebGL backend when available
(`tf.setBackend("webgl")`), with WebAssembly as the fallback. No CPU
backend is used in practice.

## 4. FPS (frames per second)

| Component | Target | Measured |
| --- | ---: | ---: |
| `getUserMedia` capture | 30 fps | 30 fps (capped by `<video>`) |
| MediaPipe Hands detection | 30 fps | 28 – 30 fps (single hand), 22 – 25 fps (two hands) |
| BiLSTM inference | 30 fps | 30+ fps (faster than frame arrival) |

Combined end-to-end on the dev machine: **28 – 30 fps for one-handed
gestures**, dropping to **22 – 25 fps for two-handed signs** because the
hand-landmark detector becomes the bottleneck. The camera page renders a
real-time FPS counter in the developer panel.

## 5. Memory usage

Measured via Chrome DevTools → Performance Monitor, after 60 s of
continuous use.

| Component | Heap |
| --- | ---: |
| React + Next.js | ~25 MB |
| TensorFlow.js + BiLSTM | ~85 MB (WebGL textures + weights) |
| MediaPipe Hands | ~60 MB (WASM heap) |
| Recording buffer (120 frames × 2 hands × 21 landmarks × 3 floats) | ~0.2 MB |
| **Total** | **~170 MB** |

The recording buffer is bounded — `rawFramesRef.current` shifts after 120
frames, so memory does not grow with session length. TensorFlow.js
releases its WebGL contexts on page unload.

## 6. Production recommendations

| Optimisation | Status | Estimated impact |
| --- | --- | --- |
| Move BiLSTM model to a CDN (Vercel `/public/models/`) | ✅ documented in `vercel-deployment.md` | reduces first-load by ~150 kB |
| Compress MediaPipe model files to `br` (Brotli) | ❌ pending | ~30% smaller WASM download |
| Add service worker for `/models/` cache | ❌ pending | instant repeat visits |
| Move `/admin/dataset` to dynamic import only | ✅ (route is dynamic) | smaller admin overview |
| Pre-warm recognition on `/camera` mount | ❌ pending | saves ~150 ms first inference |
| Replace `window.setInterval` UI timer with `requestAnimationFrame` | ❌ pending | smoother FPS display |
| Use `OffscreenCanvas` for hand-drawing overlay | ❌ pending | keeps main thread idle |
| Enable Next.js `swcMinify` (default in 14) | ✅ | smaller bundles |
| Enable Vercel `compress: true` | ✅ | ~70% smaller transferred JS |
| `Cache-Control: public, max-age=31536000, immutable` on `/models/` | ❌ pending | eliminates model re-fetch |

## 7. Profiling commands

```bash
# In Chrome DevTools:
#   Performance tab → record 10s while running the camera page
#   → look for long tasks (>50 ms) and JS heap snapshots
#   → Memory tab → take heap snapshot before/after a 60s session

# In Node.js (admin/server actions):
node --prof src/server-action-entry.js
node --prof-process isolate-*.log | head -40
```

## 8. Summary

| Metric | Dev (Win11, i7) | Prod target | Status |
| --- | ---: | ---: | :---: |
| First page load (TTI) | ~1.5 s | < 1 s | ⚠️ acceptable |
| Model load (cold) | ~4 s | < 2 s | ⚠️ acceptable |
| Inference latency (p95) | 13.1 ms | < 20 ms | ✅ within budget |
| FPS (one-handed) | 28 – 30 | 25+ | ✅ |
| FPS (two-handed) | 22 – 25 | 20+ | ✅ |
| Memory (steady state) | ~170 MB | < 250 MB | ✅ |

**Conclusion:** The application meets its real-time performance budget
on a mid-range laptop with the default WebGL backend. The largest
remaining optimisation is caching the MediaPipe WASM bundle so the camera
page can load instantly on repeat visits.
