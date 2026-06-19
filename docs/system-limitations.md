# System Limitations

## 1. Environmental Limitations

### Lighting Sensitivity

MediaPipe hand tracking accuracy degrades significantly under:

| Condition | Impact | Mitigation |
|-----------|--------|------------|
| Low light (<50 lux) | Landmark detection fails | Use in well-lit rooms |
| Backlight (face dark, background bright) | False landmarks | Position light in front |
| Direct sunlight on camera | Overexposure, lost landmarks | Use indoors or shade |
| Flickering light (fluorescent, LED) | Intermittent tracking | Use natural or steady light |

### Background

| Issue | Impact | Mitigation |
|-------|--------|------------|
| Cluttered background | Slow detection, false positives | Plain background recommended |
| Moving objects behind user | Distraction for tracker | Static background |
| Mirrors or glass surfaces | Duplicate hand detections | Avoid reflective surfaces |

---

## 2. Hardware Limitations

### Camera Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Resolution | 480p | 720p+ |
| Frame rate | 15 FPS | 30 FPS |
| Autofocus | Not required | Helpful for varying distance |
| Field of view | 60° | 70°+ for two hands |

### Browser Support

| Browser | MediaPipe | TF.js WebGL | TTS | Status |
|---------|-----------|-------------|-----|--------|
| Chrome 90+ | ✅ | ✅ | ✅ | Fully supported |
| Edge 90+ | ✅ | ✅ | ✅ | Fully supported |
| Firefox 90+ | ✅ | ✅ | ✅ | Supported |
| Safari 15+ | ⚠️ Partial | ⚠️ Partial | ✅ | Limited |
| Mobile Chrome | ✅ | ⚠️ May throttle | ✅ | Works, slower |
| Mobile Safari | ⚠️ Limited | ❌ | ⚠️ | Not recommended |

### GPU Dependency

TF.js WebGL backend requires a GPU with WebGL 2.0 support:

- Integrated GPUs (Intel UHD, AMD Radeon Graphics) — ✅ Works, 30 FPS
- Dedicated GPUs (NVIDIA, AMD) — ✅ Works, 45+ FPS
- Software fallback (CPU) — ⚠️ 5-10 FPS, not practical for real-time

---

## 3. Recognition Limitations

### Vocabulary Coverage

| Aspect | Current | Full FSL |
|--------|---------|----------|
| Total classes | 133 | Thousands |
| Alphabet | 28 (A-Z, Ñ, NG) | 28 complete |
| Phrases | 105 | ~500+ common phrases |
| Regional variations | None | Many across PH regions |
| Context-dependent signs | Not supported | Common in natural signing |

### Static vs. Dynamic

| Gesture type | Supported | Notes |
|-------------|-----------|-------|
| Static (fingerspelling) | ✅ | Letters and held poses |
| Dynamic (movement) | ✅ | Phrases with motion |
| Two-handed asymmetric | ⚠️ Partial | Some pairs work, some don't |
| Facial expressions | ❌ | Only hand landmarks tracked |
| Body language | ❌ | Only upper body hands |

### Connected Signing

The system recognizes **isolated gestures only**. In natural FSL:

- Signs flow continuously without pauses
- Transitions between signs create ambiguity
- Cooldown mechanism (±2s) helps but limits speed
- Future work: continuous sign language recognition

### Common Failure Modes

| Scenario | Failure Rate | Cause |
|----------|-------------|-------|
| One hand occluding the other | ~30% | Landmark tracking lost |
| Fast movement blur | ~20% | Inter-frame displacement too large |
| Low confidence (0.5-0.69) | ~15% | Unclear gesture, partial occlusion |
| Confused labels (similar signs) | ~5% | e.g., SIT vs STAND, MONDAY vs TUESDAY |

---

## 4. Conversation Limitations

### Single-Device Constraint

Both signer and responder share one screen:

- No split-screen or multi-device support
- Signer and responder cannot be in different locations
- Future work: Realtime sync across devices

### Reply Database Coverage

| Category | Covered | Total in DB | Coverage |
|----------|---------|-------------|----------|
| Greetings | ✅ | 8 | 100% |
| Pleasantries | ✅ | 6 | 100% |
| Questions | ✅ | 3 | 70% |
| Farewells | ✅ | 5 | 100% |
| General | ⚠️ | 13 | ~15% |
| **Total** | — | 35 | ~26% of labels |

Only 35 of 133 labels have pre-mapped context replies. Remaining labels fall back to generic gesture_replies or show no suggestions.

### Guided Mode Delay

When guided mode is ON, the hearing user must respond before the signer can perform the next gesture. This creates a slight delay in back-and-forth flow.

---

## 5. Deployment Limitations

### Supabase Free Tier Constraints

| Limit | Free Tier | Our Usage |
|-------|-----------|-----------|
| Database size | 500 MB | ~50 MB |
| Row count | Unlimited | ~10K rows |
| Auth users | 10,000 | ~50 users |
| Storage | 1 GB | ~200 MB |
| Realtime connections | 200 | ~1-5 concurrent |

**Verdict**: Free tier is sufficient for pilot, but a Pro plan ($25/month) is recommended for production.

### Vercel Hobby Tier Constraints

| Limit | Hobby | Our Usage |
|-------|-------|-----------|
| Bandwidth | 100 GB/month | ~5 GB/month |
| Serverless functions | 100 GB-hours | ~10 GB-hours |
| Build minutes | 6,000/month | ~500/month |

**Verdict**: Hobby tier is sufficient for pilot.

---

## 6. Accessibility Limitations

| Feature | Status | Notes |
|---------|--------|-------|
| Screen reader | ⚠️ Partial | No ARIA live regions |
| Keyboard navigation | ⚠️ Partial | Camera area requires mouse |
| High contrast mode | ❌ | Dark mode only |
| Font customization | ❌ | Fixed font family |
| Closed captions | ❌ | For response videos |
| Voice control | ❌ | Hearing users must type/click |

---

## 7. Dataset Limitations

| Issue | Impact |
|-------|--------|
| Single dataset source | No validation on external datasets |
| Limited demographic diversity | All signers from controlled collection |
| Controlled background | No real-world background variation |
| Single camera angle | Frontal view only |
| No temporal diversity | All recordings at similar speed |

---

## Summary

Most limitations stem from three core constraints:

1. **Browser-based ML** — No access to native GPU acceleration or depth sensors
2. **Single-camera setup** — No depth information or multi-view fusion
3. **Limited dataset** — 133 classes from one source

These are acceptable trade-offs for a zero-install, privacy-preserving, browser-based solution.
