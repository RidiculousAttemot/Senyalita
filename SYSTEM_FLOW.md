# System Flow and User Roles

> Status: reflects the system after the final-architecture cleanup. For folder
> layout see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) §3; for implementation
> detail see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).

The system has **two core workflows**, both on `/translate`, plus two supporting
public pages.

| Route | Purpose |
|---|---|
| `/` | Landing |
| `/translate` | **Sign-to-Text** and **Text-to-Sign**, tabbed |
| `/learn` | FSL reference — alphabet, numbers, tutorial links |
| `/evaluation` | Accuracy harness that produces the thesis figures |

`/conversation`, `/presentation`, `/type-to-sign` and `/history` were removed and
redirect rather than 404.

## User roles

| Role | Login | Can do |
|---|---|---|
| **Public visitor** | none | all four routes above |
| **Admin** | Supabase Auth, **local only** | the above, plus animation upload, dataset management, publishing |

No registration, no user profiles, no personal data. Visitors are identified
only by an anonymous `session_token`. Admin is read from
`app_metadata.role === "admin"` and enforced by `public.is_admin()` in RLS.

## Access flow

1. Visitor opens `/`.
2. Landing page links to **`/translate`** — no login, no gate.
3. `/translate` hosts both workflows in a tab switcher.
4. Admins reach `/admin/login` **on localhost only**. In production every
   `/admin/*` and `/api/admin/*` path returns 404 — not a login redirect, which
   would advertise that a panel exists.

---

## Workflow A — Sign-to-Text (primary)

Route: `/translate`, "Sign → Text" tab.

```
camera  ->  MediaPipe hand landmarks  ->  BiLSTM model  ->  ONE class
                                                              |
                                          appended to the letter buffer
                                                              |
                                              suggestion engine ranks words
                                                              |
                              user accepts a suggestion, keeps signing, or clears
```

**Two modes, explicitly selected — no automatic switching:**

| Mode | Recognises | Status |
|---|---|---|
| **Alphabet** | 26 letters + 10 numbers (`ONE`–`TEN`) | Production |
| **Phrase Signs** | 95 phrase glosses | **Beta**, labelled as such in the UI |

The mode *is* the filter: it restricts which of the model's 131 classes can be
predicted. The model itself always retains all 131 so `/evaluation` can measure
them.

1. User starts the camera (`getUserMedia`, 640×480, front camera).
2. MediaPipe Hand Landmarker (WASM) yields 21 landmarks per tracked hand. The
   number of tracked hands follows the mode — one for Alphabet, two for Phrase
   Signs, since a second hand roughly halves detection throughput.
3. Landmarks are wrist-centred and max-abs scaled to a 126-feature vector,
   appended to the recognition buffer at a fixed ~30 Hz to match the rate the
   training clips were extracted at.
4. A motion detector marks gesture spans on the **raw** landmarks, and a marked
   span is resampled to the model's trained temporal scale. With no span
   marked the raw window is used unchanged, so the alphabet path is unaffected.
5. The BiLSTM model (`public/models/fsl_unified/bilstm_tfjs/`) predicts one
   class. Recognition runs **entirely on-device** — video never leaves the
   browser.
6. The user commits the prediction; the character joins the buffer
   (`H` → `HE` → `HEL` → `HELL` → `HELLO`). Committing clears the recognition
   sequence, so the next sign does not compete with the previous one.
7. After each character the suggestion engine offers candidate words from the
   gloss dictionary. Accepting one replaces the spelled run. **Numbers reach the
   transcript but not the spelling buffer** — a digit mid-word can never match a
   dictionary entry and would suppress suggestions.

Not supported: sentence recognition, gloss prediction, continuous sign
recognition, machine translation.

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
5. The playback engine drives the landmark renderer. The public app shows the
   skeleton only: the Human, Split and Overlay views drew the source recording,
   and those were deleted from Storage to fit the free tier, so 129 of 130 signs
   answered them with "Recording unavailable". The landmark view is also what
   the system actually produces. The video route and `source_video_path` are
   still maintained -- see SYSTEM_DOCUMENTATION.md 1.1.

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

Conversation mode, session history, the presentation page, and the standalone
`/type-to-sign` surface were removed as out of scope. They remain in git
history:

```
git show pre-cleanup:src/app/conversation/page.tsx
git checkout pre-cleanup -- src/features/analytics/
```

**`/learn` and `/evaluation` were restored** after the cleanup and are live
public routes — `/evaluation` because it is the instrument that produces the
thesis accuracy figures, `/learn` as an FSL reference built on the same player
and published assets as Text-to-Sign. Earlier revisions of this document listed
both as removed; that is no longer true.
