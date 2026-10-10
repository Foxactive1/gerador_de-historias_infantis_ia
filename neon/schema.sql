-- Application schema for Neon PostgreSQL + Neon Managed Auth.
-- Neon Auth manages its own tables in neon_auth. This script creates only app data.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id text primary key,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  prompt text not null,
  story text not null,
  created_at timestamptz not null default now()
);
create index if not exists stories_user_created_idx on public.stories(user_id, created_at desc);

create table if not exists public.usage (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  usage_date date not null default (now() at time zone 'utc')::date,
  count integer not null default 0 check (count >= 0),
  unique (user_id, usage_date)
);
create index if not exists usage_user_date_idx on public.usage(user_id, usage_date desc);

-- Upgrade an existing Neon-only installation from UUID IDs to Neon Auth string IDs.
alter table public.profiles alter column id type text using id::text;
alter table public.stories alter column user_id type text using user_id::text;
alter table public.usage alter column user_id type text using user_id::text;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- Serialize quota reservations per user and UTC day, including concurrent API calls.
drop function if exists public.reserve_story_usage(uuid, integer);
drop function if exists public.reserve_story_usage(text, integer);
create function public.reserve_story_usage(p_user_id text, p_daily_limit integer)
returns jsonb language plpgsql set search_path = '' as $$
declare
  today_utc date := (now() at time zone 'utc')::date;
  current_count integer;
begin
  if p_daily_limit < 1 or p_daily_limit > 100 then
    raise exception 'Invalid daily limit';
  end if;

  insert into public.usage (user_id, usage_date, count)
  values (p_user_id, today_utc, 0)
  on conflict (user_id, usage_date) do nothing;

  select u.count into current_count
  from public.usage as u
  where u.user_id = p_user_id and u.usage_date = today_utc
  for update;

  if current_count >= p_daily_limit then
    return jsonb_build_object('allowed', false, 'count', current_count, 'usage_date', today_utc);
  end if;

  update public.usage as u set count = u.count + 1
  where u.user_id = p_user_id and u.usage_date = today_utc
  returning u.count into current_count;

  return jsonb_build_object('allowed', true, 'count', current_count, 'usage_date', today_utc);
end;
$$;

drop function if exists public.release_story_usage(uuid);
drop function if exists public.release_story_usage(text);
drop function if exists public.release_story_usage(text, date);
create function public.release_story_usage(p_user_id text, p_usage_date date)
returns void language plpgsql set search_path = '' as $$
begin
  update public.usage as u set count = greatest(u.count - 1, 0)
  where u.user_id = p_user_id and u.usage_date = p_usage_date;
end;
$$;

revoke all on function public.reserve_story_usage(text, integer) from public;
revoke all on function public.release_story_usage(text, date) from public;

-- DATABASE_URL is server-only. API handlers validate Neon Auth JWTs and scope
-- every query by the authenticated subject before accessing application data.
