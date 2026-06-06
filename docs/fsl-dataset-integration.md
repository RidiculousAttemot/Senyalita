# FSL (Filipino Sign Language) Dataset Integration

This document explains how to integrate the Kaggle FSL dataset with your training pipeline.

## Dataset Source

- **Kaggle Dataset:** `japorton/fsl-dataset`
- **Download Tool:** kagglehub Python library
- **Reference:** [Kaggle FSL Dataset](https://www.kaggle.com/datasets/japorton/fsl-dataset)

## Setup Instructions

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- `numpy` - Numerical computing
- `scikit-learn` - Machine learning models
- `joblib` - Model serialization
- `kagglehub` - Kaggle dataset download API

### 2. Configure Kaggle Authentication

Option A: Interactive configuration
```bash
kaggle configure
```

Option B: Set environment variables
```bash
# Windows PowerShell
$env:KAGGLE_USERNAME = "your-username"
$env:KAGGLE_KEY = "your-api-key"

# Linux/Mac
export KAGGLE_USERNAME="your-username"
export KAGGLE_KEY="your-api-key"
```

To get your API key:
1. Go to https://www.kaggle.com/settings/account
2. Click "Create new API token"
3. Save the downloaded `kaggle.json` file

### 3. Download FSL Dataset

```bash
npm run download:fsl-dataset
```

This will:
- Download the FSL dataset from Kaggle
- Cache it locally (typically in `~/.cache/kagglehub/`)
- Create a symlink at `datasets/fsl-kaggle/` (if OS supports it)
- Generate metadata file: `datasets/fsl-kaggle-metadata.json`

## Current Training Pipeline

### Your Custom FSL Alphabet Dataset

**Status:** ✅ Complete (597 samples, 28 labels)

- **Collection:** Real-time camera capture via browser
- **Format:** MediaPipe hand landmarks (120 frames × 126 features)
- **Split:** Train 427 / Validation 85 / Test 85
- **Preprocessing:** `npm run preprocess:fsl-alphabet`
- **Training:** `npm run train:fsl-alphabet:baseline` (69.41% test accuracy)

### Next: Integrate Kaggle FSL Dataset

**To use the Kaggle dataset:**

1. Download it: `npm run download:fsl-dataset`
2. Create a preprocessing script to extract landmarks
3. Combine with your existing data or run separate experiment

## File Structure

```
datasets/
├── raw/
│   └── fsl_alphabet/  (Your collected data)
├── processed/
│   └── fsl_alphabet/  (Preprocessed tensors)
├── fsl-kaggle/  (Symlink to Kaggle download)
└── fsl-kaggle-metadata.json  (Download metadata)

models/
└── fsl_alphabet/
    └── baseline/  (Baseline MLP results)
```

## Next Steps

1. **Explore Kaggle dataset:** Check structure and format in `datasets/fsl-kaggle/`
2. **Create extraction script:** Process Kaggle data into same format as your alphabet data
3. **Merge datasets:** Combine for larger training set or run comparative experiments
4. **Train on combined data:** Update preprocessing to include both sources
5. **Evaluate improvements:** Compare baseline vs. combined dataset performance

## Troubleshooting

### Error: "Dataset not found"
- Check Kaggle credentials: `kaggle datasets list | grep fsl`
- Verify dataset still exists on Kaggle

### Error: "Kagglehub not installed"
```bash
pip install kagglehub --upgrade
```

### Error: "Authentication failed"
- Regenerate API key on Kaggle
- Ensure kaggle.json is in `~/.kaggle/kaggle.json`

### Symlink not created (Windows)
- Use Direct Path: `datasets\fsl-kaggle\` → extracted location
- Or copy files manually from Kaggle cache directory

## Performance Baseline

**Current FSL Alphabet Baseline (MLP):**
- Training data: 427 samples (your collected)
- Test accuracy: 69.41%
- Validation accuracy: 70.59%

**Next: Test with Kaggle dataset** → Expected improvement with more data
