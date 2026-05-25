# SignLangVisual System Overview

## Purpose
Real-time Filipino Sign Language (FSL) translation on a single device. The system captures hand gestures, recognizes the sign using AI, and outputs readable text and audio speech.

## Core Pipeline
User performs sign
-> Webcam captures input
-> Hand detection + preprocessing
-> Landmark extraction (MediaPipe Hands)
-> Gesture recognition model (CNN-LSTM)
-> Text output + audio speech

## System Scope
- Single-device, real-time translation
- Web-based interface
- Dynamic sign support planned (sequence-based)
- Public landing page with optional login

## Recommended Web Stack (Free-Friendly)
- Frontend: Next.js (TypeScript)
- CV + AI (client-side): MediaPipe Hands + TensorFlow.js
- Backend/API: Next.js API Routes (same project)
- Database: Supabase (free tier)
- Hosting: Vercel (free tier)

## API Usage
- REST API: app data, logs, and user actions
- WebSocket API: low-latency UI updates during recognition
- Model Inference API: runs the classifier on landmark sequences
- Text-to-Speech API: converts translated text into speech output

## Why This Stack
- Runs in the browser with no server GPU
- Fast, real-time webcam processing
- Simple to deploy and share
- Free tiers available for hosting and database

## Devstart Plan
1. Create a Next.js (TypeScript) project.
2. Build a webcam page using WebRTC getUserMedia.
3. Integrate MediaPipe Hands and render landmarks on canvas.
4. Add a placeholder classifier (rules or dummy output) to prove the pipeline.
5. Display translated text in the UI.
6. Connect Supabase for logging and user data.
7. Later: replace placeholder classifier with CNN-LSTM for dynamic signs.

## Codebase Structure
- src/app: routes, layouts, and API endpoints
- src/features: capture, landmarks, recognition, translation, speech, history
- src/shared: reusable UI, hooks, styles, and shared types
- src/state: global app state (lightweight)
- src/services: external integrations (Supabase, logging)
- src/security: auth, validation, and access control helpers
- src/config: environment and app configuration
- src/utils: pure helper utilities

## User Roles
- Guest user: uses live translation without login
- Registered user: saves history and preferences
- Admin: manages datasets and monitors system health

## Security Approach
- Supabase Auth for user authentication
- Server-side validation on API routes
- Role-based access for admin operations
- Environment-based secrets in config

## AI Placement
The AI model sits between landmark extraction and text output. MediaPipe Hands provides landmarks, then a CNN-LSTM predicts the gesture class from landmark sequences and outputs text with confidence and optional smoothing.

## Two-Stage Algorithm Rationale
We use a two-stage pipeline: MediaPipe Hands extracts reliable hand landmarks, and a CNN-LSTM performs the recognition. This separation improves speed and stability while still capturing both spatial hand shape and temporal motion, which is critical for dynamic signs.
