# Smart Gesture Suggestions

## Overview

The Smart Gesture Suggestions system predicts likely upcoming gestures based on the current gesture, conversation context, and intent flow patterns. These predictions improve the ordering of gesture suggestions without replacing or interfering with the recognition pipeline.

## Architecture

Implemented in `src/features/translation/smartSuggestions.ts`.

### Key Components

- **SmartGestureSuggestions** — Main class for suggestion generation
- **FOLLOW_UP_SUGGESTIONS** — Curated follow-up gesture pairs
- **INTENT_FLOW_PRIORITIES** — Intent transition probability matrix
- **Usage Tracking** — Learns from accepted suggestion patterns

## Suggestion Sources

### 1. Direct Follow-ups
Curated pairs capture natural conversational flow:

| Current Gesture | Top Suggestions |
|----------------|-----------------|
| THANK YOU | YOU'RE WELCOME (0.95), NO PROBLEM (0.7), ANYTIME (0.6) |
| HELLO | HOW ARE YOU (0.9), NICE TO MEET YOU (0.7), IM FINE (0.5) |
| HOW ARE YOU | IM FINE (0.9), THANK YOU (0.5), HOW ARE YOU (0.4) |
| DON'T UNDERSTAND | PLEASE (0.8), SLOW (0.7), HELP (0.6) |
| YES | THANK YOU (0.6), GOOD (0.5), CORRECT (0.4) |

### 2. Conversation Flow
Based on intent transition patterns:

```
Greeting → Introduction → Question → Response → Farewell
```

If the current intent is "Question", the system suggests gestures from "Response" and "Question" intents.

### 3. Usage History
The system tracks which suggestions have been accepted in the past, boosting their scores for future suggestions (each acceptance adds +0.02 score).

## Scoring Algorithm

```
Score = BaseScore * ContextWeight + UsageBoost

Where:
- BaseScore: From curated follow-up definitions (0.3-0.95)
- ContextWeight: 1.0 for direct follow-up, 0.6 for conversation flow
- UsageBoost: acceptedCount * 0.02 (max +0.2)
```

## API

| Method | Description |
|--------|-------------|
| `getSuggestions(currentGesture, history, maxCount)` | Get suggestions with scores |
| `recordSuggestionUsed(label)` | Track suggestion acceptance |
| `reset()` | Clear all usage data |

## Files Created

- `src/features/translation/smartSuggestions.ts`
- `src/features/translation/index.ts`

## Performance Impact

- Purely client-side computation
- All lookups are O(1) hash maps
- Suggestion generation completes in < 1ms
- No impact on recognition latency
