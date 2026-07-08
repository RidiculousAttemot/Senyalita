# TTS Architecture

## Overview

Centralized Text-to-Speech wrapper around the Web Speech API.
All speech in the application flows through `src/lib/tts.ts`.

## API Surface

```ts
class Tts {
  isSupported(): boolean;
  speak(text: string, opts?: TtsOptions): boolean;
  cancel(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  getVoices(): TtsVoice[];
  listVoicesAsync(): Promise<TtsVoice[]>;
  setVoice(uri: string | null): void;
  setRate(n: number): void;   // 0.1–10
  setPitch(n: number): void;  // 0.1–10
  onVoicesChanged(cb): () => void;  // returns unsubscribe

  // read-only
  readonly rate: number;
  readonly pitch: number;
  readonly isSpeaking: boolean;
  readonly isPaused: boolean;
  readonly isPending: boolean;
}
```

## Singleton Pattern

`getTts()` returns a single shared instance. Tests use `__resetTtsForTests()`
to create fresh instances.

## Persistence

All preferences are saved to localStorage:

| Key                    | Value       |
|------------------------|-------------|
| `fsl_tts_voice_uri`    | Voice URI   |
| `fsl_tts_rate`         | Number 0.1–10 |
| `fsl_tts_pitch`        | Number 0.1–10 |
| `fsl_speak_on`         | "true"/"false" |
| `fsl_auto_speak`       | "true"/"false" |

## Consumers

- `src/app/translate/page.tsx` — camera tab (speakReply, speakNow, auto-speak)
- `src/features/text-to-sign/TextToSignInterface.tsx` — text-to-sign tab (auto-speak after translation, manual speak, voice/rate controls)
