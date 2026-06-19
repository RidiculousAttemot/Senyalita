# FSL Alphabet Dataset Collection

Goal: Collect Filipino Sign Language (FSL) alphabet samples before any word-gesture training.

## Scope
- We are collecting the FSL alphabet labels first: a-z.
- Do not train word gestures yet.
- Recognition accuracy requires a trained model later.

## Folder Layout
Save exported JSON files here:

```
datasets/raw/fsl_alphabet/<label>/
```

Example:
```
datasets/raw/fsl_alphabet/a/signlangvisual_a_123456.json
```

## Collection Targets
- Pilot: at least 3 samples per label.
- Training: 10-20 samples per label (later).

## How to Capture
1. Open http://localhost:3000/camera.
2. Use the dataset capture panel to record a label (a-z).
3. Export JSON after recording.
4. Move the exported JSON into the matching label folder.

## Validation
Use the dataset validator to check structure and coverage only:

```
npm run validate:dataset
```

Strict mode fails if labels are missing or below 3 samples:

```
npm run validate:dataset:strict
```

The validator reports:
- Sample count per label (JSON files)
- Total frames and average frames per sample
- Missing labels and labels below 3 samples

## 20-Sample Milestone Complete
All 26 alphabet labels (a-z) have at least 20 samples. The dataset is ready to
begin preprocessing for FSL alphabet recognition. This milestone confirms
coverage and structure only; recognition accuracy still requires model training.
