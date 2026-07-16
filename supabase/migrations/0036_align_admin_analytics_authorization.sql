-- Phase 27 removed public.profiles and moved admin authorization to
-- auth.users.app_metadata. Keep the analytics RPC aligned with public.is_admin().

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and raw_app_meta_data->>'role' = 'admin'
  );
$$;

create or replace function public.get_admin_analytics(p_days_back int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  threshold numeric := 0.6;
  total_logs integer;
  total_today integer;
  total_week integer;
  total_month integer;
  avg_conf numeric;
  avg_inf numeric;
  low_conf_rate numeric;
  active_sessions integer;
  sessions_count integer;
  sessions_per_active_session numeric;
  avg_dur numeric;
  top_g jsonb;
  top_r jsonb;
  daily_c jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select count(*),
         count(*) filter (where created_at >= date_trunc('day', now())),
         count(*) filter (where created_at >= date_trunc('week', now())),
         count(*) filter (where created_at >= date_trunc('month', now())),
         avg(confidence),
         avg(inference_time_ms),
         avg(case when confidence < threshold then 1.0 else 0.0 end)
    into total_logs, total_today, total_week, total_month,
         avg_conf, avg_inf, low_conf_rate
  from public.translation_logs
  where created_at >= now() - make_interval(days => p_days_back);

  select count(*)
    into sessions_count
  from public.translation_sessions
  where started_at >= now() - make_interval(days => p_days_back);

  active_sessions := sessions_count;

  sessions_per_active_session := case
    when active_sessions > 0 then sessions_count::numeric / active_sessions
    else 0
  end;

  select avg(duration_ms) into avg_dur
  from public.translation_sessions
  where started_at >= now() - make_interval(days => p_days_back)
    and duration_ms is not null;

  select coalesce(jsonb_agg(row_to_json(g) order by g.count desc), '[]'::jsonb)
    into top_g
  from (
    select gesture_label as label, count(*) as count, avg(confidence) as avg_confidence
    from public.translation_logs
    where created_at >= now() - make_interval(days => p_days_back)
    group by gesture_label
    order by count desc
    limit 10
  ) g;

  select coalesce(jsonb_agg(row_to_json(r) order by r.count desc), '[]'::jsonb)
    into top_r
  from (
    select selected_reply as reply_text, count(*) as count
    from public.translation_logs
    where created_at >= now() - make_interval(days => p_days_back)
      and selected_reply is not null
    group by selected_reply
    order by count desc
    limit 10
  ) r;

  select coalesce(jsonb_agg(row_to_json(d) order by d.day), '[]'::jsonb)
    into daily_c
  from (
    select date_trunc('day', created_at)::date as day, count(*) as count
    from public.translation_logs
    where created_at >= now() - make_interval(days => p_days_back)
    group by day
    order by day
  ) d;

  result := jsonb_build_object(
    'totals', jsonb_build_object(
      'users', 0,
      'translations', total_logs,
      'sessions', sessions_count,
      'avg_confidence', avg_conf,
      'avg_inference_ms', avg_inf
    ),
    'recognition', jsonb_build_object(
      'total', total_logs,
      'today', total_today,
      'this_week', total_week,
      'this_month', total_month,
      'low_confidence_rate', coalesce(low_conf_rate, 0)
    ),
    'top_gestures', top_g,
    'top_replies', top_r,
    'users', jsonb_build_object(
      'total', 0,
      'active_30d', active_sessions,
      'sessions_per_user', sessions_per_active_session,
      'avg_session_duration_ms', avg_dur
    ),
    'daily_counts', daily_c,
    'active_users_30d', active_sessions
  );

  return result;
end;
$$;

revoke all on function public.get_admin_analytics(integer) from public;
grant execute on function public.get_admin_analytics(integer) to authenticated;

create or replace function public.get_model_metrics_daily(p_days_back int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select coalesce(jsonb_agg(row_to_json(m) order by m.day), '[]'::jsonb)
    into result
  from (
    select day,
           total_predictions,
           low_confidence_count,
           unknown_count,
           avg_confidence,
           avg_inference_ms,
           failure_rate
    from public.model_metrics_daily
    where day >= current_date - p_days_back
    order by day
  ) m;

  return result;
end;
$$;

revoke all on function public.get_model_metrics_daily(integer) from public;
grant execute on function public.get_model_metrics_daily(integer) to authenticated;