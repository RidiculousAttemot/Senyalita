# Model Health Dashboard v2

## Route
**`/admin/model-health`**

## New in v2

### AI Health Score (0–100)
Computed from 8 weighted factors:
| Factor | Weight | Source |
|--------|--------|--------|
| Model Status | 15% | TF.js model load state |
| Prediction Quality | 20% | 30-day avg confidence |
| Inference Latency | 10% | 30-day avg inference time |
| Conversation Success | 15% | 30-day conversation success rate |
| Dataset Growth | 10% | Training sample count |
| Animation Coverage | 10% | Animated gestures / total gestures |
| Translation Coverage | 10% | Knowledge base entries / total gestures |
| Acceptance | 10% | Reply acceptance rate |

### Per-Class Accuracy
- Sorted by lowest avg confidence (worst-first)
- Shows total predictions, avg confidence, low-conf rate per gesture

### Coverage Overview
- Animation coverage (animated / total gestures)
- Translation coverage (knowledge base / total gestures)
- Dataset coverage (training sample count)

### Live Inference Latency
- 30-day average and 7-day average
- Color-coded: green (<50ms), yellow (<100ms), red (≥100ms)

### Model Version History
- Shows last 5 deployed versions with accuracy, dataset size, classes, deployment date
