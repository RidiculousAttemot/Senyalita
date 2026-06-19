# Gesture Relationship Graph

## Overview

The Gesture Relationship Graph creates a comprehensive relationship map for all 133 gestures. Each gesture stores its related gestures, opposite meanings, follow-up gestures, conversation category, and usage frequency. This powers intelligent suggestions, learning paths, and the admin visualization panel.

## Architecture

Implemented in `src/features/gestures/gestureRelationshipGraph.ts`.

### Graph Structure

```
GestureNode {
  label: string;
  displayName: string;
  category: "alphabet" | "phrase";
  conversationCategory: ConversationIntent;
  relatedGestures: string[];      // Same-category gestures
  oppositeMeaning: string[];      // Direct opposites
  followUpGestures: string[];     // Natural follow-up chain
  usageFrequency: number;         // How often used
}

RelationshipEdge {
  source: string;
  target: string;
  relationship: "related" | "opposite" | "follow_up" | "conversation_flow";
  weight: number;
}
```

### Relationship Types

#### Opposite Pairs (19 pairs)
Examples:
- YES ↔ NO, CORRECT ↔ WRONG, HOT ↔ COLD
- LIGHT ↔ DARK, FAST ↔ SLOW
- UNDERSTAND ↔ DON'T UNDERSTAND
- HELLO ↔ GOODBYE, SUGAR ↔ NO SUGAR
- FATHER ↔ MOTHER, BOY ↔ GIRL

#### Follow-up Chains
Natural conversation flows:

```
HELLO → HOW ARE YOU → IM FINE → THANK YOU → YOURE WELCOME → GOODBYE

GOOD MORNING → HOW ARE YOU → IM FINE → THANK YOU

HOSPITAL → EMERGENCY → HELP → THANK YOU

PAIN → HOSPITAL → HELP → THANK YOU
```

#### Related Gestures (Same Category)
Gestures sharing the same conversation intent are automatically linked with weight 0.3.

### Conversation Categories

| Category | Gestures |
|----------|----------|
| Greeting | HELLO, GOOD MORNING, HOW ARE YOU, etc. |
| Response | YES, NO, THANK YOU, UNDERSTAND, etc. |
| Farewell | GOODBYE, SEE YOU TOMORROW |
| Emergency | HELP, EMERGENCY, HOSPITAL |
| Food | WATER, RICE, BREAD, COFFEE, etc. |
| Introduction | FATHER, MOTHER, DEAF, BLUE, etc. |
| Education | MONDAY, JANUARY, ONE, TWO, etc. |
| Request | PLEASE, SLOW, FAST |
| Healthcare | HOSPITAL, DOCTOR, PAIN |
| Transportation | CAR, BUS, TRAIN (placeholders) |

## API

| Method | Description |
|--------|-------------|
| `getNode(label)` | Get gesture node with all relationships |
| `getAllNodes()` | Get complete gesture list |
| `getEdges()` | Get all relationship edges |
| `getGraphData()` | Get full graph (nodes + edges) |
| `getConnectedGestures(label, maxDistance)` | Get connected gestures up to N hops |
| `getFollowUpChain(label, depth)` | Get follow-up chain (up to depth) |
| `recordUsage(label)` | Track gesture usage frequency |
| `getGesturesByCategory(category)` | Filter by category |
| `getMostFrequentGestures(limit)` | Top N most used |
| `getLeastFrequentGestures(limit)` | Bottom N least used |

## Visual Example

```
       HELLO
         ↓
    HOW ARE YOU
         ↓
     IM FINE
      ↓    ↓
THANK YOU  HOW ABOUT YOU
    ↓
YOURE WELCOME
    ↓
 GOODBYE ←── SEE YOU TOMORROW
```

## Files Created

- `src/features/gestures/gestureRelationshipGraph.ts`
- Updated `src/features/gestures/index.ts`

## Admin Panel

The gesture relationship graph is exposed in the admin panel under a new visualization section. It allows administrators to:
1. View the complete relationship graph
2. Filter by category
3. Click on nodes to view relationships
4. See usage frequency
5. Export graph data
