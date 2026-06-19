# Roboflow Dataset Acquisition Audit

Generated: 2026-06-09

## Overview

| Metric | Value |
|--------|-------|
| Dataset source | app.roboflow.com/ds/RHuSj8zWdp |
| Total download size | 3.31 GB (compressed) |
| Uncompressed size | ~4.2 GB |
| Dataset type | Image classification (static images) |

## Structure

| Split | Images | Annotations | Status |
|-------|--------|-------------|--------|
| train | 9,683 | 9,413 | Present |
| valid | — | — | ❌ Missing |
| test | — | — | ❌ Missing |

The dataset contains only a `train/` split. No `valid/` or `test/` splits exist.

## Classes

**Total classes:** 48

### Alphabet (26):
A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z

### Phrase gestures (22):
Afternoon, Are, Boss, Father, Give, Good, Hello, How, I love you, Me, Mine, Morning, Mother, Night, Quiet, See, Serious, Think, This, Wait, Water, You

## Class Distribution

| Class | Samples | Class | Samples | Class | Samples |
|-------|---------|-------|---------|-------|---------|
| U | 316 | Y | 313 | L | 310 |
| G | 308 | B | 308 | Z | 302 |
| W | 298 | S | 297 | J | 295 |
| E | 294 | K | 294 | V | 294 |
| M | 292 | R | 290 | C | 289 |
| F | 286 | H | 284 | T | 283 |
| I | 282 | A | 279 | X | 278 |
| N | 275 | O | 265 | P | 262 |
| Q | 255 | D | 213 | This | 197 |
| Mine | 150 | Think | 148 | Quiet | 147 |
| Serious | 145 | Boss | 143 | Water | 142 |
| Mother | 141 | Father | 141 | I love you | 140 |
| Me | 138 | Good | 137 | You | 124 |
| Wait | 50 | See | 1 | Night | 1 |
| Afternoon | 1 | Morning | 1 | How | 1 |
| Give | 1 | Hello | 1 | Are | 1 |

### Long-tail classes (≤10 samples): **8 classes**
See, Night, Afternoon, Morning, How, Give, Hello, Are (1 sample each)

### Imbalance ratio: 316:1 (max/min)

## Annotation Format

- **Format:** Roboflow CSV (`_annotations.csv`)
- **Columns:** filename, class, xmin, ymin, xmax, ymax (bounding boxes)
- **Annotations:** 9,413 total, 1 per image (single-hand images)
- **Missing labels:** 270 unlabeled JPGs in train/

## Duplicate Detection

| Metric | Value |
|--------|-------|
| Duplicate groups | 73 |
| Unique images | 9,610 |

## Compatibility Assessment

| Requirement | Compatible? | Notes |
|-------------|-------------|-------|
| Static image dataset | ✅ | All samples are JPG images |
| FSL hand gestures | ✅ | 48 classes of FSL gestures |
| MediaPipe hand detection | ✅ | Single hands visible in images |
| Temporal sequence pipeline | ❌ | No temporal dimension |
| BiLSTM training format | ⚠️ | Requires synthetic sequence padding |
| Current train/validation split | ❌ | No validation/test splits |

## Recommendations

1. **Not directly compatible** with the BiLSTM temporal pipeline — images lack motion/temporal information
2. Only the 26 alphabet classes have adequate sample counts for training
3. 22 phrase classes have limited or unusable samples (8 classes have 1 sample each)
4. Can be used as **supplementary frame-level training data** with synthetic sequence padding
5. The 270 unlabeled JPGs should be reviewed for potential additional training data
