# Folder Structure

This document explains the purpose, naming, and responsibility of each folder in the project. The layout follows a feature-based architecture to keep the system scalable and easy to explain in a thesis defense.

## Root
- docs: thesis notes, diagrams, design decisions
- public: static assets served by the web app (including sign video clips)
- scripts: dataset prep, exports, and developer tooling
- supabase: Supabase config and database migrations
- tests: integration and e2e tests
- middleware.ts: Next.js middleware for API and request handling

## src
- app: Next.js routes, layouts, and API routes
- features: feature modules (capture, landmarks, recognition, translation, speech, history)
- shared: reusable UI, shared hooks, styles, and shared types (no business logic)
- state: app-level state store
- services: external integrations (Supabase, logging, analytics)
- security: auth and access control helpers
- config: environment and app configuration
- utils: pure helper functions

## Feature Module Pattern
Each feature folder can include:
- components: feature UI only
- hooks: feature-specific hooks
- services: feature-specific adapters
- utils: feature helpers
- index.ts: feature public exports

## Folder Responsibilities (Detailed)
### src/app
Purpose: routing and page composition only. Avoid business logic here.
Files: page.tsx, layout.tsx, and api/* route handlers.
Landing page belongs in src/app and provides the public entry point.

### src/features
Purpose: domain logic and user flows. This is where the system behavior lives.
Examples:
- capture: webcam stream control
- landmarks: MediaPipe setup and landmark extraction
- recognition: model inference, smoothing, confidence thresholds
- translation: label to text mapping
- speech: text-to-speech playback
- reply: phrase selection and sign video playback
- history: logs, export, dataset recording

### src/shared
Purpose: reusable UI and shared utilities with no domain logic.
Avoid business logic here to keep features isolated.

### src/state
Purpose: global state for cross-feature UI or shared controls.
Keep state minimal; prefer feature-local state when possible.

### src/services
Purpose: external integrations only (Supabase, analytics, logging).
Keep thin, avoid domain rules.

### src/security
Purpose: authentication helpers, API route guards, and role checks.
No feature-specific business logic.

### src/config
Purpose: env parsing and app configuration.
Avoid direct process.env usage outside this folder.

### src/utils
Purpose: pure helper functions (formatting, math, timers).
No feature-specific logic.

## Naming Conventions
- Files: kebab-case for routes, camelCase for utilities
- React components: PascalCase
- Hooks: useX.ts
- Services: XService.ts
- Feature exports: index.ts

## Import Strategy
- Use @/ alias pointing to src
- Example: import { useRecognizer } from "@/features/recognition"
- Avoid deep relative imports

## AI/ML Placement
- MediaPipe logic: src/features/landmarks
- Model inference: src/features/recognition (CNN-LSTM)
- Model files: public/models or src/features/recognition/models
- Training scripts: scripts

## Testing Structure
- tests/integration: feature workflows
- tests/e2e: camera and UI flows
- tests/unit (optional): pure helpers

## State Management
- Zustand or React Context in src/state
- Keep feature state local when possible

## Environment and Config
- src/config/env.ts: load and validate env vars
- src/config/appConfig.ts: app-level settings

## Notes
- Empty folders include .gitkeep to preserve structure.
- This structure is designed for scalability and clear thesis presentation.

## Recommended Starting Point
Build src/app (landing + camera) and src/features/landmarks first, then add src/features/recognition and backend services.
