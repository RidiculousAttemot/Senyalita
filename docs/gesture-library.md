# Gesture library

A "gesture" is a recognized sign with optional reference video and
optional suggested replies. The library is curated by admins; the model
itself only outputs a label, not a description.

## Data model

```
gesture (label, description, video_path, thumbnail_path, is_active, status, display_order)
   └──< gesture_reply (reply_text, display_order, is_active, video_path)
```

Labels are **case-sensitive single letters** matching the model's output
(`a`–`z` in the seed). The seed (`0007_seed.sql`) creates the 26-letter
alphabet; admins add new gestures (e.g. `'hello'`, `'thanks'`) through
the admin UI.

## Moderation status

Every gesture has a `status` of `draft`, `review`, `approved`, or
`archived`. Only `status='approved' AND is_active=true` rows are visible
to authenticated users (enforced by RLS — see `docs/rls-policy-report.md`).
Admins can filter the admin table by status and use the per-row
**Approve / Review / Archive** buttons to move a gesture through the
workflow.

| Status     | Visible to users? | Visible to admins? | Typical use |
| ---------- | :---: | :---: | --- |
| `draft`    | no | yes | Initial state for new gestures |
| `review`   | no | yes | Pending faculty sign-off |
| `approved` | yes (if `is_active`) | yes | Production-ready |
| `archived` | no | yes | Soft-deleted; kept for analytics |

## How to add a new gesture (admin)

1. Sign in as an admin user (promote via `promote_user(email)` first).
2. Navigate to **/admin/gestures**.
3. Click **+ New gesture**.
4. Fill in:
   - **Label** — the same string the model emits (e.g. `a`, `hello`).
   - **Description** — a short sentence shown to the user on the camera
     page when this gesture is detected.
   - **Display order** — for sorting.
   - **Active** — toggle off to hide without deleting.
5. Click **Save**.
6. After saving, the **Reference video** field appears. Upload an MP4 /
   WebM / MOV (max 50 MB). The video is stored under
   `gesture-videos/gestures/<id>/reference.<ext>` and served via
   `getPublicUrl()`.

## How to add a suggested reply

Suggested replies are short phrases that the camera page offers the user
when this gesture is recognized. Tapping a reply appends it to the
running transcript, speaks it through TTS, and (optionally) plays a
custom response video uploaded by the admin.

1. Navigate to **/admin/replies**.
2. Pick a gesture from the filter (or leave it on **All**).
3. Click **+ New reply**.
4. Choose the gesture, type the reply text (max 200 chars), set the
   display order, and save.
5. After saving, the **Response video** field appears in the edit modal.
   Upload an MP4 / WebM / MOV (max 50 MB). The file is stored under
   `gesture-videos/gestures/<gesture_id>/replies/<reply_id>/response.<ext>`
   and the `gesture_replies.video_path` column is updated.
6. On the camera page, replies with a custom video show a small blue
   **▶** badge. Tapping a reply with a video opens a modal overlay that
   auto-plays the response video; tapping a reply without a video
   dismisses the reply panel as before.

## How to upload a reference video (programmatic)

For bulk uploads, use the `service_role` key from a script:

```ts
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const supabase = createClient(URL, SERVICE_ROLE_KEY);
const path = `gestures/${gestureId}/reference.mp4`;
const bytes = readFileSync("hello.mp4");

const { error: upErr } = await supabase.storage
  .from("gesture-videos")
  .upload(path, bytes, { contentType: "video/mp4", upsert: true });
if (upErr) throw upErr;

await supabase
  .from("gestures")
  .update({ video_path: path })
  .eq("id", gestureId);
```

## How to upload a reply response video (programmatic)

The admin UI handles single uploads. For bulk seeding, use the same
pattern with a per-reply path:

```ts
const replyPath = `gestures/${gestureId}/replies/${replyId}/response.mp4`;
await supabase.storage
  .from("gesture-videos")
  .upload(replyPath, bytes, { contentType: "video/mp4", upsert: true });
await supabase
  .from("gesture_replies")
  .update({ video_path: replyPath })
  .eq("id", replyId);
```

## RLS

The `gestures` and `gesture_replies` tables are publicly readable (so the
camera page can show the reference video without auth). Only admins can
insert/update/delete. Policies are written using the `is_admin()` SQL
helper (defined in `0004_rls.sql`).

## Lifecycle

| Action       | Effect                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| `upsert`     | Replaces all scalar fields. Existing replies are kept.                |
| `delete`     | Cascade-deletes all replies. Storage video is **not** deleted.        |
| reply video upload | Stored at `gestures/<id>/replies/<id>/response.<ext>`. |
| toggle `is_active = false` | The gesture is hidden from `listActiveGesturesWithReplies`. |
| toggle reply `is_active = false` | Hidden from the camera page UI.              |

## Performance

- `gestures_with_replies` is a `GROUP BY` view with `json_agg`. On 26
  gestures and ~5 replies each, the query is sub-millisecond.
- The camera page calls `lookupGesture(label)` only after a confirmed
  prediction (confidence ≥ threshold), so it's at most ~1 query per
  second during normal use.

## Testing locally

```bash
# Seed is idempotent, re-run as needed
psql "$DATABASE_URL" -f supabase/migrations/0007_seed.sql
```

Then open `/camera`, sign a gesture, and confirm the reference video +
suggested replies panel appears.
