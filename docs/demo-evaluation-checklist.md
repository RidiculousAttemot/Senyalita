# Demo / Evaluation Checklist

## Prerequisites

- [ ] App builds without errors (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Model loads in browser (check console for `[ModelLoader] Ready`)
- [ ] DEBUG flags disabled for demo (`const DEBUG = false` in translate page and useRecognition — or leave enabled for technical demo)

## Start App

```bash
npm run dev
```

- [ ] Dev server starts without errors
- [ ] Note the actual localhost URL printed by Next.js (e.g. `http://localhost:3000`)

## Browser

- [ ] Open the localhost URL
- [ ] Hard-refresh (Ctrl+F5 / Cmd+Shift+R) to bypass any cached JS
- [ ] Open browser dev console (F12) — no red errors
- [ ] Verify console shows:
  ```
  [ModelLoader] Ready | version: bilstm_v4 | path: /models/fsl_unified/bilstm_tfjs/model.json | classes: 131 | input: [1,35,126]
  ```

## Sign-to-Text Page

- [ ] Navigate to **Sign-to-Text** recognition page (`/translate`)
- [ ] Camera permission prompt appears and is allowed
- [ ] Green landmarks overlay visible on detected hand(s)
- [ ] Status indicator shows active/hand detected

### Right-Hand Alphabet Recognition

Test at least 5 letters (e.g. a, b, c, l, v):

- [ ] Right-hand letter is predicted correctly
- [ ] Confidence is displayed (should be ≥ 0.6 for most easy letters)
- [ ] Predicted label appears in Recognised Characters area
- [ ] Auto-append works — letter is added to the transcript

### Left-Hand Alphabet Recognition

Same 5 letters with left hand:

- [ ] Left-hand letter is predicted correctly (may be slightly lower confidence than right hand)
- [ ] Hand-slot occupancy is correct (console: `left=filled right=null`)
- [ ] Prediction auto-appends to Recognised Characters

### Recognised Characters Controls

- [ ] **Space** inserts a space in the transcript
- [ ] **Backspace** removes the last character
- [ ] **Clear** empties the transcript
- [ ] **Speak now** triggers text-to-speech

### Live Transcript

- [ ] Transcript updates as characters are appended
- [ ] Transcript content matches the signed sequence

### Avatar / Gloss Behavior (if present)

- [ ] Avatar responds to recognised signs
- [ ] Gloss display shows correctly
- [ ] Sign animation plays back smoothly

## Browser Console Check

- [ ] No uncaught errors or warnings related to model/pipeline
- [ ] No fetch failures for model files (model.json, weights.bin, labels.json)
- [ ] MediaPipe runs at acceptable framerate

## Demo Recording

- [ ] Screen recording software is ready
- [ ] Camera feed is visible in the recording
- [ ] Landmarks overlay is visible
- [ ] Predicted labels are readable
- [ ] Audio (TTS) is captured if needed

## Known Limitations

To mention during demo:

- **Alphabet + phrase recognition only** — the model supports 26 alphabet letters and 105 FSL phrase signs. It does not yet support word-level gesture recognition.
- **No word gesture training** — continuous sign language recognition (word-level) is not implemented. The system operates on isolated signs.
- **Confidence varies by condition** — lighting, background clutter, camera angle, and signer hand shape can affect confidence. Holding the sign steady produces the best results.
- **Left vs right hand** — both hands are supported and confidence is comparable for most letters. Individual results may vary by signer.
- **Two-handed signs** — some FSL-105 phrases require both hands. The model supports this, but two-handed gestures may have higher variability.
- **Not a full SLT system** — this is an isolated sign recognition system, not a continuous sign language translator.
