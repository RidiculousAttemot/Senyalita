-- 0008_transcripts.sql
-- Append-only transcript entries that record the running recognized text
-- for a translation session. Each row is the transcript content at the
-- time of the update; the latest row per session is the current text.

create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.translation_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists transcripts_session_idx
  on public.transcripts(session_id, created_at desc);

create index if not exists transcripts_user_idx
  on public.transcripts(user_id, created_at desc);

-- Keep user_id in sync with the parent session (same pattern as
-- translation_logs).
create or replace function public.sync_transcript_user()
returns trigger
language plpgsql
as $$
begin
  select user_id into new.user_id
  from public.translation_sessions
  where id = new.session_id;
  if new.user_id is null then
    raise exception 'translation_sessions row % not found', new.session_id;
  end if;
  return new;
end;
$$;

drop trigger if exists transcripts_sync_user on public.transcripts;
create trigger transcripts_sync_user
  before insert on public.transcripts
  for each row execute function public.sync_transcript_user();

-- ===== RLS for transcripts =====
alter table public.transcripts enable row level security;

drop policy if exists transcripts_select_self on public.transcripts;
create policy transcripts_select_self on public.transcripts
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists transcripts_insert_self on public.transcripts;
create policy transcripts_insert_self on public.transcripts
  for insert with check (user_id = auth.uid());

drop policy if exists transcripts_update_self on public.transcripts;
create policy transcripts_update_self on public.transcripts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists transcripts_delete_self on public.transcripts;
create policy transcripts_delete_self on public.transcripts
  for delete using (user_id = auth.uid());
