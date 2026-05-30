    # Phase 1 Checklist (Frontend Pipeline)

    Goal: Get a working real-time camera pipeline with landmarks and text output.
    Current phase: Phase 2 (Recognition + Logging).

    ## Setup
    - [x] Create Next.js + TypeScript project
    - [x] Confirm app boots locally

    ## Landing Page
    - [x] Add a Start button that navigates to the camera page
    - [x] Add a short system intro

    ## Camera Page
    - [x] Request webcam permission using getUserMedia
    - [x] Show live video feed
    - [x] Add a canvas overlay for drawing landmarks

    ## MediaPipe Integration
    - [x] Load MediaPipe Hands
    - [x] Draw 21 landmarks on the canvas
    - [x] Show a basic status indicator (e.g., "Hand detected")

    ## Output Panel
    - [x] Add a transcript area
    - [x] Display placeholder text output
    - [x] Add a button for text-to-speech (browser TTS)
    - [x] Add an English/Tagalog output toggle (placeholder only)

    ## Validation
    - [x] Works in modern desktop browser
    - [ ] Stable frame rate and clean overlay
        Missing: Manual browser test works, but camera/landmark pipeline is slightly laggy and needs optimization.
    - [ ] No blocking errors in console
        Missing: console not checked during manual validation.

    ## Deliverable
    - [ ] Short demo video of live landmarks and text output
        Missing: demo video not found in repo.
