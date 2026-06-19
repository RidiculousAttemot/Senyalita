-- 0022_user_profiles_enhancement.sql
-- Phase 19: Add user-facing profile fields (preferred_language, avatar_url, full_name alias)

alter table public.profiles
  add column if not exists full_name text generated always as (coalesce(display_name, email)) stored,
  add column if not exists preferred_language text not null default 'en',
  add column if not exists avatar_url text;

-- Auto-create profile on signup (idempotent)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Re-trigger the function on auth.users insert (safe to re-run)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
