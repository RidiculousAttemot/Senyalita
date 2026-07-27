# SignLangVisual
The Development of a Real Time Sign Language Recognition and Translation System Using Deep Learning for Text and Speech output

## Requirements

**Node.js 22 LTS** — pinned in [`.nvmrc`](.nvmrc) (currently `22.23.1`) and enforced by
`engines` in `package.json` (`>=22.12.0 <24.0.0`).

```bash
nvm use          # or: fnm use / volta pin
npm install
```

The range is narrow because both ends are load-bearing:

| Bound | Reason |
| --- | --- |
| `>= 22.12.0` | `puppeteer@25` requires it; `knip` and `vitest` agree. Node 20 does **not** qualify. |
| `< 24.0.0` | Next.js 14.2.5's bundled webpack feeds `undefined` to Node 24's hasher, and the build dies with `WasmHash` / `ERR_INVALID_ARG_TYPE`. |

Node 24 is itself an LTS release ("Krypton"), so "just use LTS" is not sufficient
guidance here — the constraint is specifically Next 14.2.5 against Node 24.

Local, CI (`node-version-file: .nvmrc`) and Docker (`node:22-alpine`) all read the
same pin. **Vercel is the exception** — it takes the Node version from project
settings, so set that to 22.x in the dashboard to match.

If a build fails with a hashing error, that is a Node version mismatch. Deleting
`.next` clears the symptom but not the cause.

### Node 24 workarounds in `next.config.mjs`

Two settings exist purely to keep builds working on Node 24. Both are safe to
delete once everyone is on the pinned Node 22:

| Setting | Failure it prevents |
| --- | --- |
| `output.hashFunction = 'sha256'` | `WasmHash._updateWithBuffer` crash — Next's bundled webpack routes hashing through a WASM implementation that breaks on Node 24. |
| `cache = false` (production only) | `Cannot find module './<id>.js'` while collecting page data. The filesystem cache serialises through the same hasher and can emit a manifest referencing chunks it never wrote. Dev keeps its cache; the failure is build-only. |

Disabling the production cache costs full-rebuild time on every build. That is a
deliberate trade for a build that completes.

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
