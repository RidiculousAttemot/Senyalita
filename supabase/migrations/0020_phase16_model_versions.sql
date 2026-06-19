-- 0020_phase16_model_versions.sql
-- Phase 16: Model version management

create table if not exists public.model_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  accuracy real,
  dataset_size integer,
  num_classes integer not null default 133,
  architecture text not null default 'BiLSTM',
  deployment_date timestamptz,
  is_active boolean not null default false,
  metadata jsonb default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists model_versions_active_idx on public.model_versions(is_active);
create index if not exists model_versions_version_idx on public.model_versions(version);

alter table public.model_versions enable row level security;

drop policy if exists "Admins manage model versions" on public.model_versions;
create policy "Admins manage model versions" on public.model_versions
  for all using (public.is_admin());

-- Seed initial model version
insert into public.model_versions (version, accuracy, dataset_size, num_classes, architecture, is_active, notes)
values ('1.0.0', null, 0, 133, 'BiLSTM', true, 'Initial production model — 133-class FSL recognition (28 alphabet + 105 phrase)')
on conflict (version) do nothing;
