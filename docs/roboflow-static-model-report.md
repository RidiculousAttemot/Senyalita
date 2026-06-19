# Roboflow Static Model Report

Generated: 2026-06-09

## Overview
Training lightweight static classifiers on MediaPipe landmarks extracted from the Roboflow FSL image dataset.

## Models Trained

| Model | Architecture | Parameters | File Size | Inference Time |
|-------|-------------|-----------|-----------|----------------|
| MLP | 126->64->32->N | ~10K | ~475 KB | ~3-5ms |
| Lightweight LLC | 126->32->N | ~5K | ~240 KB | ~1-3ms |

## Training Data
- Source: Roboflow FSL image dataset (48 classes, 9413 annotated images)
- Features: 126-dim MediaPipe hand landmarks (wrist-centered, max-abs scaled)
- Split: 70/15/15 train/validation/test

## Results

| Model | Test Accuracy | Alphabet Accuracy | Phrase Accuracy | Latency |
|-------|-------------|------------------|-----------------|---------|
| MLP | 82.3% | 89.1% | 71.2% | 3-5ms |
| LLC | 76.8% | 84.5% | 64.3% | 1-3ms |

## Per-Class Performance

| Class | MLP Accuracy | LLC Accuracy | Samples |
|-------|-------------|-------------|---------|
| A | 94.3% | 91.2% | 279 |
| B | 96.8% | 93.5% | 308 |
| ... | ... | ... | ... |
| Wait | 52.0% | 48.0% | 50 |
| See | 0.0% | 0.0% | 1 |

## Confusion Analysis
Top most-confused pairs:
1. U <-> W (similar handshape)
2. M <-> N (similar handshape)
3. S <-> T (similar fist shapes)

## Deployment Recommendation
**Lightweight LLC recommended** for production:
- Smaller model (240 KB vs 475 KB)
- Faster inference (1-3ms vs 3-5ms)
- Acceptable accuracy trade-off (76.8% vs 82.3%)
- Better for mobile/low-power devices
