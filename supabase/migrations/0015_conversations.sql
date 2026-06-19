-- 0015_conversations.sql
-- Conversation sessions, messages, and context-aware reply relationships.

create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active', 'ended')),
  participant_name text,
  total_messages int not null default 0,
  communication_success boolean,
  created_at timestamptz not null default now()
);

create index if not exists conv_sessions_user_idx
  on public.conversation_sessions(user_id, started_at desc);

create index if not exists conv_sessions_active_idx
  on public.conversation_sessions(user_id)
  where status = 'active';

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  sender_type text not null check (sender_type in ('signer', 'responder')),
  gesture_label text,
  translated_text text not null,
  confidence numeric(5, 4) check (confidence between 0 and 1),
  reply_to_message_id uuid references public.conversation_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists conv_messages_session_idx
  on public.conversation_messages(session_id, created_at);

create table if not exists public.gesture_reply_relationships (
  id uuid primary key default gen_random_uuid(),
  gesture_label text not null,
  suggested_reply text not null,
  priority int not null default 0 check (priority >= 0),
  context_tags text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(gesture_label, suggested_reply)
);

create index if not exists gesture_reply_rel_label_idx
  on public.gesture_reply_relationships(gesture_label);

-- Seed common context-aware reply relationships
insert into public.gesture_reply_relationships (gesture_label, suggested_reply, priority, context_tags) values
  ('THANK YOU', 'You''re welcome', 1, '{"polite","gratitude"}'),
  ('THANK YOU', 'My pleasure', 2, '{"polite","gratitude"}'),
  ('THANK YOU', 'Glad to help', 3, '{"helpful","polite"}'),
  ('HELLO', 'Hello!', 1, '{"greeting"}'),
  ('HELLO', 'Hi, how are you?', 2, '{"greeting","question"}'),
  ('GOOD MORNING', 'Good morning!', 1, '{"greeting","time"}'),
  ('GOOD MORNING', 'Good morning to you too', 2, '{"greeting","time"}'),
  ('GOOD AFTERNOON', 'Good afternoon!', 1, '{"greeting","time"}'),
  ('GOOD EVENING', 'Good evening!', 1, '{"greeting","time"}'),
  ('HOW ARE YOU', 'I''m fine, thank you', 1, '{"question","greeting"}'),
  ('HOW ARE YOU', 'Doing well', 2, '{"question","greeting"}'),
  ('HOW ARE YOU', 'Not feeling well', 3, '{"question","feeling"}'),
  ('IM FINE', 'Good to hear!', 1, '{"positive","feeling"}'),
  ('IM FINE', 'Glad you''re doing well', 2, '{"positive","feeling"}'),
  ('NICE TO MEET YOU', 'Nice to meet you too', 1, '{"polite","greeting"}'),
  ('NICE TO MEET YOU', 'Likewise', 2, '{"polite","greeting"}'),
  ('YES', 'Great!', 1, '{"positive","agreement"}'),
  ('NO', 'Okay, I understand', 1, '{"neutral","understanding"}'),
  ('UNDERSTAND', 'Good, glad we''re on the same page', 1, '{"positive","understanding"}'),
  ('DON''T UNDERSTAND', 'Let me explain again', 1, '{"helpful","clarification"}'),
  ('DON''T UNDERSTAND', 'I''ll repeat that', 2, '{"helpful","clarification"}'),
  ('SORRY', 'No problem', 1, '{"polite","forgiveness"}'),
  ('SORRY', 'It''s okay', 2, '{"polite","forgiveness"}'),
  ('PLEASE', 'Of course', 1, '{"polite","request"}'),
  ('PLEASE', 'Sure thing', 2, '{"polite","request"}'),
  ('THANK YOU', 'No problem', 4, '{"polite","informal"}'),
  ('HELP', 'How can I help?', 1, '{"helpful","question"}'),
  ('HELP', 'I''m here to help', 2, '{"helpful","reassurance"}'),
  ('GOODBYE', 'Goodbye!', 1, '{"farewell"}'),
  ('GOODBYE', 'See you later', 2, '{"farewell"}'),
  ('GOODBYE', 'Take care', 3, '{"farewell"}'),
  ('SEE YOU TOMORROW', 'See you tomorrow!', 1, '{"farewell","time"}'),
  ('SEE YOU TOMORROW', 'Looking forward to it', 2, '{"farewell","positive"}')
on conflict (gesture_label, suggested_reply) do nothing;

-- RLS: conversation_sessions — users see own, admins see all
alter table public.conversation_sessions enable row level security;

drop policy if exists "Users view own conversation sessions" on public.conversation_sessions;
create policy "Users view own conversation sessions" on public.conversation_sessions
  for select using (user_id = auth.uid());

drop policy if exists "Users insert own conversation sessions" on public.conversation_sessions;
create policy "Users insert own conversation sessions" on public.conversation_sessions
  for insert with check (user_id = auth.uid());

drop policy if exists "Users update own conversation sessions" on public.conversation_sessions;
create policy "Users update own conversation sessions" on public.conversation_sessions
  for update using (user_id = auth.uid());

drop policy if exists "Admins manage all conversation sessions" on public.conversation_sessions;
create policy "Admins manage all conversation sessions" on public.conversation_sessions
  using (public.is_admin());

-- RLS: conversation_messages — via session
alter table public.conversation_messages enable row level security;

drop policy if exists "Users view own conversation messages" on public.conversation_messages;
create policy "Users view own conversation messages" on public.conversation_messages
  for using (
    exists (
      select 1 from public.conversation_sessions
      where id = conversation_messages.session_id
      and (user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Users insert conversation messages" on public.conversation_messages;
create policy "Users insert conversation messages" on public.conversation_messages
  for insert with check (
    exists (
      select 1 from public.conversation_sessions
      where id = conversation_messages.session_id
      and (user_id = auth.uid() or public.is_admin())
    )
  );

-- RLS: gesture_reply_relationships — readable by all, writable by admin only
alter table public.gesture_reply_relationships enable row level security;

drop policy if exists "Anyone read gesture reply rels" on public.gesture_reply_relationships;
create policy "Anyone read gesture reply rels" on public.gesture_reply_relationships
  for select using (true);

drop policy if exists "Admins manage gesture reply rels" on public.gesture_reply_relationships;
create policy "Admins manage gesture reply rels" on public.gesture_reply_relationships
  for all using (public.is_admin());

-- Helper function to increment message counter
create or replace function public.increment_conv_message_count(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversation_sessions
  set total_messages = total_messages + 1
  where id = p_session_id;
end;
$$;
