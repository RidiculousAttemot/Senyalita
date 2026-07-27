-- Private, versioned landmark animation assets for Type-to-Sign.
--
-- Fully idempotent: safe to run any number of times. This repository has no
-- migration ledger table, so a migration cannot assume it has run exactly
-- once — `create table if not exists` alone is not enough, because
-- `alter table ... add constraint` and `create policy` both fail on a second
-- run. Each of those is guarded below.

create table if not exists public.animation_assets (
  id uuid primary key default gen_random_uuid(),
  gloss text not null unique,
  published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.animation_asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.animation_assets(id) on delete cascade,
  version integer not null check (version > 0),
  source_video_path text,
  landmark_json_path text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'failed', 'ready', 'approved', 'published', 'archived')),
  fps numeric,
  total_frames integer,
  duration_ms integer,
  quality_score numeric check (quality_score is null or (quality_score >= 0 and quality_score <= 100)),
  extraction_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, version)
);

-- Postgres has no `add constraint if not exists`; check the catalogue first.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'animation_assets_published_version_fkey'
      and conrelid = 'public.animation_assets'::regclass
  ) then
    alter table public.animation_assets
      add constraint animation_assets_published_version_fkey
      foreign key (published_version_id) references public.animation_asset_versions(id) on delete set null;
  end if;
end $$;

create unique index if not exists animation_asset_versions_one_published_per_asset
  on public.animation_asset_versions(asset_id) where status = 'published';

create table if not exists public.animation_asset_reviews (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.animation_asset_versions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approved', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.animation_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.animation_asset_versions(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists animation_asset_versions_status_idx on public.animation_asset_versions(status);
create index if not exists animation_processing_jobs_status_idx on public.animation_processing_jobs(status);

alter table public.animation_assets enable row level security;
alter table public.animation_asset_versions enable row level security;
alter table public.animation_asset_reviews enable row level security;
alter table public.animation_processing_jobs enable row level security;

-- `create policy` has no IF NOT EXISTS; drop-then-create keeps this re-runnable.
drop policy if exists "admin manages animation assets" on public.animation_assets;
create policy "admin manages animation assets" on public.animation_assets for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manages animation asset versions" on public.animation_asset_versions;
create policy "admin manages animation asset versions" on public.animation_asset_versions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manages animation asset reviews" on public.animation_asset_reviews;
create policy "admin manages animation asset reviews" on public.animation_asset_reviews for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manages animation processing jobs" on public.animation_processing_jobs;
create policy "admin manages animation processing jobs" on public.animation_processing_jobs for all using (public.is_admin()) with check (public.is_admin());

-- Storage buckets and their policies live in 0039, deliberately.
--
-- `storage.objects` is owned by `supabase_storage_admin`, not `postgres`, so
-- `create policy ... on storage.objects` can fail with a permission error
-- depending on how the SQL is run. The Supabase SQL Editor executes a script
-- as a single transaction, so one such failure rolls back every statement
-- above it — including these tables, which then makes 0038 fail with
-- 42P01 (relation does not exist). Keeping the storage DDL in its own file
-- means a storage permission problem can no longer discard the schema.
