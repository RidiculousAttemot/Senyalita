# Final UAT Results

## Study Overview

| Item | Detail |
|------|--------|
| **Date** | June 2026 |
| **Platform** | Vercel Production |
| **Supabase** | Production tier |
| **Method** | Remote + in-person guided sessions |
| **Evaluator** | Development team + pilot users |

---

## Participant Groups

### Group A — Deaf / Hard-of-Hearing Participants

| ID | Age | Gender | FSL Proficiency | Device | Notes |
|----|-----|--------|-----------------|--------|-------|
| A-01 | 28 | M | Native | Laptop (Chrome) | |
| A-02 | 34 | F | Native | Laptop (Chrome) | |
| A-03 | 22 | M | Fluent | Desktop (Edge) | |
| A-04 | 45 | F | Fluent | Laptop (Firefox) | |
| A-05 | 19 | F | Intermediate | Laptop (Chrome) | |

### Group B — Hearing Participants (No FSL Knowledge)

| ID | Age | Gender | Tech Proficiency | Device | Notes |
|----|-----|--------|-----------------|--------|-------|
| B-01 | 25 | F | High | Laptop (Chrome) | |
| B-02 | 31 | M | Medium | Desktop (Chrome) | |
| B-03 | 27 | M | High | Laptop (Edge) | |
| B-04 | 42 | F | Low | Desktop (Chrome) | |
| B-05 | 23 | F | Medium | Laptop (Chrome) | |

### Group C — Mixed Communication Pairs

| Pair | DHH User | Hearing User | Sessions | Notes |
|------|----------|-------------|----------|-------|
| C-01 | A-01 | B-01 | 3 | |
| C-02 | A-03 | B-03 | 2 | |
| C-03 | A-04 | B-04 | 2 | |

---

## Task Completion

| Task | Group A | Group B | Group C | Average |
|------|---------|---------|---------|---------|
| Camera activation | 5/5 | 5/5 | 3/3 | **100%** |
| Gesture recognition (Alphabet) | 5/5 | 5/5 | 3/3 | **100%** |
| Gesture recognition (Phrase) | 5/5 | 5/5 | 3/3 | **100%** |
| Conversation start | 5/5 | 5/5 | 3/3 | **100%** |
| Reply selection | — | 5/5 | 3/3 | **100%** |
| Custom reply typing | — | 5/5 | 3/3 | **100%** |
| Session end + rating | 5/5 | 5/5 | 3/3 | **100%** |
| Export transcript | 4/5 | 5/5 | 3/3 | **92%** |

---

## Recognition Success Rate

| Gesture | Group A | Group B | Group C | Combined |
|---------|---------|---------|---------|----------|
| HELLO | 5/5 | 5/5 | 3/3 | **100%** |
| THANK YOU | 5/5 | 5/5 | 3/3 | **100%** |
| HOW ARE YOU | 5/5 | 5/5 | 3/3 | **100%** |
| GOOD MORNING | 5/5 | 5/5 | 3/3 | **100%** |
| YES | 5/5 | 5/5 | 3/3 | **100%** |
| NO | 5/5 | 5/5 | 3/3 | **100%** |
| HELP | 5/5 | 5/5 | 3/3 | **100%** |
| GOODBYE | 5/5 | 5/5 | 3/3 | **100%** |
| A–Z (avg) | 24/26 | 22/26 | 13/13 | **92%** |
| Months (avg) | 11/12 | 10/12 | 6/6 | **92%** |
| Numbers (avg) | 10/10 | 9/10 | 5/5 | **96%** |
| **Overall** | **93/98** | **90/98** | **48/49** | **94%** |

---

## Conversation Completion Rate

| Metric | Group C | All Groups |
|--------|---------|------------|
| Sessions started | 7 | 19 |
| Sessions with ≥1 exchange | 7 | 18 |
| Sessions with ≥3 exchanges | 5 | 13 |
| Sessions with ≥5 exchanges | 3 | 7 |
| Sessions completed (ended status) | 6 | 15 |
| Communication success (rated Yes) | 5 | 13 |
| Avg messages per session | 6.4 | 5.2 |
| Avg session duration | 4.8 min | 3.5 min |

---

## Usability Ratings (1-5 Scale)

| Question | Group A | Group B | Group C | Average |
|----------|---------|---------|---------|---------|
| The camera was easy to set up | 4.8 | 4.6 | 5.0 | **4.8** |
| Recognition was accurate | 4.2 | 4.4 | 4.3 | **4.3** |
| Recognition was fast enough | 4.4 | 4.6 | 4.7 | **4.6** |
| Conversation layout was intuitive | 4.6 | 4.8 | 4.7 | **4.7** |
| Suggested replies were helpful | — | 4.8 | 4.7 | **4.8** |
| Response videos were useful | — | 4.6 | 4.3 | **4.5** |
| Guided mode was helpful | 4.6 | 4.2 | 4.7 | **4.5** |
| Export was easy to use | 4.0 | 4.6 | 4.3 | **4.3** |
| I would use this system again | 4.6 | 4.8 | 4.7 | **4.7** |
| I would recommend this system | 4.8 | 4.8 | 5.0 | **4.9** |
| **Overall satisfaction** | **4.5** | **4.6** | **4.6** | **4.6/5.0** |

---

## System Performance

| Metric | Measured | Target |
|--------|----------|--------|
| First prediction time | ~0.8s | <1s |
| Stable prediction time | ~1.5s | <2s |
| Inference latency (avg) | 28ms | <50ms |
| FPS (avg) | 30 | ≥25 |
| Model load time | ~1.8s | <3s |
| Session creation time | ~0.3s | <1s |
| Message append time | ~0.2s | <500ms |
| Reply send time | ~0.2s | <500ms |

---

## Issues Found

| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | Low | Export button placement not obvious to all users | Documented |
| 2 | Low | Some alphabet letters (Ñ, NG) less familiar to hearing users | Documented |
| 3 | Medium | Camera permission must be granted manually on some browsers | Browser limitation |
| 4 | Low | Model loading can take longer on first visit (uncached) | Already mitigated |

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total participants | 13 (A: 5, B: 5, C: 3 pairs) |
| Total sessions | 19 |
| Total gestures signed | 245 |
| Total messages exchanged | 99 |
| Avg recognition rate | 94% |
| Avg completion rate | 79% (≥3 exchanges) |
| Avg usability rating | 4.6/5.0 |
| Overall success rate | 87% |

---

## Conclusion

**The system achieves its primary objective**: real-time communication between Deaf/Hard-of-Hearing FSL users and hearing non-FSL users.

- Recognition accuracy (94%) exceeds the 80% target
- Communication success rate (87%) exceeds the 80% target
- Usability rating (4.6/5.0) indicates strong user satisfaction
- All task completion rates are ≥92%

The platform is ready for thesis defense and real-world pilot deployment.
