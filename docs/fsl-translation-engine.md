# FSL Translation Engine

## Overview

The FSL Translation Engine converts natural language text (English, Filipino, or mixed) into Filipino Sign Language (FSL) gloss sequences ready for animation.

## Architecture

```
Input Text
    ↓
Language Detection (en/tl/mixed)
    ↓
Text Normalization (punctuation, emojis, contractions, abbreviations)
    ↓
Tokenization
    ↓
Intent Detection (greeting, question, request, etc.)
    ↓
Dictionary Lookup (cached, synonym-aware)
    ↓
Unknown Word Resolution (synonyms → related → fingerspelling)
    ↓
FSL Grammar Rules (configurable)
    ↓
FSL Gloss Output
    ↓
Animation Queue → SignAnimationPlayer (Phase 39)
```

## Components

### `src/features/fsl-translation/engine/fslTranslationEngine.ts`
Main orchestrator. Accepts raw text and optional `useGrammar` / `useContext` flags. Produces `FslTranslationResult`.

### `src/features/fsl-translation/gloss/languageDetector.ts`
Detects `en`, `tl`, or `mixed` using keyword frequency analysis (Tagalog markers vs. English markers).

### `src/features/fsl-translation/normalizer/index.ts`
Handles emoji removal, repeated characters, abbreviations, contractions, punctuation cleanup, and whitespace normalization.

### `src/features/fsl-translation/intent/intentDetector.ts`
Detects conversation intent (greeting, farewell, question, affirmation, negation, request, statement) via keyword and regex patterns.

### `src/features/fsl-translation/dictionary/gestureDictionary.ts`
Structured dictionary with 160+ entries. Each entry contains label, gloss, synonyms, English/Filipino translations, category, animation asset reference, and suggested replies. Uses `Map`-based caching for fast lookups.

### `src/features/fsl-translation/dictionary/unknownWordResolver.ts`
Four-tier resolution: direct match → synonym search → substring-related match → fingerspelling. Logs unknown words for dataset expansion.

### `src/features/fsl-translation/grammar/fslGrammar.ts`
35+ configurable grammar rules. Examples:
- `HOW ARE YOU` → `YOU HOW`
- `I AM HAPPY` → `I HAPPY`
- `WHAT IS YOUR NAME` → `NAME YOUR WHAT`
- Tagalog: `SALAMAT` → `THANK YOU`, `KUMUSTA` → `HOW ARE YOU`

Rules are language-aware (apply only to `en`, `tl`, or `all`) and priority-sorted.

### `src/features/fsl-translation/gloss/glossGenerator.ts`
Resolves each word via dictionary, applies grammar rules, tracks translation context (last 10 inputs for contextual translation), and produces the final gloss sequence.

## Usage

```typescript
import { globalEngine } from "@/features/fsl-translation";

const result = globalEngine.translate("How are you today?");
console.log(result.glossText); // "TODAY YOU HOW"
console.log(result.detectedLanguage.language); // "en"
console.log(result.intent); // "greeting"
```

## Performance

- Common phrases: <10ms
- Complex sentences: <50ms
- Target: <100ms for all inputs
