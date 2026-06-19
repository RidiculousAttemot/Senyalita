-- 0033_phase35_communication_intelligence.sql
-- Phase 35: Adaptive Communication Intelligence

-- Part A: Communication Profiles (anonymous session-based)
create table if not exists public.communication_profiles (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  preferred_language text default 'en' check (preferred_language in ('en', 'tl')),
  preferred_reply_style text default 'concise' check (preferred_reply_style in ('concise', 'detailed', 'casual', 'formal')),
  conversation_speed text default 'normal' check (conversation_speed in ('slow', 'normal', 'fast')),
  frequently_used_gestures text[] default '{}',
  commonly_selected_replies text[] default '{}',
  accessibility_preferences jsonb default '{}',
  total_sessions integer not null default 0,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists communication_profiles_token_idx on public.communication_profiles(session_token);
create index if not exists communication_profiles_language_idx on public.communication_profiles(preferred_language);
create index if not exists communication_profiles_last_active_idx on public.communication_profiles(last_active_at desc);

alter table public.communication_profiles enable row level security;

drop policy if exists "Public can manage own profile" on public.communication_profiles;
create policy "Public can manage own profile" on public.communication_profiles
  for all using (true)
  with check (true);

-- Part D: Gesture difficulty tracking table
create table if not exists public.gesture_difficulty_tracking (
  id uuid primary key default gen_random_uuid(),
  gesture_label text not null,
  total_recognitions integer not null default 0,
  avg_confidence real,
  correction_count integer not null default 0,
  confusion_count integer not null default 0,
  retry_count integer not null default 0,
  difficulty_score real generated always as (
    case
      when total_recognitions = 0 then 0.5
      else (
        (1.0 - coalesce(avg_confidence, 0.5)) * 0.4 +
        (correction_count::real / nullif(total_recognitions, 0)) * 0.3 +
        (confusion_count::real / nullif(total_recognitions, 0)) * 0.2 +
        (retry_count::real / nullif(total_recognitions, 0)) * 0.1
      )
    end
  ) stored,
  last_updated timestamptz,
  created_at timestamptz not null default now(),
  unique(gesture_label)
);

create index if not exists gesture_difficulty_score_idx on public.gesture_difficulty_tracking(difficulty_score desc);
create index if not exists gesture_difficulty_label_idx on public.gesture_difficulty_tracking(gesture_label);

alter table public.gesture_difficulty_tracking enable row level security;

drop policy if exists "Public can read gesture difficulty" on public.gesture_difficulty_tracking;
create policy "Public can read gesture difficulty" on public.gesture_difficulty_tracking
  for select using (true);

drop policy if exists "Admins manage gesture difficulty" on public.gesture_difficulty_tracking;
create policy "Admins manage gesture difficulty" on public.gesture_difficulty_tracking
  for all using (public.is_admin());

-- Part D: Gesture retry log
create table if not exists public.gesture_retry_log (
  id uuid primary key default gen_random_uuid(),
  session_token text,
  gesture_label text not null,
  retry_count integer not null default 1,
  original_confidence real,
  final_confidence real,
  was_successful boolean,
  created_at timestamptz not null default now()
);

create index if not exists gesture_retry_label_idx on public.gesture_retry_log(gesture_label);
create index if not exists gesture_retry_session_idx on public.gesture_retry_log(session_token);

alter table public.gesture_retry_log enable row level security;

drop policy if exists "Public can insert retry log" on public.gesture_retry_log;
create policy "Public can insert retry log" on public.gesture_retry_log
  for insert with check (true);

drop policy if exists "Admins manage retry log" on public.gesture_retry_log;
create policy "Admins manage retry log" on public.gesture_retry_log
  for all using (public.is_admin());

-- Part E: Learning recommendations tracking
create table if not exists public.learning_recommendations (
  id uuid primary key default gen_random_uuid(),
  session_token text not null,
  gesture_label text not null,
  recommendation_reason text not null,
  priority_score real not null default 0.5,
  is_dismissed boolean not null default false,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique(session_token, gesture_label, recommendation_reason)
);

create index if not exists learning_recommendations_session_idx on public.learning_recommendations(session_token);
create index if not exists learning_recommendations_priority_idx on public.learning_recommendations(priority_score desc);

alter table public.learning_recommendations enable row level security;

drop policy if exists "Public can manage own recommendations" on public.learning_recommendations;
create policy "Public can manage own recommendations" on public.learning_recommendations
  for all using (session_token = current_setting('app.session_token', true)::text)
  with check (session_token = current_setting('app.session_token', true)::text);

-- Part G: Prediction explanations log
create table if not exists public.prediction_explanations (
  id uuid primary key default gen_random_uuid(),
  gesture_label text not null,
  predicted_label text not null,
  confidence real not null,
  explanation_text text not null,
  explanation_category text not null check (explanation_category in ('high_confidence', 'low_confidence', 'confusion', 'motion', 'edge_case')),
  top_alternatives jsonb default '[]',
  contributing_factors jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists prediction_explanations_label_idx on public.prediction_explanations(gesture_label);
create index if not exists prediction_explanations_category_idx on public.prediction_explanations(explanation_category);
create index if not exists prediction_explanations_created_idx on public.prediction_explanations(created_at desc);

alter table public.prediction_explanations enable row level security;

drop policy if exists "Admins manage prediction explanations" on public.prediction_explanations;
create policy "Admins manage prediction explanations" on public.prediction_explanations
  for all using (public.is_admin());

-- Part H: Conversation intelligence aggregation
create table if not exists public.conversation_intelligence (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  total_conversations integer not null default 0,
  successful_conversations integer not null default 0,
  total_messages integer not null default 0,
  avg_response_delay_ms real,
  avg_corrections_per_conversation real,
  avg_confidence real,
  acceptance_rate real,
  low_confidence_trend real,
  top_topics jsonb default '[]',
  gesture_difficulty_summary jsonb default '{}',
  correction_heatmap jsonb default '{}',
  dataset_growth integer default 0,
  created_at timestamptz not null default now()
);

create index if not exists conversation_intelligence_day_idx on public.conversation_intelligence(day desc);

alter table public.conversation_intelligence enable row level security;

drop policy if exists "Admins manage conversation intelligence" on public.conversation_intelligence;
create policy "Admins manage conversation intelligence" on public.conversation_intelligence
  for all using (public.is_admin());

-- Part F: Communication quality log (extended metrics)
create table if not exists public.communication_quality_log (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversation_sessions(id) on delete set null,
  session_token text,
  response_delay_ms real,
  correction_count integer not null default 0,
  avg_recognition_confidence real,
  communication_completion real check (communication_completion between 0 and 1),
  conversation_duration_seconds real,
  successful_exchanges integer not null default 0,
  total_exchanges integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists comm_quality_conversation_idx on public.communication_quality_log(conversation_id);
create index if not exists comm_quality_session_idx on public.communication_quality_log(session_token);

alter table public.communication_quality_log enable row level security;

drop policy if exists "Public can insert own quality log" on public.communication_quality_log;
create policy "Public can insert own quality log" on public.communication_quality_log
  for insert with check (true);

drop policy if exists "Admins manage quality log" on public.communication_quality_log;
create policy "Admins manage quality log" on public.communication_quality_log
  for all using (public.is_admin());

-- Add conversation_topic to conversation_sessions if not exists
alter table public.conversation_sessions
  add column if not exists conversation_topic text,
  add column if not exists response_delay_avg_ms real,
  add column if not exists correction_count integer not null default 0,
  add column if not exists completion_status text check (completion_status in ('completed', 'abandoned', 'in_progress'));

-- Add phrase_frequency tracking via gesture_reply_relationships
alter table public.gesture_reply_relationships
  add column if not exists selection_count integer not null default 0,
  add column if not exists acceptance_rate real,
  add column if not exists last_selected_at timestamptz;

-- Add reply_selection_log for tracking acceptance history
create table if not exists public.reply_selection_log (
  id uuid primary key default gen_random_uuid(),
  gesture_label text not null,
  reply_text text not null,
  session_token text,
  was_accepted boolean not null default true,
  context_topic text,
  conversation_id uuid references public.conversation_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists reply_selection_gesture_idx on public.reply_selection_log(gesture_label);
create index if not exists reply_selection_reply_idx on public.reply_selection_log(reply_text);
create index if not exists reply_selection_accepted_idx on public.reply_selection_log(was_accepted);

alter table public.reply_selection_log enable row level security;

drop policy if exists "Public can insert reply selection log" on public.reply_selection_log;
create policy "Public can insert reply selection log" on public.reply_selection_log
  for insert with check (true);

drop policy if exists "Admins manage reply selection log" on public.reply_selection_log;
create policy "Admins manage reply selection log" on public.reply_selection_log
  for all using (public.is_admin());

-- Updated_at trigger for communication_profiles
create or replace function public.update_communication_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists update_communication_profiles_updated_at_trigger on public.communication_profiles;
create trigger update_communication_profiles_updated_at_trigger
  before update on public.communication_profiles
  for each row
  execute function public.update_communication_profiles_updated_at();
