# Phase 2 Checklist (Recognition + Logging)

Goal: Add the CNN-LSTM recognition model and basic logging.

## Model Integration
- Load CNN-LSTM model (TensorFlow.js)
- Accept landmark sequences as input
- Output predicted class with confidence
- Add smoothing over recent frames

## Translation Layer
- Map model output to text labels
- Display confidence scores in UI

## Logging
- Connect Supabase client
- Save prediction logs for signed-in users
- Add history page to view logs

## Validation
- Model inference runs under real-time constraints
- Logs are saved and retrievable

## Deliverable
- Demo showing live prediction + saved history
