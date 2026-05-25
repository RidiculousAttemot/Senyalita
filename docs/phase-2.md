# Phase 2 Mock Recognition Checkpoint

## Summary
Phase 2 introduces a placeholder recognition pipeline. MediaPipe landmarks are passed into a mock recognizer that outputs a simulated prediction, confidence, and top-k suggestions. The UI labels this as a mock/demo preview. No CNN-LSTM or TensorFlow.js model is used yet.

## Data Flow
MediaPipe landmarks -> mock recognizer -> translated text output (English/Tagalog)

## How to Test
1. Start the dev server: `npm run dev`
2. Open http://localhost:3000/camera
3. Verify:
   - No hands: "No sign detected yet." / "Wala pang natutukoy na senyas."
   - One or two hands: "Hello" / "Kumusta"
   - Confidence and top-k suggestions display
   - Toggle English/Tagalog changes output
   - TTS speaks the selected output

## Limitations
- Recognition is mocked; no real model inference
- Prediction is not based on gesture content

## Next Phase
Recommended next phase: capture/export landmark sequences for dataset preparation, then integrate the CNN-LSTM model and replace mock output with real predictions.
