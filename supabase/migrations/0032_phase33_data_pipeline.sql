-- 0032_phase33_data_pipeline.sql
-- Phase 33: Real-World Data Collection & Continuous Improvement Pipeline

-- Part A: Extend review_queue with timestamp, session_id, correction label fields
-- Already present in review_queue table; ensure indexes for ingestion automation
create index if not exists review_queue_confidence_idx on public.review_queue(confidence);
create index if not exists review_queue_source_idx on public.review_queue(source);
create index if not exists review_queue_reviewed_at_idx on public.review_queue(reviewed_at);

-- Part D: Extend review_queue with active learning workflow columns
alter table public.review_queue
  add column if not exists review_throughput_seconds integer,
  add column if not exists correction_quality text check (correction_quality in ('exact', 'similar', 'unrelated')),
  add column if not exists batch_id uuid;

create index if not exists review_queue_batch_idx on public.review_queue(batch_id);

-- Part E: Dataset versioning table
create table if not exists public.dataset_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  dataset_name text not null default 'fsl_unified',
  sample_count integer not null default 0,
  class_count integer not null default 133,
  signer_count integer not null default 0,
  source_breakdown jsonb default '{}',
  class_distribution jsonb default '{}',
  mean_confidence real,
  median_confidence real,
  min_samples_per_class integer default 0,
  max_samples_per_class integer default 0,
  std_samples_per_class real default 0,
  is_production boolean not null default false,
  parent_version text,
  change_log text,
  created_at timestamptz not null default now(),
  checksum text
);

create index if not exists dataset_versions_production_idx on public.dataset_versions(is_production);
create index if not exists dataset_versions_created_idx on public.dataset_versions(created_at desc);

alter table public.dataset_versions enable row level security;

drop policy if exists "Admins manage dataset versions" on public.dataset_versions;
create policy "Admins manage dataset versions" on public.dataset_versions
  for all using (public.is_admin());

-- Part H: Longitudinal performance monitoring table
create table if not exists public.daily_performance_metrics (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  total_predictions integer not null default 0,
  total_sessions integer not null default 0,
  avg_confidence real,
  median_confidence real,
  low_confidence_rate real,
  failure_rate real,
  correction_rate real,
  conversation_success_rate real,
  avg_inference_time_ms real,
  p95_inference_time_ms real,
  model_version text,
  signer_count integer default 0,
  created_at timestamptz not null default now()
);

create index if not exists dpm_day_idx on public.daily_performance_metrics(day desc);

alter table public.daily_performance_metrics enable row level security;

drop policy if exists "Admins manage daily performance metrics" on public.daily_performance_metrics;
create policy "Admins manage daily performance metrics" on public.daily_performance_metrics
  for all using (public.is_admin());

