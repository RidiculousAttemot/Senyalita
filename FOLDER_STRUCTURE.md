# Folder Structure

Reflects the codebase after the final-architecture cleanup. The system has
exactly two user-facing workflows: **Sign-to-Text** and **Text-to-Sign**.

```
src/
  app/                          Next.js App Router
    page.tsx                    landing
    translate/                  BOTH workflows, tab-switched
    admin/
      (auth)/login/
      (dashboard)/              admin tools
    api/
      animations/[gloss]/       published landmark animations
      assets/dataset/           dataset catalogue (admin)
      admin/
        animation-assets/       upload / list / approve / publish
        health/                 backend diagnostics
        active-learning/
      videos/[label]/[file]/
      ai/replies/  collection/  feedback/
      predictions/correct/  signers/register/  text-to-sign/log/

  features/
    recognition/                on-device model, inference loop, smoothing
    sign-to-text/               camera capture, landmark drawing, transcript
    suggestions/                word prediction from spelled letters
    ---
    type-to-sign/               composer, stage viewer, progressive loading
    translation-pipeline/       text -> animation-key dictionary lookup
    fsl-translation/            gloss dictionary (also backs suggestions)
    sign-animation/             playback engine, renderers, loader
    animation/  gesture-mapping/
    ---
    ai-assist/                  gloss suggestion + asset QA for Animation Studio
    active-learning/  profiles/

  server/
    http/                       typed HTTP errors, rate limiting
    services/                   animation resolution, dataset catalogue,
                                publish-time validation

  components/                   ui/ primitives, layout, admin, landing
  lib/                          supabase clients & queries, utils

scripts/                        dataset + model pipeline (4 canonical, wired
                                into package.json) plus research tools
supabase/migrations/            41 migrations; history, never deleted
datasets/  models/              gitignored, not recoverable from git
public/models/fsl_unified/      TF.js model the browser loads
```

## The two workflows

**Sign-to-Text** — `app/translate` → `features/sign-to-text` →
`features/recognition` (camera → MediaPipe hand landmarks → model → one
letter) → `features/suggestions` (letter buffer → word predictions, using the
dictionary from `fsl-translation`).

**Text-to-Sign** — `app/translate` → `features/type-to-sign` →
`features/translation-pipeline` (text → animation keys) →
`features/sign-animation` loader → `/api/animations/[gloss]` → Supabase
Storage. A word with no published sign is spelled out using one published
alphabet animation per character.

## Notes

- `/translate` is the only public route besides `/`. `/type-to-sign` and
  `/sign-to-text` are permanent redirects to it.
- Supabase is the single source of truth for animation assets. The local
  `datasets/processed/user_holistic_assets` path is a development-only
  fallback behind `ANIMATION_LOCAL_FALLBACK`; those files are gitignored and
  never deployed.
- `middleware.ts` lives at `src/middleware.ts` (the duplicate at the repo root
  was removed — it exported only a matcher, with no middleware function).
- Anything removed in the cleanup is recoverable: `git show pre-cleanup:<path>`.
