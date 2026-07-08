# Research Dashboard

## Overview

The Research Insights dashboard at `/admin/research-insights` provides interactive charts and exportable data for researchers and administrators.

## Tabs

### Dataset Growth
- Sample needs by gesture (prioritized)
- Signer diversity tracking
- Class imbalance visualization

### Confidence Trends
- Confusion pair analysis (predicted vs expected)
- Unstable gestures ranked by variance
- Correction rate tracking

### Gesture Popularity
- Most frequently recognized gestures
- Most corrected gestures
- Phrase frequency analysis

### Translation Trends
- Animation asset usage
- TTS invocation patterns
- Most translated phrases

### Export
- CSV export for spreadsheet analysis
- JSON export for programmatic analysis
- Includes: recommendations, confusion pairs, drift alerts, unstable gestures

## Implementation

`src/app/admin/research-insights/page.tsx` (client component)

Data sources:
- `globalDatasetExpansion` — recommendations
- `globalDriftDetector` — drift alerts
- `globalErrorAnalysis` — confusion pairs, unstable gestures
