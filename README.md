# SignLangVisual
The Development of a Real Time Sign Language Recognition and Translation System Using Deep Learning for Text and Speech output

## Phase 1 Status
Phase 1 is complete. It delivers the frontend camera pipeline with MediaPipe Hands landmark rendering, status indicators, language toggle, and text-to-speech for a placeholder transcript.

### What Phase 1 Includes
- Landing page with Start button
- Camera page with webcam permission flow
- Two-hand landmark rendering with MediaPipe Hands
- Status indicator and FPS diagnostic
- Placeholder transcript with English/Tagalog toggle and browser text-to-speech

### Run Locally
1. Install dependencies:
	`npm install`
2. Start the dev server:
	`npm run dev`
3. Open: http://localhost:3000

### Demo Checklist
- Open the landing page and click Start
- Approve camera permission
- Verify one-hand and two-hand landmarks
- Confirm status updates and FPS display
- Toggle English/Tagalog and click Text-to-Speech to read the placeholder transcript

### Demo Script
See docs/phase-1-demo-script.md for a step-by-step recording guide.

### Current Limitations
- No gesture recognition model yet (CNN-LSTM is Phase 2)
- Placeholder transcript only
- Accuracy depends on camera quality and lighting

### Next Phase
Phase 2 will add CNN-LSTM inference, translation mapping, and logging (still frontend-first).

## Phase 3 Status
Phase 3 adds a temporary developer dataset capture panel on the camera page. It records normalized MediaPipe landmark sequences and exports them as JSON for future CNN-LSTM training.
