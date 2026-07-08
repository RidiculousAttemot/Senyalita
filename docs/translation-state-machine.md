# Translation State Machine

## States

```
                   ┌──────────────┐
                   │    idle      │
                   └──────┬───────┘
                          │ user types
                          ▼
                   ┌──────────────┐
                   │   typing     │
                   └──────┬───────┘
                          │ presses Translate
                          ▼
                   ┌──────────────┐
                   │ translating  │
                   └──────┬───────┘
                          │ pipeline complete
                          ▼
                   ┌──────────────┐
                   │generating-   │
                   │sign-sequence │
                   └──────┬───────┘
                          │ queue built
                          ▼
                   ┌──────────────┐
                   │  animating   │
                   └──────┬───────┘
                          │ animation done
                          ▼
                   ┌──────────────┐
                   │  completed   │
                   └──────────────┘

    Any state can transition to "error" on failure.
    "completed" → "idle" when user clears.
```

## Implementation

The `TranslationState` type is defined in `src/features/translation-result/index.ts`.
The `TextToSignInterface` component drives its UI from this single state value,
replacing scattered booleans (`isTranslating`, `error`, etc.).
