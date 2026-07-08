# Conversation Intelligence

## Dashboard
**Route:** `/admin/conversation-intelligence`

## Conversation Quality Index (0–100)

Computed from five weighted factors:
| Factor | Weight | Description |
|--------|--------|-------------|
| Communication Success | 25% | Ratio of successful conversations |
| Confidence Quality | 25% | Inverse of low-confidence rate |
| Efficiency | 20% | Based on stall rate and messages per conversation |
| Clarity | 20% | Inverse of clarification rate |
| Engagement | 10% | Messages per conversation ratio |

## Metrics Tracked

- Stalled conversations (≤2 messages, not successful)
- Repeated clarifications (same gesture signed twice by signer)
- Misunderstood gestures (confidence < 0.5)
- Average response time between messages
- Daily trends for success rate, confidence, messages, clarifications

## Recommendations Generated

The analyzer automatically produces recommendations when:
- Stall rate > 30%
- Clarification rate > 20%
- Low confidence rate > 20%
- Success rate < 50%
- Average response time > 5s
