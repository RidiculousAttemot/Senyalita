# Conversation Flow Prediction

## Overview

A lightweight, rule-based prediction engine that estimates the user's next
likely gesture based on conversation context. Predictions are used **only** to
reorder suggested replies — they never override recognition results.

## Architecture

```
recentGestures[] ─┐
currentTopic ─────┤ → ConversationFlowPredictor → FlowPrediction[]
                   │
               Intent Detection
                   │
              Transition Matrix
                   │
              Score + Rank
```

## Transition Matrix

The engine uses a hand-crafted transition probability matrix derived from
natural conversation patterns:

```
Greeting → Introduction (0.4) → Question (0.3) → Response (0.2) → ...
Introduction → Question (0.35) → Response (0.3) → Greeting (0.2) → ...
Question → Response (0.5) → Question (0.2) → Request (0.15) → ...
Response → Question (0.35) → Greeting (0.2) → Farewell (0.2) → ...
Request → Response (0.4) → Question (0.2) → Farewell (0.15) → ...
Emergency → Response (0.5) → Healthcare (0.25) → Request (0.15) → ...
Farewell → Greeting (0.5) → Unknown (0.3) → Response (0.2)
```

## Gesture-Intent Mapping

Each intent maps to gesture labels from the 133-class vocabulary:

- **Greeting**: Hello, Good Morning, How Are You, Nice to Meet You
- **Question**: What, Who, Where, When, Why, How, Which
- **Response**: Yes, No, Thank You, You're Welcome, Understand
- **Emergency**: Help, Emergency, Hospital, Police, Pain
- **Food**: Food, Eat, Drink, Water, Rice, Bread, Meat, Fish, Chicken
- **Healthcare**: Doctor, Nurse, Hospital, Medicine, Sick, Pain, Fever
- **Education**: School, Teacher, Student, Study, Learn, Book, Read
- **Transportation**: Car, Bus, Jeepney, Taxi, Train, Go, Come, Travel

## Topic Boost

When the conversation has a detected topic, predictions matching that topic
receive a +0.15 probability boost.

## Output

```typescript
type FlowPrediction = {
  predictedIntent: ConversationIntent;
  probability: number;
  suggestedGestures: Array<{ label: string; score: number }>;
};
```

## Integration

The `ConversationAssistant` class integrates flow prediction:

```typescript
assistant.getFlowPredictions()      // → FlowPrediction[]
assistant.getNextGestureSuggestions() // → { label, score, intent }[]
```

These feed into the UI to reorder suggested replies, placing predicted gestures
higher in the list without ever modifying recognition results.

## Design Decisions

1. **No ML model**: Pure rule-based to keep latency negligible (<1ms)
2. **Never overrides recognition**: Predictions only affect reply ordering
3. **Context window**: Uses last 10 messages for topic detection
4. **Fallback**: Empty context defaults to Greeting intent
