---
name: phase-log
description: Record completed work in AGENTS.md following this repo's established "Phase N — Title" convention. Use after finishing a non-trivial chunk of work on SignLangVisual (a feature, a dataset/model change, a migration, an audit) so the project history stays consistent with the existing 45+ phase entries.
---

# Recording work as a phase (AGENTS.md convention)

[AGENTS.md](../../../AGENTS.md) is this project's running build log — 45+ phases,
each a dated chunk of work with what shipped and whether validation passed. Every
prior session (including past Claude Code sessions) has added to it. Keep it going
rather than starting a separate changelog or doc for the same purpose —
[CHANGELOG.md](../../../CHANGELOG.md) is a different, lighter-weight release log; don't
conflate the two.

## When to add an entry

After completing a coherent unit of work — a new feature, a dataset/model pipeline
run (see [[fsl-pipeline]]), a DB migration, a significant audit or bugfix — not after
every small edit. Roughly: if it's the kind of thing you'd mention in a standup, it
gets a phase entry.

## Format (match existing entries exactly)

```markdown
### Phase <N> — <Short Title>
<Dense paragraph: what was built/changed, key files/modules touched, new scripts,
new docs, DB migrations by number, notable metrics if applicable. End with the
validation status line.> Lint/tests/build/tsc all pass.
```

Conventions observed across existing entries:
- `<N>` continues from the highest existing phase number (check the current end of
  the file — numbering has gaps, e.g. jumps from 27 to 43, so don't renumber
  anything, just append the next unused number or a sensible sub-phase like `43b`).
- One dense paragraph, not bullet lists — names files/scripts/docs inline with
  backticks.
- Always ends with a pass/fail status line for lint/tests/build/typecheck, matching
  whatever was actually run (e.g. "Lint/163 tests/build/tsc all pass" or naming
  specific failures if something didn't pass — don't fabricate a clean status).
- If new docs were produced, they go in `docs/` and get named in the phase paragraph.
- If metrics changed (accuracy, F1, latency), include a before/after comparison
  table like the one in Phase 45, not prose-only numbers.

## Where to add it

Append as a new `###` entry after the last existing phase entry, before the
`## Current Status` section at the bottom of the file. Update the `## Current Status`
summary bullets too if the change affects counts named there (routes, scripts, docs,
tests, migrations, models).
