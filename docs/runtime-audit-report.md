# Runtime Model Audit — Usage Guide

## Script
`scripts/audit-deployed-model.mjs`

## Purpose
Cross-references the deployed model's `labels.json` against three layers:
1. **Translation layer** (`GESTURE_DISPLAY_MAP` in `src/features/recognition/translation.ts`)
2. **Database** (`gestures` table)
3. **Suggested replies** (`gesture_replies` table)

Reports gaps, orphans, and gestures with no replies.

## Usage
```bash
# Required: database connection string
set DATABASE_URL=postgresql://postgres:...@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres

# Basic text report
node scripts/audit-deployed-model.mjs

# Detailed report
node scripts/audit-deployed-model.mjs --report

# JSON output (for programmatic consumption)
node scripts/audit-deployed-model.mjs --json
```

## Expected Output Sections
1. **Model labels** — count and source path
2. **Translation layer** — labels in `GESTURE_DISPLAY_MAP`, missing labels, extra labels
3. **Database** — gesture rows present, missing labels, orphan labels (in DB but not model)
4. **Replies** — total replies, gestures with zero replies
5. **Summary** — numeric counts and overall clean/dirty status

## Possible Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Label in model but not in translation layer | `GESTURE_DISPLAY_MAP` out of sync | Re-run `setup` phase or manually add entry to `translation.ts` |
| Label in model but not in DB | Migration or seed script not run | Run `supabase/migrations/0014_fsl105_gestures.sql` or `node scripts/seed-fsl105-gestures.mjs` |
| Label in DB but not in model (orphan) | Old gesture manually added, then model retrained | Archive orphan via admin panel or delete if unused |
| Gesture has zero replies | Reply insert failed during seed | Use admin import page at `/admin/gesture-library/import` or manually add via `/admin/replies` |
| Mismatch in `reply_text` display | Default replies are generic placeholders | Edit via `/admin/replies` to customize per category |

## Automated Checks (CI)
The audit script exits with code 0 when clean, 1 when issues found. This makes it suitable for CI pipelines:
```yaml
# .github/workflows/audit.yml
- run: DATABASE_URL=${{ secrets.DATABASE_URL }} node scripts/audit-deployed-model.mjs
```
