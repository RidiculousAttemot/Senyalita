# FSL Alphabet Recognition Integration

## Integration Summary

The Stage 2 LSTM sequence model has been exported to TensorFlow.js format and integrated into the live camera pipeline. The mock recognizer has been replaced with real model inference running entirely in the browser.

The pipeline performs real-time FSL alphabet recognition from MediaPipe hand landmarks. A rolling 120-frame sequence buffer is sampled to 30 temporal steps and fed into a forward LSTM with 32 hidden units, producing classified output with confidence scores and top-3 suggestions.

## Model Used

**Selected model:** Stage 2 LSTM (forward, 32 hidden units, 30 temporal steps)

**Selection rationale:**
1. BiLSTM: not yet implemented
2. LSTM: chosen — completed, trained, and verified
3. Baseline MLP: not selected (flattened architecture, more overfit)

The LSTM was preferred over the baseline MLP because it consumes the temporal structure of landmark sequences directly, shows reduced overfitting (lower train accuracy, higher validation accuracy), and improves test macro F1 (+1.19%) and test loss (-0.9452) compared with the baseline.

LSTM test accuracy: 69.41%
LSTM test macro F1: 68.50%

## TFJS Export Process

The trained model weights were exported from the pure-JavaScript LSTM trainer to TensorFlow.js format using:

```
scripts/export-fsl-alphabet-tfjs.mjs
npm run export:fsl-alphabet:tfjs
```

The export script:
1. Reads the LSTM weights from `models/fsl_alphabet/lstm/model.json`
2. Builds an equivalent `tf.Sequential` model (LSTM → Dropout → Dense)
3. Sets the trained weights on the TFJS layers
4. Serializes the model topology and weights to `models/fsl_alphabet/tfjs/`
5. Copies model files to `public/models/fsl_alphabet/tfjs/` for browser serving

Output files:
- `model.json` — TFJS model topology and weight manifest
- `weights.bin` — concatenated float32 weight data (85,104 bytes)
- `labels.json` — 28-class label mapping (a-z, ñ, ng)

The model loads at runtime via `tf.loadLayersModel` with `tf.io.fromMemory` using a custom ModelArtifacts object constructed from fetched JSON and binary weight data.

## Runtime Pipeline

```
MediaPipe Hands (onResults callback)
  → Extract landmarks + handedness per frame
  → Smooth landmarks (exponential moving average, alpha 0.2)
  → Separate into left/right hand slots
  → Normalize: wrist-center + max-abs scale (matching training preprocessing)
  → Append 126-dim frame to rolling 120-frame buffer
  → Every 200ms, sample 30 evenly spaced frames from buffer
  → TFJS inference: [1, 30, 126] → [1, 28] softmax probabilities
  → Translate label ID to display text (a→A, ñ→Ñ, ng→NG)
  → Smooth output via majority vote over last 10 predictions
  → Update UI with predicted sign, confidence, top-3 suggestions
```

Key files:
- `src/features/recognition/model/loader.ts` — TFJS model load + cache + inference
- `src/features/recognition/buffer.ts` — SequenceBuffer class (120-frame rolling window)
- `src/features/recognition/normalize.ts` — Landmark normalization matching training
- `src/features/recognition/smoothing.ts` — PredictionSmoother (majority vote, window 10)
- `src/features/recognition/translation.ts` — Label to display-text mapping
- `src/features/recognition/useRecognition.ts` — React hook orchestrating the full pipeline
- `src/app/(routes)/camera/page.tsx` — Camera page with integrated recognition UI

## Performance Metrics

| Metric | Value |
|---|---|
| Model size (weights.bin) | 85,104 bytes |
| TFJS model load time | <1s (cached after first load) |
| Inference input shape | [1, 30, 126] |
| Inference interval | 200ms |
| Sequence buffer length | 120 frames (~4s at 30fps) |
| Prediction smoothing window | 10 predictions |
| Frame sampling method | Evenly spaced 30 from 120 |
| Camera FPS target | 30fps (MediaPipe native rate) |

The model runs asynchronously on a 200ms timer to avoid blocking the camera feed. The TFJS inference call (`model.predict`) uses the WebGL backend in the browser and is measured at well under 50ms per inference on modern hardware.

## UI State Machine

The recognition UI transitions through these states:

1. **Loading model** — TFJS model fetch, deserialize, warmup inference
2. **Collecting sequence** — Progress counter (0/120 → 120/120)
3. **Predicting** — Live prediction with confidence and top-3 suggestions
4. **Error** — Model load failure message displayed

## Known Limitations

- **Test accuracy 69.41%** — not yet thesis-ready; ~30% of predictions are incorrect
- **Single forward LSTM** — bidirectional would capture more temporal context
- **30/120 temporal sampling** — may discard useful intermediate frames
- **85 test samples** — small evaluation set (3 per label); per-label metrics are noisy
- **No data augmentation** — training uses only collected samples
- **Single signer dataset** — model may not generalize to different hand shapes or lighting
- **TFJS dependency** — adds ~280kB to the camera page bundle

## Future Improvements

- Replace forward LSTM with BiLSTM for bidirectional temporal context
- Train with full 120-frame sequences (no temporal sampling)
- Data augmentation (rotation, scaling, noise) during training
- Collect more samples per label (target 50+ per signer)
- Multi-signer data collection for better generalization
- Export to WebAssembly backend for lower inference latency
- Confidence thresholding with retry prompts for low-confidence predictions

## Validation Checklist

- [x] TFJS model loads successfully
- [x] Rolling sequence buffer works
- [x] Real predictions displayed
- [x] Confidence scores displayed
- [x] Top-k predictions displayed
- [x] Prediction smoothing active
- [x] No mock recognizer remains
- [x] Lint passes
- [x] Build passes

Last updated: 2026-06-04
