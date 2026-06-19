# Threats to Validity

## Internal Validity

**Single signer source.** All 3,592 samples in the expanded dataset are derived from the same original signer (S01) via synthetic augmentation. While landmark transformations create visual diversity, they do not capture genuine variation in hand morphology, signing style, and muscle control that exists across different people. The 94.96% average cross-signer accuracy may overestimate real multi-signer performance.

**Augmentation fidelity.** The five virtual signer transforms (rotation, scaling, noise, occlusion, mixed) were chosen to simulate common real-world variations, but they may not accurately reflect the true distribution of landmark variation across the Filipino deaf population. Occlusion (S05) at 89.65% was the hardest case, but real occlusion patterns (e.g., partial hand occlusion, self-occlusion) may differ from the random landmark dropout used.

**Deterministic temporal sampling.** The system samples 30 evenly spaced frames from a 120-frame rolling buffer. This assumes that a sign's distinctive features are uniformly distributed across the recording duration. Signs where critical handshape changes occur in specific temporal windows may be disadvantaged by this sampling strategy.

**Evaluation set composition.** The test set (542 samples) is drawn from the same augmented distribution as the training set. While stratified splitting prevents label imbalance, the test set may not represent the full range of real-world conditions (lighting, backgrounds, camera quality) that the system would encounter in deployment.

## External Validity

**Population generalizability.** The model was trained and evaluated exclusively on landmarks from a single signer's hand morphology. Generalizability to signers with different hand sizes, finger lengths, skin tones, or signing speeds has not been empirically validated. The Filipino Sign Language alphabet contains handshapes that may be articulated differently across age groups and regions.

**Environmental generalizability.** Systematic testing was performed only in controlled lighting conditions (normal room lighting). Results in low-light, bright outdoor, or backlit environments may differ. Camera distance testing was informal and suggests degradation beyond 1.5m.

**Language scope.** The system recognizes only the 26 FSL alphabet handshapes (a–z). It does not recognize words, phrases, non-manual signals (facial expressions, head movements), or the full grammatical structure of Filipino Sign Language. This limits its applicability as a complete communication aid.

**Hardware dependency.** Recognition quality depends on the camera's ability to capture clear hand images at 30 FPS. Lower-quality cameras, unusual camera angles, or cameras with different field-of-view characteristics may reduce landmark detection accuracy.

## Dataset Limitations

**Small original sample.** The original v1 dataset contains only 597 samples (≈21 per label). Per-label metrics on this small set are noisy — with only 3 test samples per label in the v1 split, a single misclassification changes accuracy by over 5%.

**Label imbalance.** While the 70/15/15 split is stratified, the absolute per-label counts (18–22 per split in v2) provide limited statistical power for per-label analysis. Confidence intervals on per-label F1 scores would be wide.

**Collection environment.** All recordings were made in the same room with the same camera at approximately the same distance. Variation in background, lighting, camera position, and signing posture is minimal.

**No temporal label variation.** Each recording contains a single static handshape held for 120 frames. There are no transitions between signs, no coarticulation effects, and no dynamic signs. This does not reflect real conversational signing where handshapes flow continuously.

## Virtual Signer Limitations

**Not real signers.** Virtual signers (S02–S06) are landmark-level mathematical transforms of the original S01 recordings. They do not capture:
- Different hand anatomies (bone structure, finger proportions)
- Different muscle control (tremor, stiffness, flexibility)
- Different signing habits (hand orientation preferences, finger spread tendencies)
- Cultural or regional variation in handshape articulation

**Transform parameter selection.** The specific rotation (±15°), scaling (0.8×–1.2×), noise (σ=0.02), and occlusion (random dropout) parameters were chosen heuristically. The optimal augmentation strategy for this task has not been systematically investigated.

**Transform interaction.** Real-world variation involves simultaneous combinations of rotation, distance, noise, and partial occlusion. The S06 (mixed) transform addresses this partially, but the fixed mixing ratio may not reflect natural variation patterns.

## Future Multi-Signer Collection

To address these validity threats, future work should:

1. **Collect from 10+ actual signers** spanning different ages, hand sizes, and signing experience levels. This is the single most impactful improvement for external validity.
2. **Record in multiple environments** — different rooms, lighting conditions, backgrounds, and camera positions. At least 3 environments with systematic variation in each factor.
3. **Include temporal sign sequences** — instead of isolated held handshapes, record natural signing where one sign transitions to another. This adds ecological validity.
4. **Validate with deaf signers** — conduct a user study with deaf FSL users to evaluate recognition accuracy in real communication contexts.
5. **Measure inter-rater agreement** — have multiple annotators label the same recordings to measure ground-truth reliability.
6. **Report confidence intervals** — on all accuracy and F1 metrics to quantify statistical uncertainty.

## Environmental Constraints

**Camera position.** The system assumes a frontal, head-on view of the signer at 0.5–1.5m distance. Profile views, extreme angles, or distance beyond 2m degrade landmark quality.

**Single hand preference.** The system processes both hands but assigns the primary recognized sign based on the labeled left/right hand mapping. Two-handed signs where both hands contribute different handshapes (common in FSL) may not be accurately captured.

**Frame rate dependency.** The 120-frame buffer corresponds to approximately 4 seconds at 30 FPS. If the camera delivers lower frame rates (e.g., 15 FPS in low light), the temporal window shrinks to 2 seconds, potentially losing temporal context.

**Occlusion sensitivity.** Hand landmarks are not detected when hands are occluded (e.g., behind the head, in pockets, behind objects). The system shows "No hand detected" but does not handle partial occlusion gracefully — any frame with missing landmarks degrades the sequence buffer quality.

**Background clutter.** While MediaPipe is robust to background variation, extreme clutter, highly reflective surfaces, or rapid background motion (e.g., fans, passing people) can produce spurious landmark detections.

## Summary

| Threat Category | Severity | Mitigation |
|---|---|---|
| Single signer source | High | Future multi-signer data collection |
| Virtual signer validity | Medium | Compare with real multi-signer data |
| Environmental variation | Medium | Systematic environmental testing |
| Language scope | Low (by design) | Extend to word-level recognition |
| Small per-label counts | Medium | Expand dataset further |
| Training set similarity to test | Low | Maintain strict stratified split |
| No temporal transitions | Low (by design) | Future continuous signing |
| Camera/hardware dependency | Low | Tested on multiple cameras |
