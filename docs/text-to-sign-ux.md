# Text-to-Sign UX

## Overview

The Text-to-Sign page allows hearing users to type or speak a sentence
and see it translated into sign language via a stick-figure animation.

## Files Created

- `src/features/translation-result/index.ts` — translation result model

## Files Modified

- `src/features/text-to-sign/TextToSignInterface.tsx` — complete rewrite
- `src/app/translate/page.tsx` — unified TTS, auto-speak
- `src/lib/tts.ts` — expanded speech controls and voice-change subscription

## UX States

| State                  | Description                         | UI                        |
|------------------------|-------------------------------------|---------------------------|
| `idle`                 | No input, waiting for user          | Placeholder text          |
| `typing`               | User is typing                     | Input active              |
| `translating`          | Pipeline is processing              | Spinner + "Translating…"  |
| `generating-sign-sequence` | Building animation queue        | Spinner + "Generating…"   |
| `animating`            | Playing sign animation              | Animation + queue display |
| `completed`            | Animation finished                  | Success indicator         |
| `error`                | Something went wrong                | Error banner + dismiss    |

## Key Features

- Auto-speak toggle persisted in localStorage
- Voice selection dropdown
- Speech rate slider (0.25x–2.0x)
- Visual animation queue with active/past/future highlighting
- Language selector (English / Tagalog)
- Error handling with dismissible messages
