# Phase 1 Manual Browser/Webcam Validation

Use this checklist to manually validate the Phase 1 browser and webcam behavior.

Note: Only mark the Phase 1 browser/webcam checklist items as [x] after completing this manual validation.

## Prerequisites
- Node.js and npm installed
- Dependencies installed: `npm install`

## Run the dev server
1. Open a terminal at the project root.
2. Run:
   ```
   npm run dev
   ```
3. Note the local URL printed by Next.js (typically `http://localhost:3000`).

## Validation steps
1. Open the local URL in a modern desktop browser (Chrome, Edge, or Firefox).
2. Landing page loads without errors and shows the Start button and intro.
3. Click Start and confirm navigation to `/camera`.
4. When prompted, allow webcam permission.
5. Confirm the live video feed appears.
6. Show a hand to the camera and confirm MediaPipe landmarks draw on the canvas.
7. Confirm the status indicator changes correctly when a hand is detected or not detected.
8. Verify FPS or detection diagnostics are stable (no severe stutter or frozen frames).
9. Confirm the transcript/output panel appears.
10. Toggle English/Tagalog and confirm the output label or placeholder changes.
11. Use the text-to-speech button and confirm audio playback.
12. Open browser DevTools console and confirm there are no blocking errors.
13. Record a short demo video showing landmarks and text output.

## Pass/fail table (fill in)

| Check | Pass | Fail | Notes |
| --- | --- | --- | --- |
| Landing page loads and Start button shows |  |  |  |
| Start navigates to /camera |  |  |  |
| Webcam permission accepted |  |  |  |
| Live video feed visible |  |  |  |
| Landmarks draw on canvas |  |  |  |
| Status indicator updates |  |  |  |
| FPS/detection stable |  |  |  |
| Transcript/output panel visible |  |  |  |
| English/Tagalog toggle works |  |  |  |
| Text-to-speech plays audio |  |  |  |
| Console has no blocking errors |  |  |  |
| Demo video recorded |  |  |  |
