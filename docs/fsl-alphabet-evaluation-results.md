# FSL Alphabet Recognition Evaluation

## Logging Architecture

All prediction events are logged locally in the browser using `localStorage` with automatic fallback behavior. The logging layer is a standalone module at `src/features/logging/` with three concerns:

- **Storage** (`storage.ts`) — wraps `localStorage` for reading/writing logs and sessions. Automatically truncates to the last 100 entries if storage is full.
- **Logger** (`logger.ts`) — creates prediction log entries and session metadata, computes analytics (most/least confident labels, averages, per-label counts).
- **Types** (`types.ts`) — defines `LogEntry`, `Session`, `SessionAnalytics`, `ConfidenceThreshold`, and `TranscriptEntry`.

No backend, Supabase, or authentication is involved. All data lives in the browser.

## Session Tracking

Each visit to the camera page creates a session:

- A unique `sessionId` is generated on mount (`session_<timestamp>_<random>`)
- Each prediction is logged with the `sessionId` prefix
- On unmount, `endSession()` computes session aggregates (total predictions, average confidence, average inference time, average FPS) and persists the session

Sessions are visible on the `/history` page, sorted by recency.

## Evaluation Panel

A developer-only panel on the camera page sidebar displays real-time metrics:

- Current confidence
- Average confidence (rolling window of last 100 predictions)
- Current FPS
- Average FPS
- Current inference time (ms)
- Average inference time
- Total predictions in session

## Confidence Thresholding

Users can set a confidence threshold from the transcript panel:

| Setting | Behavior |
|---|---|
| 50% | Accept predictions with ≥50% confidence |
| 60% | Accept predictions with ≥60% confidence (default) |
| 70% | Accept predictions with ≥70% confidence |
| 80% | Accept predictions with ≥80% confidence |

When confidence is below the threshold:
- "Low confidence" is displayed instead of the predicted label
- The predicted label is NOT appended to the running transcript

## Recognition Transcript

The running transcript shows a sequence of recognized signs (letters):
- Only appends predictions that pass the confidence threshold
- Skips consecutive duplicates: `A A A A` becomes `A` unless the prediction changes
- Cleared with the "Clear transcript" button

## History Page

Available at `/history`:

- **Session list** — clickable session cards with date, prediction count, and average confidence
- **Session detail** — selected session shows full analytics, per-label stats, and a detailed log table
- **Delete session** — removes session and its predictions from local storage
- **Clear all history** — removes all sessions and prediction data
- **Analytics summary** — global across all sessions: total sessions, total predictions, average confidence, most recognized label, total duration

## Export Formats

### JSON Export

File: `fsl-predictions-<timestamp>.json`

Contains all prediction entries across all sessions:

```json
[
  {
    "id": "session_xxx_yyy_zzz",
    "timestamp": "2026-06-04T...",
    "predictedLabel": "A",
    "confidence": 0.85,
    "topK": [...],
    "smoothingEnabled": true,
    "inferenceTimeMs": 12.3,
    "fps": 30
  }
]
```

### CSV Export

File: `fsl-predictions-<timestamp>.csv`

Contains columns: `id, timestamp, predictedLabel, confidence, smoothingEnabled, inferenceTimeMs, fps`

### Session JSON Export

File: `fsl-session-<sessionId>-<timestamp>.json`

Contains both session metadata and all log entries for a single session.

Both export buttons are on the history page. Individual session export is available in the session detail view.

## Evaluation Metrics

| Metric | Source | Update Rate |
|---|---|---|
| Current confidence | Latest prediction | Per inference (200ms) |
| Average confidence | Rolling 100 predictions | Per inference |
| Current FPS | MediaPipe FPS counter | Every 500ms |
| Average FPS | Rolling 100 predictions | Per inference |
| Inference time | `performance.now()` around `model.predict()` | Per inference |
| Total predictions | Session log count | Per inference |

## Known Limitations

- All data is local to the browser — clearing browser storage removes logs
- Rolling average uses a simple 100-entry window, not session-wide
- No export scheduler or batch export
- No analytics visualization (charts, graphs)
- Confidence threshold applies only to transcript — raw predictions are always logged

## Future Improvements

- Add `localStorage` → `IndexedDB` fallback for large datasets
- Visual charts (confidence over time, label distribution)
- Per-session CSV export options
- Configurable rolling window size in evaluation panel
- Export filter by session, date range, or confidence range

## Validation Checklist

- [x] `npm run lint` — No errors
- [x] `npm run build` — No errors
- [x] Logs persist after refresh (localStorage)
- [x] History page loads and displays sessions
- [x] Session analytics (most/least confident, averages, duration)
- [x] JSON export downloads all predictions
- [x] CSV export downloads formatted prediction table
- [x] Confidence threshold dropdown with 50%/60%/70%/80% options
- [x] "Low confidence" display when below threshold
- [x] Running transcript with de-dup (A A A → A)
- [x] Clear transcript button
- [x] Delete individual session
- [x] Clear all history
- [x] Evaluation panel with real-time metrics

Last updated: 2026-06-04
