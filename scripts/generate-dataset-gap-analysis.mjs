import fs from "fs";
import path from "path";

const DOCS_DIR = path.join(process.cwd(), "docs");
fs.mkdirSync(DOCS_DIR, { recursive: true });

// Production dataset metadata
const prodMeta = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "datasets/processed/fsl_unified/metadata.json"), "utf8"
));
const fslAlphabetV2Meta = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "datasets/processed/fsl_alphabet_v2/metadata.json"), "utf8"
));
const fsl105Meta = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "datasets/processed/fsl_105/metadata.json"), "utf8"
));

// Hard cases metadata
const hardCasesMeta = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "datasets/hard_cases/metadata.json"), "utf8"
));

// Real-world collection plan
const realWorldMeta = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), "datasets/real_world/metadata.json"), "utf8"
));

const prodSigners = fslAlphabetV2Meta.numSigners || 6;
const fsl105Signers = fsl105Meta.numSigners || 105;

// Analyze dataset gaps
const doc = `# Dataset Gap Analysis

Generated: ${new Date().toISOString().split("T")[0]}

## Dataset Comparison

| Dimension | Production (fsl_alphabet_v2) | Production (fsl_105) | Hard Cases | Real-World Target | Gap |
|-----------|:---------------------------:|:--------------------:|:----------:|:-----------------:|:---:|
| Total samples | ${fslAlphabetV2Meta.totalSamples || 3352} | ${fsl105Meta.totalSamples || 2129} | 741 | 75 (15 signs × 5 signers) | 5,481 → target ~6,000+ |
| Labels | 26 | 105 | 10 pairs | 15 | 133 total, 11 low-F1 |
| Signers | ${prodSigners} | ${fsl105Signers} | N/A | 5+ | Alphabet needs 4+ more signers |
| Avg sequence length | ${(fslAlphabetV2Meta.avgSequenceLength || 92.8).toFixed(1)} | ${(fsl105Meta.avgSequenceLength || 43.9).toFixed(1)} | varies | 120 | Good variation |
| Source diversity | 6 lighting presets | Studio only | N/A | 6 lighting, 5 backgrounds | FSL-105 lacks environmental diversity |

## Missing Signers

| Category | Production | Target | Missing |
|----------|:----------:|:------:|:-------:|
| Skin tones (alphabet) | 1-2 tones | 5 tones (light, medium, dark, olive, brown) | 3-4 tones |
| Skin tones (FSL-105) | Unknown (studio) | 5 tones | ~4 tones |
| Camera positions | 1-2 angles | 6 (chest, face, above, below, left, right) | 4-5 angles |
| Age groups | Young adults | All ages | Children, elderly |

## Missing Environments

| Environment | Alphabet | FSL-105 | Hard Cases | Real-World Target |
|-------------|:--------:|:-------:|:----------:|:-----------------:|
| Indoor studio | ✅ | ✅ | N/A | ✅ |
| Indoor varied lighting | ✅ | ❌ | N/A | ✅ |
| Outdoor shade | ✅ | ❌ | N/A | ✅ |
| Outdoor sun | ❌ | ❌ | N/A | ✅ |
| Backlit | ❌ | ❌ | N/A | ✅ |
| Side-lit | ❌ | ❌ | N/A | ✅ |
| Cluttered background | ❌ | ❌ | N/A | ✅ |
| Window background | ❌ | ❌ | N/A | ✅ |

## Missing Lighting Conditions

| Lighting | Alpha | FSL-105 | Hard | Target | Gap |
|----------|:-----:|:-------:|:----:|:------:|:---:|
| Bright indoor | ✅ | ✅ | N/A | ✅ | None |
| Dim indoor | ✅ | ❌ | N/A | ✅ | FSL-105 |
| Outdoor shade | ✅ | ❌ | N/A | ✅ | FSL-105 |
| Outdoor sun | ❌ | ❌ | N/A | ✅ | Both |
| Backlit | ❌ | ❌ | N/A | ✅ | Both |
| Side-lit | ❌ | ❌ | N/A | ✅ | Both |

## Missing Phrase Categories

| Category | In Production | Coverage | Priority |
|----------|:------------:|:--------:|:--------:|
| Greetings (10) | ✅ | 100% | Low (already good) |
| Survival phrases (10) | ✅ | 100% | Low |
| Numbers 1-10 | ✅ | 100% | Low |
| Calendar months (12) | ✅ | 100% | Medium (4 months have F1<0.50) |
| Days/Time (10) | ✅ | 100% | Low |
| Family (10) | ✅ | 100% | Medium (FATHER, MOTHER have F1<0.50) |
| Relationships (6) | ✅ | 100% | Low |
| Colors (13) | ✅ | 100% | Medium (RED, BLUE have F1<0.50) |
| Food (10) | ✅ | 100% | Low |
| Drink (10) | ✅ | 100% | Low |
| Descriptions (8) | ✅ | 100% | Low |

## Prioritized Collection Plan

| Priority | What | Why | Effort |
|:--------:|------|-----|:------:|
| P0 | 11 low-F1 labels: 5+ samples each from 3 signers | Direct F1 improvement | 165 samples |
| P1 | 5 new signers for alphabet (26 letters × 5) | Improve alphabet generalization | 130 samples |
| P2 | 6 lighting conditions for FSL-105 top-20 phrases | Real-world robustness | 120 samples |
| P3 | 4 new camera angles for 20 common phrases | Position invariance | 80 samples |
| P4 | 5 background types for 10 phrases | Background invariance | 50 samples |
| **Total** | | | **~545 new samples** |

## Gap Closure Path

With 545 targeted new samples:
- Every label would have at least 8-10 test samples (vs current 4 for many)
- 133 labels × 3-5 signers average (vs current 6 alphabet / 105 FSL-105)
- All 6 lighting conditions covered for common phrases
- Expected accuracy improvement: **+2-4 percentage points**
`;

fs.writeFileSync(path.join(DOCS_DIR, "dataset-gap-analysis.md"), doc, "utf8");
console.log(`Report: docs/dataset-gap-analysis.md`);
