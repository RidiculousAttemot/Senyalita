-- 0013_extended_analytics.sql
-- Extend get_admin_analytics to return recognition, reply, and user
-- metrics that the Phase 7 admin dashboard needs.

-- Drop first so the parameter name can change without the
-- "cannot change name of input parameter" error.
drop function if exists public.get_admin_analytics(int);
drop function if exists public.get_model_metrics_daily(int);

create or replace function public.get_admin_analytics(p_days_back int default 30)
returns jsonb
language plpgsql
stable
security definer
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
  active_users integer;
  sessions_count integer;
  users_count integer;
  sessions_per_user numeric;
  avg_dur numeric;
  top_g jsonb;
  top_r jsonb;
  daily_c jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
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

  select count(distinct user_id) into active_users
  from public.translation_sessions
  where started_at >= now() - make_interval(days => p_days_back);

  select count(*) into sessions_count
  from public.translation_sessions
  where started_at >= now() - make_interval(days => p_days_back);

  select count(*) into users_count from public.profiles;

  if users_count > 0 then
    sessions_per_user := sessions_count::numeric / users_count;
  else
    sessions_per_user := 0;
  end if;

  select avg(duration_ms) into avg_dur
  from public.translation_sessions
  where started_at >= now() - make_interval(days => p_days_back)
    and duration_ms is not null;

  select coalesce(jsonb_agg(row_to_json(g) order by g.count desc), '[]'::jsonb)
    into top_g
  from (
    select gesture_label as label,
           count(*) as count,
           avg(confidence) as avg_confidence
    from public.translation_logs
    where created_at >= now() - make_interval(days => p_days_back)
    group by gesture_label
    order by count desc
    limit 10
  ) g;

  select coalesce(jsonb_agg(row_to_json(r) order by r.count desc), '[]'::jsonb)
    into top_r
  from (
    select selected_reply as reply_text,
           count(*) as count
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
    select date_trunc('day', created_at)::date as day,
           count(*) as count
    from public.translation_logs
    where created_at >= now() - make_interval(days => p_days_back)
    group by day
    order by day
  ) d;

  result := jsonb_build_object(
    'totals', jsonb_build_object(
      'users', users_count,
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
      'total', users_count,
      'active_30d', active_users,
      'sessions_per_user', sessions_per_user,
      'avg_session_duration_ms', avg_dur
    ),
    'daily_counts', daily_c,
    'active_users_30d', active_users
  );

  return result;
end;
$$;

-- Last N days of daily metrics, ordered ascending by day.
create or replace function public.get_model_metrics_daily(p_days_back int default 30)
returns jsonb
language plpgsql
stable
security definer
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
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
