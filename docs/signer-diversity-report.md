# Signer Diversity Report

Generated: 2026-06-16

## Summary

| Metric | Value |
|--------|-------|
| Total predictions | — |
| Total sessions | — |
| Unique signers | — |
| Registered profiles | 0 |

> Run `node scripts/analyze-signer-diversity.mjs` with a configured `.env.local` to populate live data.

## Diversity Dimensions

### Lighting
No session diversity metadata recorded yet. **Gap: all lighting conditions.**

### Camera Angle
No camera angle metadata recorded yet. **Gap: all camera angles.**

### Background
No background metadata recorded yet. **Gap: all background types.**

### Hand Dominance
No hand dominance metadata recorded yet. **Gap: all hand dominance types.**

### Environment
No environment metadata recorded yet. **Gap: all environment types.**

## Registered Signer Profiles

Zero signer profiles registered in `signer_profiles` table.

## Identified Gaps

| Dimension | Gap Description |
|-----------|----------------|
| Lighting | No dim/bright/variable lighting data collected |
| Camera Angle | No side/top-down/angled data collected |
| Background | No outdoor/cluttered/variable background data |
| Hand Dominance | No left-handed or ambidextrous signer data |
| Signing Experience | No native/beginner/intermediate profiles |
| Environment | No home/office/classroom environment metadata |

## Recommendations

1. **Implement diversity metadata capture** — Update the recognition hook to record lighting, camera angle, background, and hand dominance via the `session_diversity_metadata` table.
2. **Recruit diverse signers** — Target 10+ signers across experience levels (native, fluent, intermediate, beginner).
3. **Vary recording environments** — Collect in at least 3 distinct environments (home, office, classroom).
4. **Include multiple camera angles** — Primary front-facing as baseline; supplement with side and angled views.
5. **Track left-handed signers** — Ensure both right and left-handed data is represented for hand-dominance invariance.

## Next Steps

1. Add diversity metadata capture to client-side recognition flow
2. Register signer profiles for each new session
3. Re-run this analysis after 30 days of diverse collection
4. Target: >= 10 signers, >= 3 environments, >= 2 camera angles
