# Longitudinal Performance Report

Generated: 2026-06-16
Period: Last 30 days

> Run `node scripts/monitor-longitudinal-performance.mjs --days 30` with a configured `.env.local` to populate live data.

## Summary

| Metric | Value |
|--------|-------|
| Total predictions | — |
| Days with data | — |
| Average daily predictions | — |
| Average confidence | — |
| Total corrections | — |
| Overall correction rate | — |
| Total conversations | — |

## Key Metrics to Track

| Metric | Definition | Current | Target | Status |
|--------|------------|:-------:|:------:|:------:|
| Daily confidence | Mean prediction confidence per day | — | > 85% | ⏳ |
| Daily failure rate | % of predictions with confidence < 0.60 | — | < 10% | ⏳ |
| Correction rate | User corrections per 100 predictions | — | < 5% | ⏳ |
| Conversation success rate | % of conversations rated successful | — | > 80% | ⏳ |
| Average inference time | Mean model inference latency | — | < 15ms | ⏳ |

## Trend Visualizations

### Daily Predictions (30-day)
```
[Awaiting data — run monitoring script]
```

### Average Confidence (30-day)
```
[Awaiting data — run monitoring script]
```

### Low Confidence Rate (30-day)
```
[Awaiting data — run monitoring script]
```

## Data Pipeline

The `daily_performance_metrics` table is populated by running:

```sql
SELECT public.aggregate_daily_performance(CURRENT_DATE - 1);
```

Recommended: schedule this as a daily cron job (e.g., 1:00 AM daily).

## Automated Monitoring Script

```bash
# Generate report for last 30 days
node scripts/monitor-longitudinal-performance.mjs --days 30

# Generate report for last 7 days (shorter window)
node scripts/monitor-longitudinal-performance.mjs --days 7

# Generate report for last 90 days (quarterly review)
node scripts/monitor-longitudinal-performance.mjs --days 90
```

## Alert Thresholds

Configure alerts when:

| Condition | Severity | Action |
|-----------|----------|--------|
| Daily confidence drops below 70% | Critical | Investigate model/data pipeline |
| Daily failure rate exceeds 20% | Critical | Check for data drift |
| Correction rate exceeds 10% | High | Review model accuracy |
| Conversation success below 60% | High | Review conversation flow |
| Inference time exceeds 30ms | Medium | Check device/browser performance |
