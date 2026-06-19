# Recognition Stability Report

## Testing Protocol

1. Open `http://localhost:3000/camera?debug=1`
2. Wait for model to load
3. Perform each gesture 10 times
4. Record prediction, confidence, latency from the debug overlay
5. Calculate mean and standard deviation

## Alphabet Benchmark

Perform **10 runs per letter** for: A, B, C, D, E

| Gesture | Mean Confidence | Std Dev | Mean Latency | Std Dev | Notes |
|---------|----------------|---------|-------------|---------|-------|
| A | | | | | |
| B | | | | | |
| C | | | | | |
| D | | | | | |
| E | | | | | |
| **Alphabet avg** | | | | | |

## Phrase Benchmark

Perform **10 runs per gesture** for: Thank You, Good Morning, Water*, Family*, How Are You

> *`water` and `family` are not in the 133-label model. Use closest available labels: `JUICE`/`MILK`/`COFFEE` for water; `FATHER`/`MOTHER` for family.

| Gesture | Model Label | Mean Confidence | Std Dev | Mean Latency | Std Dev | Notes |
|---------|------------|----------------|---------|-------------|---------|-------|
| Thank You | `THANK YOU` | | | | | |
| Good Morning | `GOOD MORNING` | | | | | |
| How Are You | `HOW ARE YOU` | | | | | |
| (sub: Juice) | `JUICE` | | | | | |
| (sub: Father) | `FATHER` | | | | | |
| **Phrase avg** | | | | | | |

## Category Comparison

| Category | Mean Confidence | Mean Latency | Stable at frame |
|----------|----------------|-------------|-----------------|
| Alphabet | | | 5 |
| Phrase | | | 5 |
| **All** | | | |

## Threshold Recommendation

Based on the confidence distributions above, the recommended confidence threshold is:
- **Alphabet**: >= 80% (higher precision, static hand shapes are very distinct)
- **Phrase**: >= 60% (lower precision needed for dynamic gestures with natural variation)

However, the UI uses a single threshold slider. Recommend leaving default at 60% to avoid hiding valid phrase predictions.
