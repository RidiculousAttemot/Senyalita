# Recognition Analytics

## Dashboard
**Route:** `/admin/recognition-analysis`

Displays comprehensive error analysis for the last 30 days.

## Metrics

### Overview Cards
- Total predictions, avg confidence, avg latency
- Rejection rate (confidence < 0.4)
- Total sessions and registered signers

### Confidence Distribution
- 8 bins from 0.00–1.00 with color-coded cards
- High/Medium/Low confidence breakdown

### Error Analysis
- Confusion matrix — top 20 most confused gesture pairs
- False positives (predicted but no correction) and false negatives (corrected but not predicted)
- Per-gesture quality metrics table (total, avg confidence, avg latency, low-conf rate, correction rate)

### Signer Statistics
- Total registered signers
- Average confidence across signers

## Data Source
Supabase tables: `translation_logs`, `prediction_corrections`, `signer_profiles`
Period: last 30 days (configurable)
