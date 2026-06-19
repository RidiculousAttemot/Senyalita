# User Acceptance Testing (UAT) Plan

**Project:** SignLangVisual
**Test window:** 2026-06-08 – 2026-06-14
**Mode:** Supervised, in-person at the campus usability lab
**Author:** Thesis author + supervising faculty

## 1. Objectives

1. Confirm that the **end-to-end translation flow** (camera → recognition →
   reference video → suggested reply → response video) works as documented
   for both deaf and hearing users.
2. Validate that the **admin moderation workflow** (gesture approve / reject /
   archive) is usable by faculty evaluators without developer assistance.
3. Collect quantitative **satisfaction metrics** for the thesis evaluation
   chapter.

## 2. Participants

| Group | Size | Recruitment | Tech profile |
| --- | ---: | --- | --- |
| **Deaf users** (target end-users) | 5 | Partner school for the deaf, voluntary | Varied — at least one novice with no prior sign-recognition app experience |
| **Hearing users** (control group) | 5 | University student body | Mixed — at least one experienced with sign language, one novice |
| **Faculty evaluators** | 3 | Sign-language department | Senior, expert in FSL / ASL |

Total: **13 participants** — matches the typical sample size for a
thesis-defence usability study.

## 3. Test environment

| Item | Spec |
| --- | --- |
| Hardware | Lab laptop (i5 / 8 GB / 1080p webcam) |
| Network | Wired, ~50 Mbps down, ~20 Mbps up |
| Browser | Chrome 125+ (latest stable) |
| Lighting | Diffuse overhead + side fill, no direct sunlight on the signer |
| Signer distance | 1.0 – 1.5 m from camera |
| Background | Plain wall (avoids MediaPipe false positives) |
| Account | Pre-provisioned per participant (auto-confirmed email) |
| Pre-test model | BiLSTM v2, 98.15% test accuracy, deployed on `localhost:3000` (or staging URL) |

## 4. Tasks

Each participant performs the following **5 core tasks**, plus 2
**admin tasks** for the faculty group.

| # | Task | Group |
| --- | --- | --- |
| T1 | **Translate a single-letter sign** — sign one letter, observe the running transcript update, then clear the transcript. | All |
| T2 | **Select a suggested reply** — sign `HELLO`, click one of the suggested replies (e.g. "Hi there."), confirm it appears in the transcript. | All |
| T3 | **Watch a reply video** — for a gesture with a custom response video (e.g. `THANK YOU` → "You're welcome."), tap the reply and watch the modal play. | All |
| T4 | **View history** — open `/history`, find the session they just recorded, expand it, and confirm at least one log line is visible. | All |
| T5 | **Submit feedback** — after T1, use the new "Was this recognition correct?" widget to mark the recognition as correct. | All |
| A1 | **Approve a gesture** — sign in as admin, open `/admin/gestures`, find a draft gesture, click **Approve**, confirm the status pill changes. | Faculty only |
| A2 | **Review the analytics dashboard** — open `/admin/analytics`, name 3 of the metric cards. | Faculty only |

## 5. Metrics

### 5.1 Quantitative

| Metric | How measured | Pass bar |
| --- | --- | --- |
| Task completion rate | Successful / attempted per task | ≥ 80% per task |
| Time-on-task | Stopwatch, T1 – T4 | T1 ≤ 30 s, T2 ≤ 20 s, T3 ≤ 20 s, T4 ≤ 30 s |
| Recognition satisfaction | "Was the predicted sign correct?" widget (% correct) | ≥ 90% on the 26 alphabet signs |
| Response usefulness | Likert 1 – 5 on "Did the suggested reply help you communicate?" | mean ≥ 3.5 |
| Admin task accuracy | A1 / A2 success without help | ≥ 2 of 3 faculty members |

### 5.2 Qualitative

Free-form interview after the tasks, recorded with consent. Themes to
probe:

- **Trust** in the prediction (does the user believe the sign before
  confirmation?)
- **Pacing** (does the auto-clear of the running transcript feel right?)
- **Visual design** (is the camera + reference-video layout intuitive?)
- **Accessibility** (colour contrast, captions, screen-reader hints)
- **Improvements** (open-ended "what would you change?")

### 5.3 System metrics (collected automatically)

- Inference latency p50 / p95
- FPS during each task
- Number of `feedback` rows written per participant
- Number of `translation_logs` rows written per participant
- Number of `translation_sessions` written per participant

## 6. Procedure

1. **Setup (5 min):** researcher explains the study, obtains consent,
   creates the participant's account via `promote_user()` (or signs them
   in with a pre-provisioned account).
2. **Warm-up (5 min):** participant explores the app freely, no
   recorded metrics. Researcher answers "how do I…" questions.
3. **Tasks (15 min):** researcher hands the laptop to the participant,
   gives the task prompt, starts the stopwatch. No further help
   unless the participant is stuck for > 2 min.
4. **Interview (10 min):** open-ended questions, audio recorded.
5. **Wrap-up (2 min):** researcher stops the recording, thanks the
   participant, escorts them out.

## 7. Roles

| Role | Person |
| --- | --- |
| Test facilitator | Thesis author |
| Note-taker | Research assistant |
| Admin / IT support | Thesis author |
| Accessibility observer | Sign-language faculty member (one of the three) |

## 8. Data handling

- Video from the camera is **never recorded** — only landmark arrays.
- Feedback and analytics tables store pseudonymised user IDs (UUIDs,
  not names).
- Audio recordings of the interview are stored on an encrypted external
  drive and deleted after the thesis is published.

## 9. Schedule

| Day | Activity |
| --- | --- |
| 2026-06-08 (Mon) | Participant recruitment + consent forms |
| 2026-06-09 (Tue) | Pilot test with 1 hearing user + 1 deaf user (data discarded) |
| 2026-06-10 – 06-12 | Main test (3 + 3 participants per day) |
| 2026-06-13 (Sat) | Faculty evaluator block |
| 2026-06-14 (Sun) | Analysis, write-up → `docs/uat-results.md` |

## 10. Risk register

| Risk | Mitigation |
| --- | --- |
| Participant has limited sign vocabulary | Use the 26 alphabet gestures + 10 phrase gestures (HELLO, THANK YOU, YES, NO, GOOD MORNING/AFTERNOON/EVENING, PLEASE, SORRY, HELP) for tasks |
| Webcam permission denied | Researcher walks through the browser prompt before the task starts |
| Network drops during the test | Fall back to local-only mode (recognition works without Supabase; only cloud sync is affected) |
| Lighting too dark for MediaPipe | Lab has adjustable overhead LEDs; researcher checks before each session |
| Participant withdraws | Replacements recruited from the same pool; aim for 5 of each group completed |

## 11. Deliverables

- `docs/uat-results.md` — aggregated metrics + qualitative themes
- Raw CSV export from the admin analytics RPC for the test window
- Audio transcripts (with consent) attached to the thesis appendix
