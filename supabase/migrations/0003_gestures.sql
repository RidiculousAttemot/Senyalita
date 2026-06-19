-- 0003_gestures.sql
-- Gesture library + suggested replies + admin-managed video URLs.

create table if not exists public.gestures (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  description text not null default '',
  video_path text,
  thumbnail_path text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gestures_active_idx
  on public.gestures(is_active, display_order);

drop trigger if exists gestures_touch_updated_at on public.gestures;
create trigger gestures_touch_updated_at
  before update on public.gestures
  for each row execute function public.touch_updated_at();

create table if not exists public.gesture_replies (
  id uuid primary key default gen_random_uuid(),
  gesture_id uuid not null references public.gestures(id) on delete cascade,
  reply_text text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists gesture_replies_gesture_idx
  on public.gesture_replies(gesture_id, display_order)
  where is_active = true;

-- View that joins gestures to their active replies for read-only consumers
-- (camera page, etc.). Simplifies RLS and avoids re-doing the join in app code.
create or replace view public.gestures_with_replies as
select
  g.id,
  g.label,
  g.description,
  g.video_path,
  g.thumbnail_path,
  g.is_active,
  g.display_order,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('id', r.id, 'reply_text', r.reply_text, 'display_order', r.display_order)
        order by r.display_order
      )
      from public.gesture_replies r
      where r.gesture_id = g.id and r.is_active = true
    ),
    '[]'::jsonb
  ) as replies
from public.gestures g;
