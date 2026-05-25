# Phase 1 Checklist (Frontend Pipeline)

Goal: Get a working real-time camera pipeline with landmarks and text output.

## Setup
- Create Next.js + TypeScript project
- Confirm app boots locally

## Landing Page
- Add a Start button that navigates to the camera page
- Add a short system intro

## Camera Page
- Request webcam permission using getUserMedia
- Show live video feed
- Add a canvas overlay for drawing landmarks

## MediaPipe Integration
- Load MediaPipe Hands
- Draw 21 landmarks on the canvas
- Show a basic status indicator (e.g., "Hand detected")

## Output Panel
- Add a transcript area
- Display placeholder text output
- Add a button for text-to-speech (browser TTS)

## Validation
- Works in modern desktop browser
- Stable frame rate and clean overlay
- No blocking errors in console

## Deliverable
- Short demo video of live landmarks and text output
