# Translation Dictionary

## Overview

The `GestureDictionary` provides structured lookup for every gesture in the system, with synonym indexing, bilingual search, and animation asset reference.

## Storage

- **Built-in**: 160+ entries in `src/features/fsl-translation/dictionary/gestureDictionary.ts`
- **Database**: Supabase `gestures` table (loaded via `supabase/queries/gestures.ts`)
- **Cache**: In-memory `Map<string, DictionaryEntry>` with `Map<string, string>` synonym index
- **Fallback**: JSON export for offline use

## Entry Structure

```typescript
interface DictionaryEntry {
  label: string;            // Unique key (e.g., "HELLO")
  gloss: string;            // FSL gloss (e.g., "HELLO")
  synonyms: string[];       // Alternative words (e.g., ["hi", "hey"])
  english: string[];        // English translations
  filipino: string[];       // Filipino translations
  category: string;         // Category (greeting, food, color, etc.)
  animationAsset?: string;  // Reference to animation file
  referenceVideo?: string;  // Optional video reference
  suggestedReplies: string[]; // Common follow-up gestures
}
```

## Coverage

| Category | Count | With Animation |
|----------|-------|---------------|
| greeting | 7 | 5 |
| politeness | 4 | 2 |
| affirmation | 3 | 1 |
| negation | 3 | 2 |
| cognition | 4 | 4 |
| description | 13 | 4 |
| emotion | 6 | 0 |
| family | 10 | 10 |
| people | 6 | 4 |
| identity | 5 | 5 |
| relationship | 1 | 1 |
| color | 12 | 12 |
| food | 10 | 10 |
| drink | 6 | 6 |
| number | 10 | 10 |
| time | 24 | 24 |
| alphabet | 26 | 26 |
| healthcare | 4 | 0 |
| location | 8 | 0 |
| question | 6 | 0 |
| action | 5 | 0 |
| order | 2 | 0 |
| general | 3 | 0 |
| **Total** | **~160** | **~120** |

## Lookup Order

1. Direct label match (`entries.get(label.toUpperCase())`)
2. Synonym index (`synonymIndex.get(word.toLowerCase())`)
3. English search (`englishIndex.get(word.toLowerCase())`)
4. Filipino search (`filipinoIndex.get(word.toLowerCase())`)
5. Number parse (0-10 mapped to ONE-TEN)
6. Single letter → alphabet label

## Caching

- Results cached in `Map<string, DictionaryEntry>` per lookup word
- Indexes rebuilt on `addEntry()`
- `getCoverageStats()` provides real-time coverage analysis

## Adding Entries

```typescript
import { globalDictionary } from "@/features/fsl-translation";

globalDictionary.addEntry({
  label: "COMPUTER",
  gloss: "COMPUTER",
  synonyms: ["computer", "pc", "laptop"],
  english: ["computer"],
  filipino: ["kompyuter"],
  category: "technology",
  animationAsset: undefined,
  suggestedReplies: [],
});
```
