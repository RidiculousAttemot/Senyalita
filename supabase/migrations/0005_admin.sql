-- 0005_admin.sql
-- Admin-only utilities: role promotion and a one-shot analytics rollup.

-- Promote a user (by email) to admin. Only callable by an existing admin
-- or via the Supabase SQL editor. NOT exposed to anon/authenticated roles.
create or replace function public.promote_user(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  select id into target_id
  from public.profiles
  where email = target_email;

  if target_id is null then
    raise exception 'No profile with email %', target_email;
  end if;

  update public.profiles
  set role = 'admin'
  where id = target_id;
end;
$$;

revoke all on function public.promote_user(text) from public;
grant execute on function public.promote_user(text) to service_role;

-- Demote a user back to 'user'.
create or replace function public.demote_user(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  select id into target_id
  from public.profiles
  where email = target_email;

  if target_id is null then
    raise exception 'No profile with email %', target_email;
  end if;

  update public.profiles
  set role = 'user'
  where id = target_id;
end;
$$;

revoke all on function public.demote_user(text) from public;
grant execute on function public.demote_user(text) to service_role;

-- Admin analytics rollup. Aggregates totals, top labels, daily counts.
-- Returns a single JSON object suitable for the analytics dashboard.
create or replace function public.get_admin_analytics(days_back integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  since_ts timestamptz := now() - (days_back || ' days')::interval;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'admin only';
  end if;

  select jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'translations', (select count(*) from public.translation_logs),
      'sessions', (select count(*) from public.translation_sessions),
      'avg_confidence', coalesce((select avg(confidence) from public.translation_logs), 0),
      'avg_inference_ms', coalesce((select avg(inference_time_ms) from public.translation_logs), 0)
    ),
    'top_gestures', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select gesture_label as label, count(*) as count, avg(confidence) as avg_confidence
        from public.translation_logs
        where created_at >= since_ts
        group by gesture_label
        order by count desc
        limit 10
      ) t
    ), '[]'::jsonb),
    'daily_counts', coalesce((
      select jsonb_agg(row_to_json(d))
      from (
        select date_trunc('day', created_at) as day, count(*) as count
        from public.translation_logs
        where created_at >= since_ts
        group by 1
        order by 1
      ) d
    ), '[]'::jsonb),
    'active_users_30d', (
      select count(distinct user_id)
      from public.translation_logs
      where created_at >= since_ts
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_admin_analytics(integer) from public;
grant execute on function public.get_admin_analytics(integer) to authenticated;
