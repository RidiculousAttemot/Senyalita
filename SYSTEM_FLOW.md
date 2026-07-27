# System Flow and User Roles

> Status: reflects the system after the final-architecture cleanup. For folder
> layout see [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md); for implementation
> detail see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).

The system supports **exactly two user-facing workflows**. Anything outside
them (conversation mode, learning module, session history, evaluation and
presentation pages) was removed; see the end of this document for recovery.

## User roles

| Role | Login | Can do |
|---|---|---|
| **Public visitor** | none | Sign-to-Text, Text-to-Sign |
| **Admin** | Supabase Auth | the above, plus animation upload, dataset management, publishing, diagnostics |

No registration, no user profiles, no personal data. Visitors are identified
only by an anonymous `session_token`. Admin is read from
`app_metadata.role === "admin"` and enforced by `public.is_admin()` in RLS.

## Access flow

1. Visitor opens `/`.
2. Landing page links to **`/translate`** — no login, no gate.
3. `/translate` hosts both workflows in a tab switcher.
4. Admins reach `/admin/login` and authenticate with Supabase.

---

## Workflow A — Sign-to-Text (primary)

Route: `/translate`, "Sign → Text" tab.

```
camera  ->  MediaPipe hand landmarks  ->  BiLSTM model  ->  ONE letter
                                                              |
                                          appended to the letter buffer
                                                              |
                                              suggestion engine ranks words
                                                              |
                              user accepts a suggestion, keeps signing, or clears
```

1. User starts the camera (`getUserMedia`, 640×480, front camera).
2. MediaPipe Hand Landmarker (WASM) yields up to 2 hands × 21 landmarks.
3. Landmarks are wrist-centred and max-abs scaled to a 126-feature vector,
   appended to the recognition buffer at a fixed ~30 Hz to match the rate the
   training clips were extracted at.
4. The BiLSTM model (`public/models/fsl_unified/bilstm_tfjs/`) predicts a
   single character. Recognition runs **entirely on-device** — video never
   leaves the browser.
5. The user commits the prediction; the character joins the buffer
   (`H` → `HE` → `HEL` → `HELL` → `HELLO`).
6. After each character the suggestion engine offers candidate words from the
   gloss dictionary. Accepting one replaces the spelled run.

Not supported: phrase or sentence recognition, gloss prediction, continuous
sign recognition, machine translation.

---

## Workflow B — Text-to-Sign

Route: `/translate`, "Type → Sign" tab.

```
typed text  ->  dictionary lookup  ->  published animation?
                                          |            |
                                        yes            no
                                          |            |
                                    play the sign   fingerspell:
                                                    one published alphabet
                                                    animation per character
```

1. The translation pipeline maps the text to animation keys (dictionary
   lookup only — no grammar model, no NLP).
2. Each key is fetched from `/api/animations/[gloss]`, which serves the
   published landmark JSON from Supabase Storage.
3. `HELLO` plays the HELLO sign if one is published. `PROGRAMMING` has no
   sign, so it spells out `P-R-O-G-R-A-M-M-I-N-G` using the published
   alphabet animations.
4. Clips stream in: words are revealed as a consecutive ready prefix, so
   playback starts early while later words are still loading, and never
   appears out of order.
5. The playback engine drives the landmark renderer (skeleton, human
   recording, split, or overlay view).

There is always an animation — a word without a sign is never a dead end.

---

## Admin flow

```
upload video -> extract landmarks (in-browser MediaPipe) -> preview skeleton
   -> validate -> publish -> Supabase Storage + database -> live in Text-to-Sign
```

Publishing writes to `animation_assets` / `animation_asset_versions` and
uploads the landmark JSON to the `animation-landmarks` bucket. A newly
published gloss is served on the next request — no rebuild, no restart.

Publishing is validated first: an animation needs at least one hand (roughly
half of FSL fingerspelling is one-handed), a valid frame rate and duration,
and a minimum frame count. Missing pose or face data is a warning, not a
rejection, because the renderer degrades gracefully.

---

## Removed workflows

Conversation mode, the learning module, session history, evaluation and
presentation pages were removed as out of scope. They remain in git history:

```
git show pre-cleanup:src/app/conversation/page.tsx
git checkout pre-cleanup -- src/features/analytics/
```
