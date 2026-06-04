# FSL Alphabet Model Design

This document outlines model architecture planning for FSL alphabet recognition
only. No models are implemented or trained here.

## Dataset Summary
- Labels: a-z, ñ, ng (28 total)
- Total samples: 597
- Sequence length: 120 frames
- Feature dimension: 126 (2 hands x 21 landmarks x 3 coordinates)
- Split strategy: stratified-by-label (train 427 / validation 85 / test 85)
- Feature values: min -1.0000, max 1.0000, average -0.058404
- All-zero frames: 33,129

## Label Set
a b c d e f g h i j k l m n ñ ng o p q r s t u v w x y z

## Input/Output Shapes
- Input tensor shape: [sequenceLength, featureDimension] = [120, 126]
- Output class count: 28

## Candidate Model Approaches (No Implementation Yet)
1. Baseline MLP
   - Flatten [120, 126] into a single vector
   - Simple fully-connected layers to validate the pipeline

2. 1D CNN over time
   - Convolution along the time axis
   - Captures local temporal patterns in landmark sequences

3. LSTM / BiLSTM
   - Sequence model over landmark frames
   - Captures longer temporal dependencies

4. CNN-LSTM hybrid
   - 1D CNN for temporal feature extraction
   - LSTM for sequence modeling

5. Lightweight model for browser deployment (later)
   - Smaller parameter count
   - Target low-latency inference after accuracy is acceptable

## Staged Training Approach
Stage 1: Baseline
- Train a simple MLP to validate data pipeline and label mapping
- Verify training loop, metrics, and data splits

Stage 2: Sequence model
- Train LSTM or BiLSTM on landmark sequences
- Evaluate temporal performance gains

Stage 3: Hybrid architecture
- Try CNN-LSTM or improved temporal models if needed
- Compare with Stage 2 metrics

Stage 4: Export and deployment planning
- Plan export and optimization only after acceptable accuracy

## Evaluation Metrics
- Accuracy
- Per-label precision, recall, and F1
- Confusion matrix
- Validation loss/accuracy curves
- Test accuracy

## Success Criteria
- Baseline proves the training pipeline works end-to-end
- Target accuracy can be set after first experiments
- No word-gesture training until alphabet recognition is evaluated

## Risks and Notes
- Dataset size may be small for robust real-world recognition
- Limited signer/device/background variation may cause overfitting
- Data augmentation or more samples may be needed
- ñ and ng must remain separate labels

## Do Not Do Yet
- Do not integrate a live model into the camera page
- Do not add TensorFlow.js inference yet
- Do not train word gestures yet
- Do not add backend/auth/admin