-- Part C: Signer diversity tracking table
create table if not exists public.signer_profiles (
  id uuid primary key default gen_random_uuid(),
  signer_id text not null unique,
  age_range text check (age_range in ('under_18', '18_30', '31_50', '51_plus')),
  handedness text check (handedness in ('right', 'left', 'ambidextrous')),
  signing_experience text check (signing_experience in ('native', 'fluent', 'intermediate', 'beginner')),
  region text,
  total_sessions integer not null default 0,
  total_gestures integer not null default 0,
  unique_gestures integer not null default 0,
  avg_confidence real,
  last_active_at timestamptz,
  first_active_at timestamptz not null default now(),
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists signer_profiles_signer_idx on public.signer_profiles(signer_id);
create index if not exists signer_profiles_experience_idx on public.signer_profiles(signing_experience);

alter table public.signer_profiles enable row level security;

drop policy if exists "Admins manage signer profiles" on public.signer_profiles;
create policy "Admins manage signer profiles" on public.signer_profiles
  for all using (public.is_admin());

-- Part C: Session-level diversity metadata
create table if not exists public.session_diversity_metadata (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.translation_sessions(id) on delete cascade,
  signer_id text,
  lighting text check (lighting in ('bright', 'moderate', 'dim', 'variable')),
  camera_angle text check (camera_angle in ('front_facing', 'top_down', 'side', 'angled')),
  background text check (background in ('plain', 'cluttered', 'outdoor', 'indoor', 'variable')),
  hand_dominance text check (hand_dominance in ('right', 'left', 'both')),
  environment text check (environment in ('home', 'office', 'classroom', 'public', 'outdoor')),
  device_type text,
  resolution_width integer,
  resolution_height integer,
  fps real,
  noise_level real check (noise_level between 0 and 1),
  created_at timestamptz not null default now()
);

create index if not exists sdm_session_idx on public.session_diversity_metadata(session_id);
create index if not exists sdm_signer_idx on public.session_diversity_metadata(signer_id);
create index if not exists sdm_lighting_idx on public.session_diversity_metadata(lighting);
create index if not exists sdm_angle_idx on public.session_diversity_metadata(camera_angle);

alter table public.session_diversity_metadata enable row level security;

drop policy if exists "Admins manage session diversity" on public.session_diversity_metadata;
create policy "Admins manage session diversity" on public.session_diversity_metadata
  for all using (public.is_admin());

-- Part E: Dataset version snapshot table
create table if not exists public.dataset_snapshots (
  id uuid primary key default gen_random_uuid(),
  dataset_version_id uuid not null references public.dataset_versions(id) on delete cascade,
  gesture_label text not null,
  sample_count integer not null default 0,
  unique_signers integer not null default 0,
  avg_confidence real,
  min_samples_threshold integer default 5,
  meets_threshold boolean generated always as (sample_count >= min_samples_threshold) stored,
  created_at timestamptz not null default now(),
  unique(dataset_version_id, gesture_label)
);

create index if not exists ds_version_idx on public.dataset_snapshots(dataset_version_id);
create index if not exists ds_label_idx on public.dataset_snapshots(gesture_label);

alter table public.dataset_snapshots enable row level security;

drop policy if exists "Admins manage dataset snapshots" on public.dataset_snapshots;
create policy "Admins manage dataset snapshots" on public.dataset_snapshots
  for all using (public.is_admin());

-- Part A: Insert trigger for low-confidence auto-queue
create or replace function public.auto_queue_low_confidence()
returns trigger as $$
begin
  if new.confidence < 0.60 then
    insert into public.review_queue (
      gesture_label,
      landmarks_data,
      confidence,
      source,
      original_prediction,
      session_id
    ) values (
      new.gesture_label,
      '{}'::jsonb,
      new.confidence,
      'low_confidence',
      new.gesture_label,
      new.session_id
    ) on conflict do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists auto_queue_low_confidence_trigger on public.translation_logs;
create trigger auto_queue_low_confidence_trigger
  after insert on public.translation_logs
  for each row
  when (new.confidence < 0.60)
  execute function public.auto_queue_low_confidence();

-- Part A: Insert trigger for user correction auto-queue
create or replace function public.auto_queue_user_correction()
returns trigger as $$
begin
  insert into public.review_queue (
    gesture_label,
    landmarks_data,
    confidence,
    source,
    original_prediction,
    corrected_label,
    session_id
  ) values (
    new.gesture_label,
    '{}'::jsonb,
    new.confidence,
    'user_correction',
    new.predicted_label,
    new.corrected_label,
    new.session_id
  ) on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists auto_queue_user_correction_trigger on public.prediction_corrections;
create trigger auto_queue_user_correction_trigger
  after insert on public.prediction_corrections
  for each row
  execute function public.auto_queue_user_correction();

-- Part H: Daily metrics aggregation function
create or replace function public.aggregate_daily_performance(p_day date)
returns void as $$
declare
  v_total_predictions integer;
  v_total_sessions integer;
  v_avg_confidence real;
  v_low_confidence_rate real;
  v_failure_rate real;
  v_correction_rate real;
  v_avg_inference_ms real;
  v_conversation_success_rate real;
begin
  select
    count(*),
    count(distinct session_id),
    avg(confidence),
    avg(case when confidence < 0.6 then 1.0 else 0.0 end),
    null::real,
    null::real,
    avg(inference_time_ms),
    null::real
  into
    v_total_predictions, v_total_sessions, v_avg_confidence,
    v_low_confidence_rate, v_failure_rate, v_correction_rate,
    v_avg_inference_ms, v_conversation_success_rate
  from public.translation_logs
  where created_at::date = p_day;

  select
    count(*)::real / nullif(v_total_predictions, 0)
  into v_correction_rate
  from public.prediction_corrections
  where created_at::date = p_day;

  select
    avg(case when communication_success then 1.0 else 0.0 end)
  into v_conversation_success_rate
  from public.conversation_sessions
  where created_at::date = p_day;

  insert into public.daily_performance_metrics (
    day, total_predictions, total_sessions, avg_confidence,
    low_confidence_rate, failure_rate, correction_rate,
    conversation_success_rate, avg_inference_time_ms
  ) values (
    p_day, v_total_predictions, v_total_sessions, v_avg_confidence,
    v_low_confidence_rate, v_failure_rate, v_correction_rate,
    v_conversation_success_rate, v_avg_inference_ms
  )
  on conflict (day)
  do update set
    total_predictions = excluded.total_predictions,
    total_sessions = excluded.total_sessions,
    avg_confidence = excluded.avg_confidence,
    low_confidence_rate = excluded.low_confidence_rate,
    correction_rate = excluded.correction_rate,
    conversation_success_rate = excluded.conversation_success_rate,
    avg_inference_time_ms = excluded.avg_inference_time_ms;
end;
$$ language plpgsql security definer;

-- Seed initial dataset version
insert into public.dataset_versions (
  version, dataset_name, sample_count, class_count, signer_count,
  source_breakdown, is_production
) values (
  '1.0.0', 'fsl_unified', 5721, 133, 1,
  '{"fsl_105": 2129, "fsl_alphabet": 3592}'::jsonb,
  true
) on conflict (version) do nothing;
