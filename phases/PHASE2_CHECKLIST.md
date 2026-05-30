# Phase 2 Checklist (Recognition + Logging)

Goal: Add the CNN-LSTM recognition model and basic logging.

## Model Integration
- [ ] Load CNN-LSTM model (TensorFlow.js)
	Missing: no TFJS model integration found.
- [ ] Accept landmark sequences as input
	Missing: mock recognizer uses single frames only.
- [ ] Output predicted class with confidence
	Missing: mock-only output, no model prediction.
- [ ] Add top-k suggestions for user confirmation
	Missing: mock suggestions shown, but no confirmation flow.
- [ ] Add smoothing over recent frames
	Missing: no smoothing logic found.

## Translation Layer
- [ ] Map model output to text labels
	Missing: mock-only mapping, no model output.
- [x] Display confidence scores in UI

## Logging
- [ ] Connect Supabase client
	Missing: no Supabase client setup found.
- [ ] Save prediction logs for signed-in users
	Missing: no logging or auth flow found.
- [ ] Add history page to view logs
	Missing: no history page found.

## Validation
- [ ] Model inference runs under real-time constraints
	Missing: no model inference implemented.
- [ ] Logs are saved and retrievable
	Missing: no logging implemented.

## Deliverable
- [ ] Demo showing live prediction + saved history
	Missing: demo not found in repo.
