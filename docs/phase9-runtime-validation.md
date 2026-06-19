# Phase 9 — Runtime Validation Report

## Test Environment

| Item | Value |
|------|-------|
| Model | fsl_unified/bilstm_tfjs (133 classes) |
| Device | Laptop webcam 640×480 |
| Browser | Chrome |
| Lighting | Indoor office |
| Distance from camera | ~50cm |
| Debug mode | `?debug=1` |

## Alphabet Tests (20 runs)

| # | Gesture | Predicted | Confidence | Latency | FPS | PASS/FAIL |
|---|---------|-----------|------------|---------|-----|-----------|
| 1 | A | | | | | |
| 2 | B | | | | | |
| 3 | C | | | | | |
| 4 | D | | | | | |
| 5 | E | | | | | |
| 6 | F | | | | | |
| 7 | G | | | | | |
| 8 | H | | | | | |
| 9 | I | | | | | |
| 10 | J | | | | | |
| 11 | K | | | | | |
| 12 | L | | | | | |
| 13 | M | | | | | |
| 14 | N | | | | | |
| 15 | O | | | | | |
| 16 | P | | | | | |
| 17 | Q | | | | | |
| 18 | R | | | | | |
| 19 | S | | | | | |
| 20 | T | | | | | |

**Alphabet pass rate**: ___ / 20

## Phrase Tests (20 runs)

| # | Gesture | Model Label | Predicted | Confidence | Latency | PASS/FAIL |
|---|---------|------------|-----------|------------|---------|-----------|
| 1 | Thank You | THANK YOU | | | | |
| 2 | Good Morning | GOOD MORNING | | | | |
| 3 | Hello | HELLO | | | | |
| 4 | How Are You | HOW ARE YOU | | | | |
| 5 | Yes | YES | | | | |
| 6 | No | NO | | | | |
| 7 | One | ONE | | | | |
| 8 | Two | TWO | | | | |
| 9 | Three | THREE | | | | |
| 10 | Father | FATHER | | | | |
| 11 | Mother | MOTHER | | | | |
| 12 | Blue | BLUE | | | | |
| 13 | Red | RED | | | | |
| 14 | Rice | RICE | | | | |
| 15 | Coffee | COFFEE | | | | |
| 16 | Today | TODAY | | | | |
| 17 | Monday | MONDAY | | | | |
| 18 | Understand | UNDERSTAND | | | | |
| 19 | Hot | HOT | | | | |
| 20 | Bread | BREAD | | | | |

**Phrase pass rate**: ___ / 20

## Feature Verification

| Feature | Status | Notes |
|---------|--------|-------|
| Alphabet recognition | | Shows "Letter: X" |
| Phrase recognition | | Shows "Phrase: Name" |
| Confidence display | | |
| Top-5 predictions | | Via debug overlay toggle |
| Translation display | | Title-case output |
| Transcript logging | | |
| Gesture lookup | | Returns gesture info |
| Suggested replies | | Only for phrase category |
| Reference video | | Null until admin upload |
| TTS | | |
| Supabase sync | | |
| History page | | |
| Category detection | | alphabet vs phrase |

## Issues Found

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | (fill in) | | |
