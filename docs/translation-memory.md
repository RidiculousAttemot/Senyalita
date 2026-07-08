# Translation Memory

## Purpose
Improve translation speed and consistency by storing and reusing successful translations instead of running the grammar engine every time.

## Architecture

```
TranslationMemory
├── entries[]           — All stored translations
├── index               — Fast lookup maps (by text, gloss, gesture)
├── storage provider    — FileSystem, InMemory, or LocalStorage
└── stats               — Cache hit rate, usage frequency, language breakdown
```

## Lookup Flow

1. Check TranslationMemory by original text → return cached if found
2. Check TranslationMemory by gloss → return cached if found
3. Fall through to grammar engine
4. On successful translation → store in TranslationMemory

## Entry Schema

| Field | Type | Description |
|-------|------|-------------|
| originalText | string | Source input text |
| detectedLanguage | string | en / tl / mixed |
| fslGloss | string | Generated FSL gloss |
| gestureSequence | string[] | Gesture labels |
| animationSequence | string[] | Animation asset names |
| administratorCorrections | string[] | Manual corrections |
| usageCount | number | Times this entry was used |
| averageConfidence | number | Average confidence score |
| source | string | conversation / translation / correction / admin |

## Storage

Server-side: `data/translation-memory/translations.json`
Client-side: `localStorage` key `fsl_translation_memory`
