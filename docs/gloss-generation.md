# Gloss Generation System

## Architecture

The gloss pipeline lives in `src/features/fsl-translation/` and consists of:

| Module | File | Role |
|--------|------|------|
| GestureDictionary | `dictionary/gestureDictionary.ts` | Stores gloss entries with multilingual synonyms |
| UnknownWordResolver | `dictionary/unknownWordResolver.ts` | 5-level word resolution strategy |
| GlossGenerator | `gloss/glossGenerator.ts` | Orchestrates resolution and grammar |
| fslGrammar | `grammar/fslGrammar.ts` | 35+ FSL word-order rewrite rules |
| FslTranslationEngine | `engine/fslTranslationEngine.ts` | Main translation orchestrator |

## Resolution Strategy (Part B)

1. **Direct lookup** — exact match in dictionary (confidence: 1.0)
2. **Synonym match** — English or Filipino synonym index (confidence: 0.75–0.85)
3. **Morphological simplification** — strip suffixes: -ing, -s, -ed, -ly, -tion, etc. (confidence: 0.6)
4. **Related word** — substring overlap search (confidence: 0.4)
5. **Fingerspelling fallback** — letter-by-letter spelling (confidence: 0.3–0.9)

## Grammar Rules

- 35+ rules covering question formation, negation, possession, time ordering
- Per-language activation (en, tl, mixed)
- Priority-based iterative application
- Tagalog simplification: marker stripping, pronoun normalization

## Text-to-Sign Bridge

The `text-to-sign` pipeline (`src/features/text-to-sign/`) uses the fsl-translation engine:

```
normalizeInput → fslEngine.translate → buildSequence → buildAnimationQueue
```
