# Phase 1 Demo Checkpoint

## Summary
Phase 1 is complete. It focuses on the frontend-only camera pipeline with MediaPipe Hands landmark rendering, status indicators, and text-to-speech for a placeholder transcript. A placeholder language toggle (English/Tagalog) is included. No backend, authentication, or AI model integration is included.

## How to Run
1. Install dependencies:
   `npm install`
2. Start the dev server:
   `npm run dev`
3. Open: http://localhost:3000

## How to Demo
1. Open the landing page and click Start.
2. Approve camera permission.
3. Verify:
   - No hands: status shows "No hand detected"
   - One hand: status shows "1 hand detected"
   - Two hands: status shows "2 hands detected"
   - FPS value updates
4. Click Text-to-Speech to play the placeholder transcript.
5. Toggle English/Tagalog to change the placeholder transcript and TTS language.

## Demo Checklist (Quick)
- Landing page loads
- Start opens /camera
- Webcam permission prompt appears
- One-hand and two-hand landmarks render
- Status updates correctly
- English/Tagalog toggle changes placeholder text
- TTS reads the selected placeholder

## Known Limitations
- Placeholder transcript only (no CNN-LSTM yet)
- Detection depends on lighting and camera quality

## Next Phase
Phase 2 introduces the CNN-LSTM model for recognition and translation mapping.
