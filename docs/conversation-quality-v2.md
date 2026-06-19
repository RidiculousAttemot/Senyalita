# Conversation Quality Metrics v2

## Overview

Expanded quality scoring that measures communication effectiveness beyond basic
recognition metrics.

## Metrics v1 (existing)

| Metric | Description |
|--------|-------------|
| `overallScore` | Composite 0-100 quality score |
| `avgConfidence` | Mean recognition confidence |
| `replySelectionRate` | Fraction of gestures with reply selection |
| `correctionFrequency` | Corrections per gesture |
| `topicDiversity` | Unique conversation topics detected |
| `successfulConversations` | Count of successful conversations |
| `totalConversations` | Total conversation count |

## Metrics v2 (new)

| Metric | Type | Description |
|--------|------|-------------|
| `responseDelay` | `number` | Average response delay in ms |
| `correctionCount` | `number` | Total corrections in session |
| `recognitionConfidence` | `number` | Running average recognition confidence |
| `communicationCompletion` | `0-1` | Fraction of conversations completed |
| `conversationDuration` | `number` | Session duration in seconds |
| `successfulExchanges` | `number` | Count of successful exchanges |
| `totalExchanges` | `number` | Total exchanges |
| `lowConfidenceRate` | `0-1` | Fraction of low-confidence predictions |
| `exchangeSuccessRate` | `0-1` | Fraction of successful exchanges |
| `communicationSpeed` | `number` | Exchanges per minute |

## QualityMetricsV2 Type

```typescript
type QualityMetricsV2 = QualityMetrics & {
  responseDelay: number;
  communicationCompletion: number;
  conversationDuration: number;
  successfulExchanges: number;
  totalExchanges: number;
  lowConfidenceRate: number;
  exchangeSuccessRate: number;
  communicationSpeed: number;
};
```

## Database: `communication_quality_log`

| Column | Type | Description |
|--------|------|-------------|
| `conversation_id` | `uuid` (FK) | Reference to conversation_sessions |
| `session_token` | `text` | Anonymous user identifier |
| `response_delay_ms` | `real` | Average response delay |
| `correction_count` | `integer` | Number of corrections |
| `avg_recognition_confidence` | `real` | Mean confidence |
| `communication_completion` | `real` | Completion rate (0-1) |
| `conversation_duration_seconds` | `real` | Duration of conversation |
| `successful_exchanges` | `integer` | Successful exchanges |
| `total_exchanges` | `integer` | Total exchanges |

## Integration

The `QualityScoreTracker` class provides both `getMetrics()` (backward-compatible)
and `getMetricsV2()` (extended) methods. The `ConversationAssistant` exposes:

```typescript
assistant.recordResponseDelay(delayMs)
assistant.recordExchange(successful)
assistant.getQualityScoreV2()
```
