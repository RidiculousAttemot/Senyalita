# Translation Confidence Indicator

## Overview

The Translation Confidence system (Part F) computes a per-sentence quality score based on word-level resolution strategies, enabling users and administrators to assess translation reliability at a glance.

## Confidence Levels

| Level | Threshold | Condition |
|-------|-----------|-----------|
| High | ≥ 0.8 overall | No low-confidence words |
| Medium | ≥ 0.6 overall | ≤ 50% low-confidence words |
| Low | < 0.6 overall | > 50% low-confidence words |

## Word-Level Scoring

| Strategy | Confidence | Color | Status |
|----------|-----------|-------|--------|
| direct | 1.0 | Green (#22c55e) | ✓ Known gesture |
| synonym | 0.75–0.85 | Yellow (#eab308) | ⚠ Approximate match |
| morphological | 0.6 | Orange (#f97316) | ⚠ Stemmed word |
| related | 0.4 | Red (#ef4444) | ✗ Uncertain match |
| fingerspelling | 0.3–0.9 | Purple (#8b5cf6) | 🔤 Spelled out |

## UI Display

Located in the info panel of the Translate page:
- **Progress bar**: Visual fill from red → yellow → green
- **Percentage label**: Overall confidence as a number
- **Breakdown counts**: Low-confidence, fingerspelled, unresolved word counts
- **Toggle**: Show/hide confidence panel

## Implementation

`src/features/text-to-sign/confidenceIndicator.ts`:
- `computeTranslationConfidence(glossSequence, sequence)` → `TranslationConfidence`
- `getConfidenceColor(score)` → CSS color string
- `getConfidenceLabel(level)` → Human-readable label
