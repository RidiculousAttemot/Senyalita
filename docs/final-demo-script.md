# v1.0.0 Final Demo Recording Script

## Prerequisites
- Node.js 18+, npm
- Camera (built-in or external USB)
- Well-lit room, plain background
- Speaker/headphones for TTS audio

## Setup (1–2 min)
1. Open the project in VS Code.
2. Terminal: `npm run dev` — dev server starts at http://localhost:3000.
3. Open Chrome/Edge at http://localhost:3000.

## Demo Walkthrough

### 1. Landing Page (30s)
- Show the page title, brief intro text.
- Click **Start** → navigates to `/camera`.

### 2. Camera Permission (15s)
- Browser prompts for camera access → **Allow**.
- Live feed appears with hand landmark overlay.

### 3. No-Hand / One-Hand / Two-Hand Detection (30s)
- Keep hands away from camera → status shows "No hand detected".
- Hold one hand up → "1 hand detected".
- Hold both hands up → "2 hands detected".
- Point out the FPS counter updating in real time.

### 4. Model Loading (15s)
- First load: observe "Loading model..." state (~1s).
- After load, "Collecting sequence..." appears with progress 0/120 → 120/120.

### 5. Alphabet Recognition — Strong Labels (1 min)
- Sign **a, b, d, g, w, y** slowly (one at a time).
- Hold each sign steady for ~2 seconds.
- Show the predicted letter, confidence %, and top-3 suggestions.
- These labels have perfect F1=1.0 and should show confidence >90%.

### 6. Alphabet Recognition — Confusable Labels (1 min)
- Sign **u** (index up), **v** (peace sign), **r** (crossed index/middle).
- Show that u/v/r may occasionally confuse each other.
- Demonstrate the confidence threshold: when confidence <60%, the prediction is rejected (show "Collecting sequence..." reset).
- Sign **b** and **c** — note they may also confuse (2 test errors).

### 7. Prediction Smoothing (30s)
- Quickly switch between two signs (e.g., **a** → **g**).
- Show that the prediction smoothly transitions (majority vote over last 10).

### 8. Session Logging (30s)
- Sign **h-e-l-l-o** (one at a time, ~2s each).
- Click **End Session**.
- Show the session summary: timestamp, prediction history, per-frame confidence.

### 9. Transcript and Export (45s)
- Show the transcript panel with the sequence of recognized letters.
- Click **Export JSON** → save file, open in VS Code/Notepad to show structure.
- Click **Export CSV** → save file, show the flattened per-frame data.

### 10. TTS (30s)
- Highlight the transcript text.
- Click **Text-to-Speech** → audio plays the transcript.
- Toggle **English / Tagalog** → transcript text and TTS language change.

### 11. History Page (30s)
- Click **History** link in nav.
- Show the list of past sessions with timestamps.
- Click a session to view details (transcript, predictions, export options).

## Closing Statement (15s)

> "This concludes the v1.0.0 demonstration of the real-time FSL alphabet recognition system using a BiLSTM v2 model with 98.15% test accuracy, running entirely in the browser with TensorFlow.js."

## Quick Checklist

- [ ] Landing page → camera permission
- [ ] No/one/two hand detection
- [ ] Model loading + sequence collection
- [ ] Strong label recognition (a, b, d, g, w, y)
- [ ] Confusable label recognition (u/v/r)
- [ ] Confidence threshold rejection
- [ ] Prediction smoothing between signs
- [ ] Session logging + end session
- [ ] Transcript generation
- [ ] JSON export
- [ ] CSV export
- [ ] Text-to-Speech (English)
- [ ] Text-to-Speech (Tagalog)
- [ ] History page
- [ ] Session detail view

## Total Demo Time: ~7–8 minutes
