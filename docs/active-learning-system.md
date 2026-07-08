# Active Learning System

## Overview

The Active Learning System continuously identifies which gestures need more training data, monitors recognition quality, and prepares dataset recommendations for future retraining — without interrupting the production model.

## Components

### 1. Error Analysis Engine (`src/features/analytics/errorAnalysis.ts`)
- Records low-confidence predictions with metadata (confidence, motion, lighting, signer)
- Identifies confusion pairs (e.g., M↔N, V↔U)
- Ranks unstable gestures by variance and correction rate
- Detects environmental trends (low light, camera angle)
- Generates weekly auto-reports

### 2. Dataset Expansion Engine (`src/features/analytics/datasetExpansion.ts`)
- Ranks every gesture by need for more samples
- Factors: F1 score, false positives/negatives, avg confidence, correction rate, current sample count
- Returns prioritized list: "M needs +350 samples", "THANK YOU needs +120 samples"

### 3. Dataset Quality Inspector (`src/features/analytics/datasetQuality.ts`)
- Scores every uploaded sample 0-100
- Checks: blur, hand presence, lighting, framing, motion blur, duplicates
- Configurable threshold (default: 60/100)
- Only approves samples above threshold

### 4. Gesture Clustering (`src/features/analytics/gestureClustering.ts`)
- K-Means++ clustering of landmark feature vectors
- Classifies variations: natural, signer, regional, camera
- Identifies within-class diversity

### 5. Drift Detection (`src/features/analytics/driftDetection.ts`)
- Monitors accuracy, confidence, distribution, lighting, camera angle
- Warning at 10% deviation, critical at 20%
- Stores daily snapshots for trend analysis

## Dashboard

`/admin/active-learning` displays:
- Low-confidence gesture summary
- Top confusion pairs
- Recommended recordings
- Quality pipeline status
- Drift alerts

## Integration

Data flows from:
- `translation_logs` → correction data
- `telemetry_events` → performance snapshots
- `gesture_captures` → sample counts
- `review_queue` → quality pipeline
