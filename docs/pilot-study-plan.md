# Pilot Study Plan — Phase 33

## Overview

This pilot study evaluates SignLangVisual with real end-users to validate the system's readiness for broader deployment. The study targets three user groups across three scenarios, measuring accuracy, usability, and communication effectiveness.

## Participants

### Recruitment Targets

| Group | Description | Target N | Recruitment Channel |
|-------|-------------|:--------:|---------------------|
| Deaf users | Native/fluent FSL signers | 10 | Deaf community organizations, social media |
| Hard-of-hearing users | Use FSL as primary/secondary language | 10 | Hearing loss associations, audiology clinics |
| Hearing users | Learning FSL or no prior experience | 10 | University language departments, general public |

### Inclusion Criteria

- Age 18+
- No severe visual impairment that prevents hand gesture recognition
- Willing to use a webcam for gesture capture
- Deaf/HoH participants: self-identified as Deaf or hard-of-hearing
- Hearing participants: any hearing ability

### Exclusion Criteria

- Known photosensitive epilepsy
- Unable to provide informed consent

## Consent Process

1. **Pre-Study Information Sheet**: Participants receive a document explaining the study purpose, data collected, privacy protections, and their rights.
2. **Informed Consent Form**: Digital consent collected before any data collection begins.
3. **Data Privacy**:
   - Video data is processed client-side and never stored
   - Only landmark coordinates are stored (no raw video/images)
   - Participants can request data deletion at any time
   - All data anonymized with participant IDs
4. **Withdrawal**: Participants can withdraw at any time without consequence.

## Scenarios

### Scenario 1: Translation

**Objective**: Measure gesture-to-text translation accuracy

**Task**: Participants perform 20 predefined FSL gestures (drawn from the full 133-class set, balanced across alphabet and phrases). The system displays the recognized text.

**Metrics**:
- Per-gesture accuracy
- Top-1 and Top-3 accuracy
- Confidence distribution
- Recognition latency (ms)
- User satisfaction rating (1-5)

**Duration**: ~15 minutes per participant

### Scenario 2: Conversation

**Objective**: Evaluate real-time communication support

**Task**: Participants have a 5-minute semi-structured conversation using the system. A hearing non-signer responds via text-to-speech or typed reply.

**Metrics**:
- Conversation success rate (goal achieved?)
- Messages per conversation
- Average confidence per message
- User-reported communication ease (1-5 scale)
- Number of corrections needed

**Duration**: ~20 minutes per participant

### Scenario 3: Learning

**Objective**: Assess the system's value as a learning tool

**Task**: Participants learn 5 new FSL gestures using the system's feedback, then demonstrate them.

**Metrics**:
- Learning curve (accuracy over attempts)
- Time to mastery (correct gesture on 3 consecutive attempts)
- Retention rate after 24 hours
- Self-reported confidence gain (1-5)

**Duration**: ~25 minutes per participant (including 24h follow-up)

## Metrics Dashboard

| Category | Metric | Measurement Method | Target |
|----------|--------|-------------------|--------|
| **Accuracy** | Top-1 accuracy | Gesture recognition vs ground truth | > 85% |
| | Top-3 accuracy | Gesture in top 3 predictions | > 95% |
| | Per-class F1 | Per-gesture precision/recall | > 0.70 |
| **Performance** | Recognition latency | End-to-end inference time | < 200ms |
| | Frame processing rate | FPS during active recognition | > 20 FPS |
| | Model load time | Time to ready state | < 3s |
| **Usability** | System Usability Scale (SUS) | Post-study questionnaire | > 68 |
| | Task completion rate | % of tasks completed | > 90% |
| | Error recovery time | Seconds to recover from misrecognition | < 10s |
| **Communication** | Conversation success | Goal achievement rating | > 80% |
| | Message clarity | Self-reported (1-5) | > 4.0 |
| | Correction frequency | Corrections per conversation | < 3 |
| **Learning** | Gesture acquisition | New gestures learned per session | > 4/5 |
| | Retention | 24-hour retention rate | > 80% |
| | Time to proficiency | Minutes to consistent accuracy | < 10 min |

## Study Protocol

### Session Flow

1. **Welcome & Consent** (5 min)
   - Explain study purpose
   - Review and sign consent form
   - Assign participant ID

2. **Pre-Study Questionnaire** (5 min)
   - Demographics (age range, signing experience, handedness)
   - Technology comfort level (1-5)
   - Expectations for sign language recognition

3. **System Setup** (3 min)
   - Configure webcam and lighting
   - Test hand tracking initialization
   - Brief tutorial on system interaction

4. **Scenario 1: Translation** (15 min)
   - Perform 20 predefined gestures
   - Record accuracy, confidence, latency
   - Collect per-gesture satisfaction

5. **Scenario 2: Conversation** (20 min)
   - Semi-structured conversation with researcher
   - Topics: introductions, ordering food, asking for directions
   - Record conversation metrics

6. **Scenario 3: Learning** (25 min)
   - Learn 5 new gestures with system feedback
   - Practice until consistent accuracy
   - Schedule 24-hour follow-up for retention test

7. **Post-Study Questionnaire** (10 min)
   - System Usability Scale (SUS)
   - Open-ended feedback (what worked, what didn't)
   - Feature requests
   - Willingness to use again

8. **Debrief** (2 min)
   - Thank participant
   - Explain next steps for retention test

**Total time**: ~65 minutes (+ 5 min for 24h retention)

## Success Criteria

### Go/No-Go Decision

| Criterion | Go (proceed to Phase 34) | No-Go (iterate) |
|-----------|-------------------------|-----------------|
| Translation accuracy | > 85% | < 80% |
| Deaf user satisfaction | > 4.0/5.0 | < 3.5/5.0 |
| SUS score | > 68 | < 60 |
| Conversation success | > 80% of goals met | < 60% |
| Learning retention | > 80% at 24h | < 60% |
| Correction rate | < 5% per scenario | > 10% |

### Minimum Viable Success

The pilot is considered successful if:
1. At least 15 out of 30 participants complete all scenarios
2. Average Translation accuracy >= 80%
3. Average SUS score >= 65
4. No critical system failures (crashes, data loss)
5. At least 10 positive qualitative feedback comments

## Data Analysis Plan

### Quantitative
- Per-group accuracy comparison (Deaf vs HoH vs Hearing)
- Per-class error analysis
- Confidence-calibration analysis (does confidence correlate with accuracy?)
- Learning curve modeling
- SUS score benchmarking

### Qualitative
- Thematic analysis of open-ended feedback
- Common failure mode identification
- Feature request prioritization

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Low recruitment | Extend recruitment period, offer incentives, partner with organizations |
| Technical failures | Have backup hardware, pre-test system before each session |
| Participant no-show | Over-recruit by 20%, flexible scheduling |
| Poor lighting/background | Provide guidance for optimal setup, test camera before starting |
| Privacy concerns | Emphasize client-side processing, no video stored, data anonymization |
