-- 0016_response_videos.sql
-- Add response video support to gesture_reply_relationships

alter table public.gesture_reply_relationships
  add column if not exists response_video_url text;

-- Add selected_reply tracking to conversation_messages for analytics
alter table public.conversation_messages
  add column if not exists is_selected_reply boolean not null default false;
