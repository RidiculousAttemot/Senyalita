-- 0012_model_metrics_daily.sql
-- Daily rollup of model performance. Populated by a server-side cron
-- (or a one-shot script) calling upsert_model_metrics_daily().

create table if not exists public.model_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  total_predictions integer not null default 0,
  low_confidence_count integer not null default 0,
  unknown_count integer not null default 0,
  avg_confidence numeric,
  avg_inference_ms numeric,
  failure_rate numeric,
  updated_at timestamptz not null default now()
);

create index if not exists model_metrics_daily_day_idx
  on public.model_metrics_daily(day desc);

alter table public.model_metrics_daily enable row level security;

-- Admin-only read + write.
drop policy if exists model_metrics_select_admin on public.model_metrics_daily;
create policy model_metrics_select_admin on public.model_metrics_daily
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists model_metrics_admin_write on public.model_metrics_daily;
create policy model_metrics_admin_write on public.model_metrics_daily
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Idempotent upsert helper. The service role calls this after a daily
-- rollup. failure_rate = (low_conf + unknown) / total.
create or replace function public.upsert_model_metrics_daily(
  p_day date,
  p_total integer,
  p_low_conf integer,
  p_unknown integer,
  p_avg_conf numeric,
  p_avg_inference_ms numeric
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.model_metrics_daily
    (day, total_predictions, low_confidence_count, unknown_count,
     avg_confidence, avg_inference_ms, failure_rate, updated_at)
  values
    (p_day, p_total, p_low_conf, p_unknown, p_avg_conf, p_avg_inference_ms,
     case when p_total > 0
          then (p_low_conf + p_unknown)::numeric / p_total
          else 0
     end,
     now())
  on conflict (day) do update set
    total_predictions = excluded.total_predictions,
    low_confidence_count = excluded.low_confidence_count,
    unknown_count = excluded.unknown_count,
    avg_confidence = excluded.avg_confidence,
    avg_inference_ms = excluded.avg_inference_ms,
    failure_rate = excluded.failure_rate,
    updated_at = now();
end;
$$;
