# Demo Evidence Checklist

## Screenshots Required

### Landing Page
- [ ] Page loads at http://localhost:3000
- [ ] Title and intro text visible
- [ ] Start button visible
- [ ] History link visible (if applicable)
- [ ] Language toggle visible (English/Tagalog)

### Camera Page — Pre-Recognition
- [ ] Camera permission prompt
- [ ] Live webcam feed with landmark overlay
- [ ] No hand detected status
- [ ] 1 hand detected status
- [ ] 2 hands detected status
- [ ] FPS counter
- [ ] Model loading state ("Loading model...")
- [ ] Sequence collection state ("Collecting sequence..." with 0/120 progress)

### Recognition Active
- [ ] Predicted sign displayed (large text)
- [ ] Confidence score (percentage bar)
- [ ] Top-3 suggestions listed
- [ ] Strong label prediction (a, d, g, w — F1=1.0) with >90% confidence
- [ ] Confusable label (u/v/r) prediction

### Session Logging
- [ ] Session active indicator
- [ ] Create Session button
- [ ] End Session button
- [ ] Session in progress with accumulating predictions

### Transcript
- [ ] Transcript panel with sequence of recognized letters
- [ ] Text-to-Speech button
- [ ] Language toggle affecting transcript text

### History Page
- [ ] List of past sessions with timestamps
- [ ] Session detail view (expanded)
- [ ] Per-frame prediction details

### Data Export
- [ ] Export JSON button
- [ ] Export CSV button
- [ ] Sample JSON export file content
- [ ] Sample CSV export file content

### Text-to-Speech
- [ ] TTS playing transcript (English)
- [ ] TTS playing transcript (Tagalog)

## Video Recordings Required

### System Walkthrough (3–4 min)
- [ ] Landing page → camera page navigation
- [ ] Camera permission and live feed
- [ ] Hand detection (0/1/2 hands)
- [ ] Model loading → sequence collection → recognition
- [ ] Multiple sign demonstrations (6–8 letters)
- [ ] Session creation and end
- [ ] Transcript display
- [ ] History page
- [ ] Data export (JSON and CSV)
- [ ] Text-to-Speech playback

### Recognition Demo (2–3 min)
- [ ] All 28 labels demonstrated (at least one per label)
- [ ] Strong labels (a, d, g, w, y) — high confidence
- [ ] Confusable labels (u, v, r) — show confidence variation
- [ ] Confidence threshold rejection (if confidence < 60%)
- [ ] Two-hand signing (if applicable)

## Metrics Documentation

### Final Evaluation Report
- [ ] `docs/fsl-alphabet-final-evaluation.md` exists and is complete
- [ ] Test accuracy: 98.15%
- [ ] Per-label F1 scores
- [ ] Confidence calibration analysis
- [ ] Environmental testing notes
- [ ] Recommended settings

### Runtime Metrics
- [ ] `scripts/evaluate-bilstm-v2-runtime.mjs` run successfully
- [ ] Model load time: 11.8 ms
- [ ] Average inference: 13.57 ms
- [ ] p95 inference: 17.60 ms
- [ ] Estimated FPS: 73.7 (avg) / 56.8 (p95)

## Supporting Documents

- [ ] `docs/reproducibility-guide.md`
- [ ] `docs/experiment-summary.md`
- [ ] `docs/thesis-tables.md`
- [ ] `docs/thesis-figures.md`
- [ ] `docs/threats-to-validity.md`
- [ ] `docs/thesis-defense-qa.md`
- [ ] `docs/project-completion-report.md`
- [ ] `docs/final-demo-script.md`

## Repository State

- [ ] git status clean (all changes committed)
- [ ] v1.0.0 tag created
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — successful production build

## Presentation Materials

- [ ] Thesis manuscript chapters drafted
- [ ] Defense slides prepared
- [ ] Live demo practiced with checklist
- [ ] Backup recording of demo (in case of technical issues)

## Notes for Demo Day

1. **Camera**: Use external USB webcam if available (better quality than built-in).
2. **Lighting**: Ensure room is well-lit, avoid backlight.
3. **Background**: Plain wall preferred; avoid clutter behind signer.
4. **Distance**: Position camera 0.5–1.0m from signer.
5. **Internet**: No internet needed — everything runs locally.
6. **Browser**: Chrome or Edge recommended for best TF.js WebGL support.
7. **Audio**: Check speaker/headphone volume for TTS playback.
8. **Backup**: Have a recorded video of the full demo in case of live demo failure.
