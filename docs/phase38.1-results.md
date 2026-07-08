# Phase 38.1 — Text-to-Sign UX & TTS Integration

## Summary

Completed polish of the Text-to-Sign translation page and unified the
speech system across the application.

## Files Created

- `src/features/translation-result/index.ts`

## Files Modified

- `src/lib/tts.ts` — added pause/resume/stop, rate/pitch getters/setters,
  voice-change subscription, localStorage persistence
- `src/app/translate/page.tsx` — replaced direct `window.speechSynthesis` calls
  with shared TTS service, wired auto-speak to `speakOn` toggle
- `src/features/text-to-sign/TextToSignInterface.tsx` — complete rewrite with
  state machine, translation result model, animation queue display,
  speech controls, error handling, performance improvements

## Architecture Changes

1. **TTS unification**: All speech now flows through `src/lib/tts.ts`.
   No component directly accesses `window.speechSynthesis`.
2. **State machine**: The Text-to-Sign page uses a single `TranslationState`
   union type instead of multiple boolean flags.
3. **Result model**: Structured `TranslationResult` object replaces scattered
   state variables, ready for the upcoming stickman animation engine.
4. **Animation queue**: Visual queue with active/past/future highlighting;
   works independently of the animation engine.

## State Flow

```
idle → typing → translating → generating-sign-sequence → animating → completed
                                                                        ↓ (any state)
                                                                       error
```

## Performance Improvements

- Memoized `canTranslate`, `glossDisplay`, `queueItems`, `inputPlaceholder`
- Single state union instead of multiple re-rendering booleans
- TTS is a singleton — no duplicate initialization
- `useRef` for auto-speak flag to avoid stale closures
- `translatedRef` prevents repeated auto-speak

## Validation

- All 17 TTS tests pass
- New TTS API methods (pause, resume, stop, rate, pitch, onVoicesChanged) tested
- ESLint, TypeScript, and build all pass
