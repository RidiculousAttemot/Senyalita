# FSL Grammar Rules

## Overview

FSL grammar rules transform English/Tagalog sentence word order into FSL gloss order. Rules are configurable, priority-sorted, and language-aware.

## Rule Format

```typescript
interface GrammarRule {
  name: string;               // Unique identifier
  pattern: string[];          // Words to match (greedy, in-order)
  replacement: string[];      // Replacement sequence
  priority: number;           // Higher = applied first
  languages: DetectedLanguage[];  // Which languages this applies to
  description: string;        // Human-readable explanation
}
```

## Active Rules (35 total)

### Question Inversion
| Pattern | Replacement | Priority | Languages | Description |
|---------|-------------|----------|-----------|-------------|
| `HOW ARE YOU` | `YOU HOW` | 100 | en,mixed | How are you → YOU HOW |
| `WHAT IS YOUR NAME` | `NAME YOUR WHAT` | 90 | en,mixed | What is your name → NAME YOUR WHAT |
| `WHERE IS` | `WHERE` | 80 | en,mixed | Where is → WHERE |

### Subject-Verb Order
| Pattern | Replacement | Priority | Languages | Description |
|---------|-------------|----------|-----------|-------------|
| `I NEED` | `NEED I` | 90 | en,mixed | I need → NEED I |
| `I WANT` | `WANT I` | 90 | en,mixed | I want → WANT I |
| `I HAVE` | `HAVE I` | 90 | en,mixed | I have → HAVE I |
| `MY NAME` | `NAME MY` | 90 | en,mixed | My name → NAME MY |

### Copula Deletion
| Pattern | Replacement | Priority | Languages | Description |
|---------|-------------|----------|-----------|-------------|
| `I AM HAPPY` | `I HAPPY` | 70 | en,mixed | Delete "am" |
| `I AM TIRED` | `I TIRED` | 70 | en,mixed | Delete "am" |
| `I AM VERY` | `I VERY` | 60 | en,mixed | Partial match |

### Time-First Rule
| Pattern | Replacement | Priority | Languages | Description |
|---------|-------------|----------|-----------|-------------|
| `TODAY` | `TODAY` | 50 | all | Time markers first |
| `TOMORROW` | `TOMORROW` | 50 | all | Time markers first |
| `YESTERDAY` | `YESTERDAY` | 50 | all | Time markers first |

### Phrase Compaction
| Pattern | Replacement | Priority | Languages | Description |
|---------|-------------|----------|-----------|-------------|
| `NICE TO MEET YOU` | `NICE MEET YOU` | 85 | en,mixed | Remove "to" |
| `SEE YOU TOMORROW` | `SEE YOU TOMORROW` | 85 | en,mixed | Keep as-is |

### Tagalog Transformations
| Pattern | Replacement | Priority | Languages | Description |
|---------|-------------|----------|-----------|-------------|
| `SALAMAT` | `THANK YOU` | 90 | tl | Salamat → THANK YOU |
| `KUMUSTA` | `HOW ARE YOU` | 90 | tl | Kumusta → HOW ARE YOU |
| `MAGANDA` | `BEAUTIFUL` | 80 | tl | Maganda → BEAUTIFUL |
| `MABUTI` | `GOOD` | 80 | tl | Mabuti → GOOD |
| `GUSTO` | `WANT` | 80 | tl | Gusto → WANT |
| `AYAW` | `DONT WANT` | 80 | tl | Ayaw → DONT WANT |
| `AKO AY` | `I` | 95 | tl | Ako ay → I |
| `OPO` | `YES` | 90 | tl | Opo → YES |
| `HINDI` | `NO NOT` | 80 | tl | Hindi → NO |
| `KA` | `YOU` | 70 | tl | Ka → YOU |
| `KO` | `MY` | 70 | tl | Ko → MY |
| `MO` | `YOUR` | 70 | tl | Mo → YOUR |

### Deletion Rules
| Pattern | Replacement | Priority | Languages | Description |
|---------|-------------|----------|-----------|-------------|
| `AY` | _(empty)_ | 100 | tl,mixed | Remove inversion marker |
| `BA` | _(empty)_ | 100 | tl,mixed | Remove question marker |
| `PO` | _(empty)_ | 100 | tl,mixed | Remove politeness marker |
| `THE`, `A`, `AN` | _(empty)_ | 100 | en,mixed | Remove English articles |

## Adding New Rules

```typescript
import { addGrammarRule } from "@/features/fsl-translation";

addGrammarRule({
  name: "i-like",
  pattern: ["I", "LIKE"],
  replacement: ["LIKE", "I"],
  priority: 90,
  languages: ["en"],
  description: "I like → LIKE I",
});
```

## Design Principles

1. Rules are pattern-based, not hardcoded per sentence
2. Higher priority rules run first
3. Rules can delete tokens (empty replacement)
4. Multi-word patterns match as contiguous sequences
5. Rules iterate until no more matches (fixpoint)
