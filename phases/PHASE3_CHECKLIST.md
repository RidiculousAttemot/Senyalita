# Phase 3 Checklist (Dataset Capture)

Goal: Add a frontend-only dataset capture tool for MediaPipe landmark sequences.

## Dataset Module
- Create src/features/dataset with types and helpers
- Add export helpers for JSON download

## Camera Integration
- Add developer dataset capture panel on /camera
- Require a label before recording
- Start/stop/clear/export controls
- Show frame count and duration
- Enforce 10s / 300 frame limit

## Validation
- Records frames while active
- Export JSON downloads successfully
- Existing mock recognition still works

## Deliverable
- Demo showing dataset capture and JSON export
