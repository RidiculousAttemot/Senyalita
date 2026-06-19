# Release Candidate v1.1.0

## Release Date

2026-06-08

## Release Type

**Minor release** — adds FSL-105 gesture recognition, dual-mode UI, evaluation infrastructure, and production monitoring.

## What's New

See [CHANGELOG.md](../CHANGELOG.md) for full details.

### Key Features

- **133-class unified recognition** (28 alphabet + 105 FSL-105 gestures)
- **Dual-mode UI**: category-aware display (alphabet vs phrase)
- **Fast recognition**: ~267ms time-to-first-prediction
- **Confidence hysteresis**: eliminates prediction flicker
- **Debug overlay**: real-time diagnostics via `?debug=1`
- **Evaluation page**: `/evaluation` for UAT data collection
- **Admin import**: one-click gesture library sync
- **Audit scripts**: coverage and metrics monitoring
- **18 production routes** compiled and deployed

## Validation

| Check | Status |
|-------|--------|
| `npm run lint` | ✅ Pass |
| `npm run test` | ✅ 90/90 tests |
| `npm run build` | ✅ 18 pages |
| `tsc --noEmit` | ✅ (build-generated .next/types) |
| Model loads in browser | ✅ (TFJS fromMemory) |
| Camera permission flow | ✅ |
| MediaPipe hand tracking | ✅ |
| Alphabet recognition | ✅ 28 letters |
| Phrase recognition | ✅ 105 FSL-105 gestures |
| Category detection | ✅ alphabet vs phrase |
| Suggested replies | ✅ (phrase only) |
| Transcript logging | ✅ |
| Supabase sync | ✅ |
| Admin pages | ✅ 8 routes |
| Evaluation page | ✅ /evaluation |

## Deployment

- **Platform**: Vercel (Next.js 14.2.5)
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (gesture-videos)
- **Model runtime**: TF.js (in-browser)
- **MediaPipe**: CDN via @mediapipe/hands

## Known Issues

1. **Reference videos**: All 133 gestures need video uploads via admin panel
2. **Apostrophe encoding**: `DON'T UNDERSTAND` / `DON'T KNOW` use Unicode RIGHT SINGLE QUOTATION MARK in model output; verify DB encoding matches
3. **Single confidence threshold**: Same slider applies to both alphabet and phrase; per-category thresholds would be more precise
4. **Evaluation data**: Stored in localStorage only; export JSON before page reload

## Tag

```bash
git tag v1.1.0
git push origin v1.1.0
```

## Assets

- Source code: `https://github.com/anomalyco/SignLangVisual`
- Deployed app: `https://signlangvisual.vercel.app`
- Documentation: `docs/` directory
