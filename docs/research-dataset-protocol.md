# Research Dataset Protocol

## Purpose

Generate anonymized, ethically-sourced research datasets from production SignLangVisual data. Enables reproducible academic research while protecting user privacy.

## Data Sources

| Source | Data Included | Anonymized? |
|--------|---------------|-------------|
| `translation_logs` | Gesture label, confidence, inference time, timestamp | ✓ (user_id removed) |
| `review_queue` | Gesture label, confidence, source, original prediction, corrected label, status | ✓ (user_id removed) |
| `conversation_sessions` | Start time, message count, success status | ✓ (user_id removed) |
| `feedback` | Gesture label, rating, comment timestamp | ✓ (user_id removed) |

## Excluded Data

The following are **never** included in research exports:
- User email or display name
- Raw video frames or images
- Audio recordings
- IP addresses or browser fingerprints
- Session IDs that could be correlated back to users
- Conversation message text content (only counts and timing)

## Export Format

### JSON Schema

```json
{
  "exportDate": "2026-06-09T00:00:00.000Z",
  "datasetType": "research_export",
  "description": "Anonymized research dataset — no PII included",
  "metadata": {
    "totalLogs": 15000,
    "totalReviewItems": 234,
    "totalConversations": 89,
    "totalFeedback": 412,
    "dateRange": {
      "from": "2025-06-09T00:00:00.000Z",
      "to": "2026-06-09T00:00:00.000Z"
    }
  },
  "recognitionLogs": [
    {
      "gesture_label": "HELLO",
      "confidence": 0.92,
      "inference_time_ms": 12.3,
      "created_at": "2026-01-15T10:30:00.000Z"
    }
  ],
  "corrections": [
    {
      "gesture_label": "THANK YOU",
      "confidence": 0.31,
      "source": "low_confidence",
      "original_prediction": "THANK YOU",
      "corrected_label": "HELP",
      "status": "approved",
      "created_at": "2026-02-01T14:00:00.000Z"
    }
  ],
  "conversations": [
    {
      "started_at": "2026-03-01T09:00:00.000Z",
      "total_messages": 12,
      "communication_success": true
    }
  ],
  "feedback": [
    {
      "gesture_label": "HELLO",
      "rating": "correct",
      "created_at": "2026-04-01T11:00:00.000Z"
    }
  ]
}
```

## Export Mechanism

### Admin UI

1. Navigate to `/admin/research`
2. View dataset summary (total recognitions, corrections, conversations)
3. Click "Download Research Dataset (JSON)"
4. File downloads as `research_export_YYYYMMDD.json`

### API Endpoint

`GET /api/admin/research/export` — Requires admin authentication. Returns JSON file with `Content-Disposition: attachment` header.

### Implementation

- `src/lib/supabase/queries/research.ts` — `buildResearchDataset()` and `generateResearchExportJson()` functions
- `src/app/api/admin/research/export/route.ts` — API route handler

## Ethical Considerations

1. **Informed consent**: Users agree to data collection for research purposes in the terms of service
2. **Anonymization**: All personally identifiable information is stripped before export
3. **No re-identification risk**: Gesture labels and confidence scores alone cannot identify individuals
4. **Data minimization**: Only data needed for research is included
5. **Transparency**: Users can view their own data in the history page

## Usage Guidelines

Researchers using this dataset should:
1. Cite the original project and paper
2. Not attempt to re-identify users
3. Use data only for FSL recognition research
4. Share derived improvements back to the community

## File Generation Script

For automated exports (research cron job):

```bash
# Download via API
curl -H "Authorization: Bearer <admin_token>" \
  https://signlangvisual.vercel.app/api/admin/research/export \
  -o research_export_$(date +%Y%m%d).json
```
