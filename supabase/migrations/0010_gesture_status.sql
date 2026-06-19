-- 0010_gesture_status.sql
-- Add a moderation status to each gesture and restrict public reads to
-- approved rows. Admins still see every status.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gestures' and column_name = 'status'
  ) then
    alter table public.gestures
      add column status text not null default 'approved';
  end if;
end $$;

-- Backfill is unnecessary because the column is added with default 'approved'.

-- Enforce valid values. drop + add in case the constraint already exists
-- under a different name (e.g. from a partial run of this migration).
alter table public.gestures
  drop constraint if exists gestures_status_check;
alter table public.gestures
  add constraint gestures_status_check
  check (status in ('draft', 'review', 'approved', 'archived'));

create index if not exists gestures_status_idx
  on public.gestures(status, is_active, display_order);

-- Tighten the public read policy: only approved (and is_active) gestures
-- are visible to authenticated users. Admins continue to see all rows
-- (admin check is the same predicate used by every other table policy).
drop policy if exists gestures_select_authenticated on public.gestures;
create policy gestures_select_authenticated on public.gestures
  for select using (
    (status = 'approved' and is_active = true)
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
