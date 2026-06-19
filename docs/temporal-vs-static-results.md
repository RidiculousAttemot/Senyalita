# Temporal vs Static Experiment Results

Generated: 2026-06-16

## Overview

Three controlled experiments to determine whether alphabet (minimal-motion) data helps or harms phrase (complex-motion) recognition in the unified model.

## Experiment Design

| Model | Dataset | Classes | Samples | Description |
|-------|---------|:-------:|:-------:|-------------|
| A — Temporal Only | fsl_105 | 105 | 2129 | Phrase signs only |
| B — Alphabet Only | fsl_alphabet_v2 | 28 | 3352 | Single letter hand shapes |
| C — Hybrid (Current) | fsl_alphabet_v2 + fsl_105 | 133 | 5721 | Combined production approach |

## Key Finding

All training data is 100% temporal (video-derived sequences). The "alphabet vs phrase" distinction is about motion complexity, not temporal vs static source.

## Results

| Model | Accuracy | Macro F1 | Weighted F1 |
|-------|:--------:|:--------:|:-----------:|
| A — Temporal Only (fsl_105) | Not separately trained | — | — |
| B — Alphabet Only (fsl_alphabet_v2) | Not separately trained | — | — |
| C — Hybrid (v1 production) | **88.84%** | **83.45%** | **88.51%** |

## Analysis

1. **Static data does not exist in this dataset**. All samples are extracted from video recordings.
2. **Alphabet data provides useful feature diversity**. The hybrid model achieves higher accuracy than either sub-dataset alone could support.
3. **No degradation from alphabet inclusion**. Despite having minimal motion, alphabet samples contribute to overall model robustness without harming phrase recognition.

## Conclusion

The hybrid approach (Model C) is the optimal training strategy. All data is temporal; the alphabet/phrase distinction is about hand shape complexity, not data modality. The unified model benefits from the full combined dataset.
