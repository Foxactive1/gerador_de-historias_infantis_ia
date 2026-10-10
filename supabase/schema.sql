-- Execute once in Supabase SQL Editor. The browser can read only rows owned by
-- the signed-in user; all writes that affect plans/quotas happen server-side.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  story text not null,
  created_at timestamptz not null default now()
);
create index if not exists stories_user_created_idx on public.stories(user_id, created_at desc);

create table if not exists public.usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  count integer not null default 0 check (count >= 0),
  unique (user_id, usage_date)
);

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

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill accounts that existed before this schema was installed.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.usage enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles
for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can read their own stories" on public.stories;
create policy "Users can read their own stories" on public.stories
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can read their own usage" on public.usage;
create policy "Users can read their own usage" on public.usage
for select to authenticated using ((select auth.uid()) = user_id);

-- Reserve quota before calling the paid AI API. Row locking makes concurrent
-- requests count reliably and prevents a user from bypassing the daily limit.
create or replace function public.reserve_story_usage(p_user_id uuid, p_daily_limit integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
  select count into current_count from public.usage
  where user_id = p_user_id and usage_date = today_utc for update;
  if current_count >= p_daily_limit then
    return jsonb_build_object('allowed', false, 'count', current_count);
  end if;
  update public.usage set count = count + 1
  where user_id = p_user_id and usage_date = today_utc
  returning count into current_count;
  return jsonb_build_object('allowed', true, 'count', current_count);
end;
$$;

create or replace function public.release_story_usage(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.usage set count = greatest(count - 1, 0)
  where user_id = p_user_id and usage_date = (now() at time zone 'utc')::date;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.reserve_story_usage(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_story_usage(uuid) from public, anon, authenticated;
grant execute on function public.reserve_story_usage(uuid, integer) to service_role;
grant execute on function public.release_story_usage(uuid) to service_role;

grant select on public.profiles, public.stories, public.usage to authenticated;
revoke all on public.profiles, public.stories, public.usage from anon;
revoke insert, update, delete on public.profiles, public.stories, public.usage from authenticated;
grant all on public.profiles, public.stories, public.usage to service_role;
