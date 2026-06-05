# Thesis Defense Q&A

---

## Q1: Why MediaPipe for hand tracking instead of a custom model?

**Answer:** MediaPipe Hands was chosen because it provides production-quality 21-point hand landmark detection at 30 FPS in the browser, requiring no GPU, no backend server, and no pre-processing pipeline. It is a well-established, open-source solution with extensive cross-platform support. Building a custom hand-tracking model would have required a large annotated dataset (tens of thousands of labeled hand images), substantial compute for training, and would not have improved recognition accuracy — the landmark representation already captures all the spatial information needed for handshape classification. By using MediaPipe, we could focus our research effort on the sequence classification problem rather than re-solving hand detection.

---

## Q2: Why landmarks instead of raw RGB video?

**Answer:** Landmarks offer three decisive advantages over raw RGB video:

1. **Dimensionality reduction.** Each frame is compressed from ~921,600 values (640×480 RGB) to 126 values (21 landmarks × 2 hands × 3 coordinates) — a 7,300× reduction. This makes real-time inference feasible in the browser without a GPU.

2. **Invariance to appearance.** Landmarks are invariant to skin tone, clothing, background, lighting color, and camera quality. An RGB-based model would need to generalize across all these factors, requiring a much larger and more diverse training dataset.

3. **Privacy preservation.** Landmark coordinates are numerical data that cannot be reverse-engineered to reconstruct the original video frame. This is important for a publicly deployable system where users may be concerned about camera data being stored or transmitted.

The trade-off is that landmarks discard some information (e.g., finger texture, nail position, wrist rotation), but our results show this loss is acceptable — 98.15% test accuracy demonstrates that the 126-dimensional landmark space is sufficient for FSL alphabet recognition.

---

## Q3: Why BiLSTM rather than a Transformer or CNN?

**Answer:** We selected BiLSTM over Transformer or pure CNN architectures for three reasons:

1. **Appropriate for the data scale.** With 3,592 training samples, a BiLSTM (42,780 parameters) is appropriately sized. Transformers typically require hundreds of thousands to millions of samples to outperform recurrent models. A Transformer on this dataset would likely overfit severely.

2. **Bidirectional temporal context.** FSL handshapes are static poses held over time, but the model must disambiguate subtle handshape differences. Bidirectional processing allows the model to use both past and future frame context to make each prediction — important for distinguishing confusable pairs like u and v where the key difference is finger separation in the middle of the sequence.

3. **Proven baseline in gesture recognition.** BiLSTMs are well-established for skeleton-based action recognition (e.g., ST-GCN, Lie Group approaches). Our results confirm that the BiLSTM achieves 98.15% test accuracy with minimal overfitting (0.61% train-test gap), suggesting the architecture is well-matched to the problem.

---

## Q4: Why did CNN-LSTM perform worse than the simpler LSTM?

**Answer:** CNN-LSTM achieved only 61.18% test accuracy — the worst of all models — despite having more parameters than the forward LSTM. This counterintuitive result has three explanations:

1. **Conv1D is not well-suited for sparse landmark data.** Our landmark representation has 126 dimensions per frame, with many coordinates at or near zero (especially for the non-dominant hand and occluded landmarks). 1D convolutional filters are designed to detect local patterns in dense sequential data (e.g., audio spectrograms, sensor readings). On sparse landmark data, the convolution operation dilutes rather than enhances the discriminative signal.

2. **Full 120-frame input introduced noise.** CNN-LSTM was the only model that used all 120 frames directly. The other models used 30-frame temporal sampling, which acts as a form of temporal denoising — skipping redundant frames and focusing on the most informative time steps. The conv layers could not compensate for the additional frame-to-frame noise.

3. **Small dataset could not support extra parameters.** CNN-LSTM has 24K parameters trained on the same 597 samples as the LSTM (21K params) and BiLSTM (43K params). The conv layers added capacity without adding discriminative power, leading to the worst accuracy despite a moderate parameter count. This model might benefit from a larger dataset but was not viable at this stage.

---

## Q5: Why deploy with TensorFlow.js instead of ONNX, WebAssembly, or a native app?

**Answer:** TensorFlow.js was chosen for three practical reasons:

1. **Seamless integration with the existing training pipeline.** All models were trained using the same JavaScript/TensorFlow.js stack used in the browser. The export process is trivial — serialize model topology and weights — with no format conversion, no compatibility testing, and no accuracy validation between training and deployment.

2. **WebGL backend acceleration.** TF.js uses WebGL shaders to run inference on the GPU, achieving 13.57 ms average inference time (73.7 FPS estimated). This is well within the 200 ms budget and matches or exceeds the performance of ONNX Runtime Web or WebAssembly-based solutions for this model size (42K parameters).

