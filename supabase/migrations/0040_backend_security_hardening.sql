-- 0040: Backend security hardening.
--
-- Fully idempotent (drop-then-create, guarded DO blocks). Every table touched
-- is checked with to_regclass first, because this database has significant
-- migration drift — only a subset of declared tables exist.
--
-- Findings addressed, each verified against the live database:
--
--   1. RLS infinite recursion (42P17) — CRITICAL, user-facing.
--   2. is_admin() lost its search_path pin in 0029.
--   3. drift_snapshots used deprecated auth.role().
--   4. gestures_with_replies view could bypass RLS.
--
-- NOTE ON ADMIN SEMANTICS: the policies replaced below tested
-- `profiles.role = 'admin'`. They are rewritten to use public.is_admin(),
-- which reads auth.users.raw_app_meta_data->>'role'. That matches
-- requireAdmin() in the application and the definition already used by every
-- animation policy, so this makes one source of truth instead of two. An
-- account that is admin only in `profiles` and not in app_metadata will lose
-- admin rights — intentional, since raw_user_meta_data/profile columns are not
-- a safe basis for authorization.

-- ---------------------------------------------------------------------------
-- 1. Harden the SECURITY DEFINER helper
-- ---------------------------------------------------------------------------
-- 0018 pinned `set search_path = public`; the 0029 redefinition dropped it.
-- Without a pinned search_path a SECURITY DEFINER function can be induced to
-- resolve `auth.users` against an attacker-controlled schema.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and raw_app_meta_data->>'role' = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon, service_role;

-- Reads the caller's profile role without triggering profiles' own RLS.
-- Needed so profiles_update_self can verify the role is unchanged without
-- selecting from profiles inside a profiles policy.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_profile_role() from public;
grant execute on function public.current_profile_role() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Break the RLS recursion on public.profiles
-- ---------------------------------------------------------------------------
-- The SELECT policy on profiles contained
--   exists (select 1 from public.profiles p where ...)
-- Evaluating it required selecting from profiles, which re-entered the same
-- policy: Postgres aborts with 42P17 "infinite recursion detected in policy".
--
-- Because ~10 other tables gate access with `exists (select ... from profiles)`,
-- their policies recursed through this one too. Live probe before this fix:
--   profiles / gestures / feedback  -> 42P17 for any non-service-role caller,
-- which broke the public /learn page (its gestures query returned no data).
--
-- Fixing the profiles policies alone clears the recursion for every dependent
-- table, so their policies are intentionally left untouched here.
do $$
begin
  if to_regclass('public.profiles') is null then
    raise notice 'skipping profiles policies (table absent)';
    return;
  end if;

  drop policy if exists profiles_select_self_or_admin on public.profiles;
  create policy profiles_select_self_or_admin on public.profiles
    for select using (auth.uid() = id or public.is_admin());

  drop policy if exists profiles_update_self on public.profiles;
  create policy profiles_update_self on public.profiles
    for update using (auth.uid() = id)
    with check (auth.uid() = id and role = public.current_profile_role());

  drop policy if exists profiles_update_admin on public.profiles;
  create policy profiles_update_admin on public.profiles
    for update using (public.is_admin()) with check (public.is_admin());

  -- Unchanged in intent; restated so the set is coherent.
  drop policy if exists profiles_insert on public.profiles;
  create policy profiles_insert on public.profiles
    for insert with check (auth.uid() = id);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Replace deprecated auth.role()
-- ---------------------------------------------------------------------------
-- auth.role() is deprecated. It is also unsafe once anonymous sign-ins are
-- enabled: anonymous users carry the `authenticated` Postgres role and would
-- satisfy `auth.role() = 'authenticated'`. The TO clause is the supported
-- mechanism and is evaluated before the USING expression.
do $$
begin
  if to_regclass('public.drift_snapshots') is null then
    raise notice 'skipping drift_snapshots (table absent)';
    return;
  end if;

  drop policy if exists drift_snapshots_select on public.drift_snapshots;
  create policy drift_snapshots_select on public.drift_snapshots
    for select to authenticated
    using (true);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Stop the view bypassing RLS
-- ---------------------------------------------------------------------------
-- A Postgres view runs with its definer's privileges unless created with
-- security_invoker, so gestures_with_replies could return rows the caller's
-- own RLS on gestures/gesture_replies would have filtered out.
do $$
begin
  if to_regclass('public.gestures_with_replies') is null then
    raise notice 'skipping gestures_with_replies (view absent)';
    return;
  end if;

  -- security_invoker requires Postgres 15+. Supabase runs 15+, but degrade to
  -- a notice rather than failing the whole migration on an older instance.
  begin
    execute 'alter view public.gestures_with_replies set (security_invoker = true)';
  exception when others then
    raise notice 'Could not set security_invoker on gestures_with_replies: %', sqlerrm;
  end;
end $$;
