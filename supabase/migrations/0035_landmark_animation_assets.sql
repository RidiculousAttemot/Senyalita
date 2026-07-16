-- Private, versioned landmark animation assets for Type-to-Sign.

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

alter table public.animation_assets
  add constraint animation_assets_published_version_fkey
  foreign key (published_version_id) references public.animation_asset_versions(id) on delete set null;

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

create policy "admin manages animation assets" on public.animation_assets for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manages animation asset versions" on public.animation_asset_versions for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manages animation asset reviews" on public.animation_asset_reviews for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manages animation processing jobs" on public.animation_processing_jobs for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('animation-source-videos', 'animation-source-videos', false, 104857600, array['video/mp4', 'video/webm', 'video/quicktime']),
  ('animation-landmarks', 'animation-landmarks', false, 52428800, array['application/json'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "admin manages animation source videos" on storage.objects for all
  using (bucket_id = 'animation-source-videos' and public.is_admin())
  with check (bucket_id = 'animation-source-videos' and public.is_admin());

create policy "admin manages animation landmarks" on storage.objects for all
  using (bucket_id = 'animation-landmarks' and public.is_admin())
  with check (bucket_id = 'animation-landmarks' and public.is_admin());