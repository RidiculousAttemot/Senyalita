# FSL Kaggle Dataset Audit Report

**Generated:** 2026-06-06T14:36:39.529Z
**Dataset Path:** C:\Users\tuf\.cache\kagglehub\datasets\japorton\fsl-dataset\versions\1

## Summary

| Metric | Value |
|--------|-------|
| Total Samples | 11700 |
| Total Size | 0.13 GB |
| Unique Labels | 26 |
| Missing Labels | 2 |
| Issues Detected | 0 |

## Label Coverage

Expected labels: 28
Found labels: 26

### Samples per Label

| Label | Count | Size (MB) | Status |
|-------|-------|-----------|--------|
| a | 450 | 3.20 | ✓ Present |
| b | 450 | 5.73 | ✓ Present |
| c | 450 | 4.56 | ✓ Present |
| d | 450 | 5.59 | ✓ Present |
| e | 450 | 4.39 | ✓ Present |
| f | 450 | 6.10 | ✓ Present |
| g | 450 | 4.22 | ✓ Present |
| h | 450 | 7.01 | ✓ Present |
| i | 450 | 5.18 | ✓ Present |
| j | 450 | 4.08 | ✓ Present |
| k | 450 | 4.80 | ✓ Present |
| l | 450 | 5.90 | ✓ Present |
| m | 450 | 4.53 | ✓ Present |
| n | 450 | 4.14 | ✓ Present |
| ñ | 0 | 0 | ✗ Missing |
| ng | 0 | 0 | ✗ Missing |
| o | 450 | 3.75 | ✓ Present |
| p | 450 | 5.58 | ✓ Present |
| q | 450 | 3.77 | ✓ Present |
| r | 450 | 6.07 | ✓ Present |
| s | 450 | 4.03 | ✓ Present |
| t | 450 | 4.89 | ✓ Present |
| u | 450 | 7.23 | ✓ Present |
| v | 450 | 5.17 | ✓ Present |
| w | 450 | 7.50 | ✓ Present |
| x | 450 | 5.57 | ✓ Present |
| y | 450 | 5.82 | ✓ Present |
| z | 450 | 5.04 | ✓ Present |

## File Formats

### Supported Formats

- .jpg: 11700 files

## Missing Labels ⚠️

- ñ
- ng

## Class Distribution Analysis

- Average samples per label: 450.00
- Max samples: 450
- Min samples: 450
- Imbalance ratio: 1.00x

### Samples by Label (descending)

a     | ███████████████████████ 450
b     | ███████████████████████ 450
c     | ███████████████████████ 450
d     | ███████████████████████ 450
e     | ███████████████████████ 450
f     | ███████████████████████ 450
g     | ███████████████████████ 450
h     | ███████████████████████ 450
i     | ███████████████████████ 450
j     | ███████████████████████ 450
k     | ███████████████████████ 450
l     | ███████████████████████ 450
m     | ███████████████████████ 450
n     | ███████████████████████ 450
o     | ███████████████████████ 450
p     | ███████████████████████ 450
q     | ███████████████████████ 450
r     | ███████████████████████ 450
s     | ███████████████████████ 450
t     | ███████████████████████ 450
u     | ███████████████████████ 450
v     | ███████████████████████ 450
w     | ███████████████████████ 450
x     | ███████████████████████ 450
y     | ███████████████████████ 450
z     | ███████████████████████ 450

## Duplicate Files

Found 555 potential duplicate files.

- Hash: 45a4222926e26f018c0c5e09e681ba7c
  Files: a/A_128 (2).jpg, a/A_128 (3).jpg
- Hash: 45a4222926e26f018c0c5e09e681ba7c
  Files: a/A_128 (2).jpg, a/A_128.jpg
- Hash: 25ee9fb6fa936384cfceb2288cac9d0f
  Files: a/A_129 (2).jpg, a/A_129.jpg
- Hash: d4bf5e2293cab328bc6559a693848166
  Files: a/A_131 (2).jpg, a/A_131.jpg
- Hash: 6a7bcd70e236b4a493b29196b5a69c00
  Files: a/A_134 (2).jpg, a/A_134.jpg
- Hash: b00ed0a2baece4bc9f7e65f2a1c8bdc0
  Files: a/A_142 (2).jpg, a/A_142.jpg
- Hash: 2cceadfa95004f63397afa82fbbc64be
  Files: a/A_156 (2).jpg, a/A_156.jpg
- Hash: e68c77186968cdccb7d580b7fa75973d
  Files: a/A_17 (2).jpg, a/A_17.jpg
- Hash: ac14d378da7e655b113aa715aa3c0250
  Files: a/A_174 (2).jpg, a/A_174.jpg
- Hash: bd855ace572889be110e5e18eb91c5a1
  Files: a/A_197 (2).jpg, a/A_197.jpg

... and 545 more duplicates

## Recommendations

1. **Data Imbalance**: Consider stratified sampling during training
2. **Missing Labels**: Missing: ñ, ng
3. **Duplicates**: Consider removing duplicate files before training
4. **Format Support**: Focus on .jpg formats for extraction
5. **Preprocessing**: Need to extract hand landmarks using MediaPipe Hands

---

**Next Steps:**
1. Run `npm run extract:fsl-kaggle:landmarks` to extract MediaPipe landmarks
2. Run `npm run map:fsl-kaggle:labels` to verify label mapping
3. Run `npm run merge:fsl-datasets` to combine with custom dataset
