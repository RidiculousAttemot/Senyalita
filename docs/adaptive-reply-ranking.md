# Adaptive Reply Ranking

## Overview

The Adaptive Reply Ranking engine extends the basic intent+confidence ranking
with personalization and conversation awareness factors.

## Architecture

```
gestureLabel ─┐
availableReplies ─┤
context ─────────┤ → ReplyRanker.rank() → ScoredReply[]
userHistory ─────┤
extendedContext ─┘
  ├─ previousReplies[]
  ├─ replyAcceptanceHistory[]
  ├─ communicationSuccessRate
  ├─ conversationTopic
  └─ phraseFrequency Map
```

## Scoring Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Reply priority | 0.20 | Base priority from gesture_reply_relationships |
| Intent match | 0.15 | Reply intent matches current gesture intent |
| Context coherence | 0.10 | Reply intent matches recent conversation context |
| User history | 0.15 | User has selected this reply before |
| Language match | 0.10 | Tagalog boost for tl language preference |
| Previous replies | 0.10 | Reply has been used before in this conversation |
| Acceptance rate | 0.10 | Reply has high historical acceptance |
| Topic alignment | 0.10 | Reply tags match conversation topic |
| Phrase frequency | 0.02–0.10 | Popular replies get a small boost |

## Extended Ranking Context

The `ExtendedRankingContext` type adds:

```typescript
type ExtendedRankingContext = {
  previousReplies: string[];
  replyAcceptanceHistory: ReplyAcceptanceEntry[];
  communicationSuccessRate?: number;
  conversationTopic?: string;
  phraseFrequency: Map<string, number>;
};
```

- `previousReplies`: Tracks replies already used in the current conversation
- `replyAcceptanceHistory`: Logs whether previously suggested replies were accepted
- `communicationSuccessRate`: Overall conversation success rate for the session
- `conversationTopic`: The dominant intent detected in the conversation so far
- `phraseFrequency`: Aggregate count of each reply's usage across sessions

## Implementation

The `ReplyRanker` class in `src/features/conversation/replyRanker.ts` was extended
with a new `applyExtendedContext()` method that applies the additional factors
while preserving the original scoring logic for backward compatibility.

## Database Support

| Table | Purpose |
|-------|---------|
| `gesture_reply_relationships.selection_count` | Tracks how often each reply is selected |
| `gesture_reply_relationships.acceptance_rate` | Tracks acceptance rate per reply |
| `gesture_reply_relationships.last_selected_at` | Recency of reply usage |
| `reply_selection_log` | Granular log of each reply selection event |
