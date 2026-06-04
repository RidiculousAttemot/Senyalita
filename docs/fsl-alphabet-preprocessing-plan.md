# FSL Alphabet Preprocessing Plan

This plan prepares the FSL alphabet dataset for future alphabet recognition
training. It does not include word gestures.

## Input Dataset
- Path: datasets/raw/fsl_alphabet/
- Expected labels: a-z, ñ and ng
- ng is one label (not n + g)

## Goal
Prepare alphabet landmark sequences for model training later.

## Preprocessing Steps
- Load JSON files
- Validate frame and landmark structure
- Normalize landmarks
- Convert variable-length sequences to fixed-length tensors
- Pad or truncate sequences
- Encode labels
- Split into train/validation/test sets

## Command
Run the preprocessing script:

```
npm run preprocess:fsl-alphabet
```

Verify processed outputs:

```
npm run verify:processed:fsl-alphabet
```

Summarize processed outputs:

```
npm run summarize:processed:fsl-alphabet
```

## Output Files
Generated in `datasets/processed/fsl_alphabet/`:
- labels.json
- metadata.json
- train.json
- validation.json
- test.json

Processed files are for future model training only. Preprocessing does not
prove recognition accuracy. Verification checks shape consistency and label
mapping only. The summary script is a sanity-check/inspection tool before
model design and still does not measure recognition accuracy.

## Sequence Shape
- Sequence length: 120 frames
- Feature dimension: 126 per frame (2 hands x 21 landmarks x 3 coordinates)

## Suggested Split
- 70% train
- 15% validation
- 15% test

Splitting is stratified by label to ensure every label appears in train,
validation, and test whenever possible. This keeps evaluation coverage
consistent across the alphabet and reduces missing-label splits. This is
still preprocessing only, not model training.

## Reproducibility
- Use a fixed random seed for split generation

## Important Note
- Do not train a model in this step
- Do not train word gestures yet

## Next Document
See the model planning outline in `docs/fsl-alphabet-model-design.md`.
