# AI Conversation Coach

## Overview

The AI Conversation Coach extends the Learn module with detailed instructional content for every gesture. Each gesture entry includes meaning, proper handshape, movement description, common mistakes, related gestures, sample conversations, and recommended next gestures.

## Architecture

Implemented in `src/features/analytics/conversationCoach.ts`.

### Key Components

- **ConversationCoach** — Main class for learning content
- **COACH_DATA** — Comprehensive instructional database (30+ gestures)
- **GestureCoachData** — Detailed learning content per gesture
- **Learning Path** — Recommended progressive learning sequence

## Gesture Coach Data Structure

```typescript
type GestureCoachData = {
  label: string;              // Raw gesture label
  displayName: string;        // Human-readable name
  meaning: string;            // What the gesture means
  handshape: string;          // Proper hand formation
  movementDescription: string; // How to perform the gesture
  commonMistakes: string[];   // Frequent errors to avoid
  relatedGestures: string[];  // Connected gestures
  sampleConversations: string[]; // Usage in conversations
  recommendedNextGesture: string; // What to learn next
  difficultyLevel: "easy" | "medium" | "hard";
  category: string;           // Greeting, Food, etc.
};
```

## Content Examples

### HELLO
| Field | Content |
|-------|---------|
| Meaning | A greeting used to start a conversation |
| Handshape | Open hand, fingers together, palm facing forward |
| Movement | Move hand from side to side at chest level |
| Mistakes | Moving too fast, using wrong palm orientation |
| Next Gesture | HOW ARE YOU |
| Difficulty | Easy |

### DON'T UNDERSTAND
| Field | Content |
|-------|---------|
| Meaning | Need clarification or repetition |
| Handshape | Open hand, palm down, fingers spread |
| Movement | Hand rotates side to side near head while shaking head |
| Mistakes | Not shaking head, too subtle movement |
| Next Gesture | PLEASE |
| Difficulty | Medium |

### HOSPITAL
| Field | Content |
|-------|---------|
| Meaning | Medical facility |
| Handshape | Open hand with 'H' handshape |
| Movement | Cross sign on upper arm |
| Mistakes | Wrong handshape, crossing wrong location |
| Next Gesture | DOCTOR |
| Difficulty | Hard |

## Learning Path

The recommended progressive learning path:

```
Level 1 (Easy) → Level 2 (Medium) → Level 3 (Hard)
    29 gestures       6 gestures       5 gestures
```

### Level 1 — Easy (29 gestures)
Greetings: HELLO, GOOD MORNING, GOOD AFTERNOON, GOOD EVENING, HOW ARE YOU
Responses: IM FINE, THANK YOU, YOURE WELCOME, YES, NO, SORRY, PLEASE
Farewell: GOODBYE
Introduction: FATHER, MOTHER, DEAF, BLUE, RED, GREEN
Food: WATER, RICE, COFFEE, BREAD, CHICKEN, FISH, MEAT
Education: ONE, TWO, THREE

### Level 2 — Medium (6 gestures)
UNDERSTAND, DON'T UNDERSTAND, HELP, SEE YOU TOMORROW, NICE TO MEET YOU, LEARN

### Level 3 — Hard (5 gestures)
HOSPITAL, EMERGENCY, TEACHER, HARD OF HEARING, DON'T KNOW

## API

| Method | Description |
|--------|-------------|
| `getGestureCoachData(label)` | Get learning content for a gesture |
| `getAllCoachData()` | Get all available coach data |
| `getGesturesByDifficulty(level)` | Filter by difficulty |
| `getGesturesByCategory(category)` | Filter by category |
| `getBeginnerGestures()` | Get all easy gestures |
| `getRecommendedLearningPath()` | Get progressive learning sequence |
| `isAvailable(label)` | Check if coach data exists |
| `getCount()` | Get total number of entries |

## Files Created

- `src/features/analytics/conversationCoach.ts`
- Updated `src/features/analytics/index.ts`

## Integration

The Conversation Coach integrates with:
1. **Learn Module** — Enhanced gesture detail pages with coach content
2. **Conversation UI** — Context-aware tips during conversations
3. **Gesture Library** — Quick reference for proper technique
4. **Practice Mode** — Guided practice with feedback

## Performance Impact

- All coach data is static (no runtime generation)
- Lookups are O(1) hash maps
- Zero latency for any access
- ~15KB of static data loaded on demand
