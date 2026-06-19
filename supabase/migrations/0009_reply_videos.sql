-- 0009_reply_videos.sql
-- Add an optional custom response video to each suggested reply.
-- The video is stored in the existing `gesture-videos` bucket under
-- `gestures/<gesture_id>/replies/<reply_id>/response.<ext>`.
-- Existing RLS policies already allow admin writes on the `gesture_replies`
-- table (the `gesture_replies_admin_write` policy uses `cmd = ALL`), so this
-- migration only adds the column and a covering index.

alter table public.gesture_replies
  add column if not exists video_path text;

-- Index speeds up "which replies have a custom response video?" lookups
-- in the admin dashboard. Partial index keeps it small.
create index if not exists gesture_replies_video_idx
  on public.gesture_replies(gesture_id)
  where video_path is not null;