3. **No build step or native code.** TF.js runs entirely in the browser with no server-side processing, no native modules, and no app store deployment. The system is accessible by opening a URL — critical for a thesis demonstration and for future user studies where participants may use their own devices.

---

## Q6: Why alphabet-only recognition? Why not word-level or full FSL?

**Answer:** The alphabet-only scope was a deliberate research design choice for three reasons:

1. **Foundational building block.** The FSL alphabet (28 handshapes) is the standard entry point for sign language recognition research. Individual letters are the atomic units of fingerspelling, which itself is an essential component of FSL — used for proper names, technical terms, and words without established signs. Demonstrating alphabet recognition at 98.15% accuracy establishes that the landmark-based approach works before tackling harder problems.

2. **Feasibility within thesis scope.** Word-level recognition requires handling dynamic signs (motion trajectories), non-manual signals (facial expressions, head movements), and a much larger vocabulary. This is an order of magnitude more complex and would have made the project scope unmanageable within thesis time constraints.

3. **Clean evaluation metric.** Alphabet recognition has a unambiguous ground truth — the signer intends a specific letter, and classification is either correct or incorrect. Word-level recognition introduces segmentation ambiguity (where does one sign end and another begin?), coarticulation effects, and grammatical context, making clean evaluation much harder.

---

## Q7: Why does 98.15% test accuracy matter?

**Answer:** 98.15% test accuracy is significant for three reasons:

1. **It exceeds the usability threshold.** Prior work in sign language alphabet recognition suggests that accuracy above 95% is sufficient for practical communication aids. At 98.15%, the system makes fewer than 2 errors per 100 predictions, which means a user would need to sign approximately 50 letters before encountering a single mistake. This is qualitatively different from the 69–71% accuracy of our earlier models, where nearly 1 in 3 predictions was wrong.

2. **It demonstrates the impact of dataset expansion.** The jump from 71.76% (v1, 597 samples) to 98.15% (v2, 3,592 samples) with the same architecture is a clean ablation of dataset size. This 26.39% improvement quantifies the importance of data diversity for landmark-based sign language recognition — our primary research finding.

3. **It is competitive with state-of-the-art.** Comparable landmark-based sign language alphabet recognition systems using MediaPipe + LSTM architectures report 90–97% accuracy on similar datasets (e.g., American Sign Language alphabet). Our 98.15% is at or above this range, suggesting the approach is not just viable but potentially state-of-the-art for this specific task.

---

## Q8: What are the current limitations?

**Answer:** The system has five key limitations:

1. **Single signer source.** Despite data augmentation, all training data derives from one person. We do not know how well the model generalizes to signers with different hand morphology, signing styles, or skin tones. The 94.96% cross-signer average on virtual signers is promising but not a substitute for real multi-signer validation.

2. **Static handshapes only.** The model classifies individual static handshapes held for ~4 seconds. It does not handle dynamic transitions between signs, coarticulation effects, or continuous signing. Real FSL involves fluid motion where handshapes change without pausing.

3. **Confusable label cluster.** Three labels (u, v, r) account for all 10 test errors. These handshapes differ only in subtle finger positioning (index alone vs. index+middle vs. crossed fingers). This is an inherent ambiguity in the landmark representation that may require higher-resolution hand tracking or additional data to resolve.

4. **No word-level or sentence-level understanding.** The system recognizes individual letters, not words, phrases, or grammatical structures. It cannot distinguish context-dependent meanings, handle non-manual signals, or recognize classifier constructions.

5. **Environmental sensitivity.** Recognition degrades in low light, at distances beyond 1.5m, and when hands partially exit the frame. The 120-frame buffer (~4 seconds) requires the signer to hold each position steadily, which may not feel natural.

---

## Q9: What is the most important future work?

**Answer:** The most important future work is collecting and evaluating on data from **actual multi-signer recordings** — multiple deaf FSL users with diverse hand morphologies, signing speeds, and articulation preferences. This is the single largest validity gap in the current study. Virtual signers are useful for development but cannot substitute for real human variation.

Additional high-priority future work includes:

1. **Dynamic sign recognition** — extending from isolated handshapes to continuous fingerspelling with automatic segmentation.
2. **Word-level vocabulary** — adding a set of common FSL word gestures (e.g., greetings, family terms, time expressions).
3. **Confidence-based rejection** — implementing the 0.60 threshold filtering in the UI so that low-confidence predictions do not clutter the transcript.
4. **User study with deaf participants** — evaluating accuracy, usability, and satisfaction with the target user population.
5. **Environmental robustness testing** — systematic evaluation across 5+ lighting conditions, 3 backgrounds, and 2 camera types.
