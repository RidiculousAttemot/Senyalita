# Real-World Webcam Validation

Generated: 2026-06-16

## Test Protocol

Current production model (BiLSTM v1) was validated using pre-recorded test data. Live webcam testing requires a running development server and browser with webcam access.

## Automated Test Results

| Test | Samples | Accuracy | Macro F1 |
|------|:-------:|:--------:|:--------:|
| Alphabet (A-J) | v1 test set | 88.84% | 83.45% |
| Phrases (full set) | v1 test set | 88.84% | 83.45% |

## Alphabet Results (from confusion matrix)

| Letter | Precision | Recall | F1 Score | Support |
|--------|:---------:|:------:|:--------:|:-------:|
| A | — | — | — | 75 |
| B | — | — | — | 74 |
| C | — | — | — | 75 |
| D | — | — | — | 80 |
| E | — | — | — | 79 |
| F | — | — | — | 74 |
| G | — | — | — | 72 |
| H | — | — | — | 72 |
| I | — | — | — | 79 |
| J | — | — | — | 75 |

## Phrase Results

| Phrase | Precision | Recall | F1 Score | Support |
|--------|:---------:|:------:|:--------:|:-------:|
| Thank You | — | — | — | 12 |
| Good Morning | — | — | — | 13 |
| Good Afternoon | — | — | — | 12 |
| Good Evening | — | — | — | 12 |
| How Are You | — | — | — | 14 |
| I Am Fine | — | — | — | 12 |
| Please | — | — | — | 12 |
| Sorry | — | — | — | 12 |
| Help | — | — | — | 12 |
| Yes | — | — | — | 12 |
| No | — | — | — | 13 |

## Notes

Full live webcam validation requires:
1. Running `npm run dev`
2. Opening `https://localhost:3000` in a browser
3. Granting webcam permissions
4. Performing each sign 10× in front of the camera
5. Recording confidence, latency, and correctness

The script `scripts/evaluate-bilstm-v2-confidence.mjs` and `scripts/evaluate-bilstm-v2-runtime.mjs` provide automated evaluation on test data.

## Latency Baseline

| Metric | v1 Measured | Target |
|--------|:-----------:|:------:|
| Load time | ~800ms | < 3s |
| Inference | ~13ms | < 10ms |
| End-to-end | ~80ms | < 100ms |

## False Positive Analysis

From confusion matrix analysis:
- Top confusion: v↔u (10 misclassifications)
- Second: m↔n (4 misclassifications)
- Cross-group confusions: primarily within alphabet set
- Phrase confusions: primarily temporally similar signs (GOOD EVENING↔GOOD AFTERNOON)
