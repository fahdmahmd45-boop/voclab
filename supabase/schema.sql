-- VocLab account data for Supabase Auth users.
-- Run this once in Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_phone_unique
  on public.profiles(phone)
  where phone is not null;

alter table public.profiles enable row level security;

-- A signed-in user may read their own plan/profile, but cannot change plan.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "user_state_select_own" on public.user_state;
create policy "user_state_select_own"
  on public.user_state
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_state_insert_own" on public.user_state;
create policy "user_state_insert_own"
  on public.user_state
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_state_update_own" on public.user_state;
create policy "user_state_update_own"
  on public.user_state
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_voclab_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, plan)
  values (new.id, new.phone, 'free')
  on conflict (id) do update
    set phone = excluded.phone,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_voclab on auth.users;
create trigger on_auth_user_created_voclab
  after insert or update of phone on auth.users
  for each row execute function public.handle_new_voclab_user();

-- Backfill profiles if users already exist before this schema is installed.
insert into public.profiles (id, phone, plan)
select id, phone, 'free'
from auth.users
on conflict (id) do update
  set phone = excluded.phone,
      updated_at = now();

-- Server-enforced AI quota. Clients cannot read or modify this table directly.
create table if not exists public.ai_usage_counters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usage_day date not null default ((now() at time zone 'utc')::date),
  day_count integer not null default 0 check (day_count >= 0),
  minute_bucket timestamptz not null default date_trunc('minute', now()),
  minute_count integer not null default 0 check (minute_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.ai_usage_counters enable row level security;
revoke all on table public.ai_usage_counters from anon, authenticated;

create or replace function public.consume_voclab_ai_quota()
returns table (
  allowed boolean,
  remaining_today integer,
  retry_after_seconds integer,
  code text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now at time zone 'utc')::date;
  v_minute timestamptz := date_trunc('minute', v_now);
  v_row public.ai_usage_counters%rowtype;
  v_daily_limit constant integer := 10;
  v_minute_limit constant integer := 5;
  v_retry integer;
begin
  if v_uid is null then
    return query select false, 0, 0, 'AUTH_REQUIRED'::text;
    return;
  end if;

  insert into public.ai_usage_counters (user_id, usage_day, day_count, minute_bucket, minute_count)
  values (v_uid, v_day, 0, v_minute, 0)
  on conflict (user_id) do nothing;

  select * into v_row
  from public.ai_usage_counters
  where user_id = v_uid
  for update;

  if v_row.usage_day <> v_day then
    v_row.usage_day := v_day;
    v_row.day_count := 0;
    v_row.minute_bucket := v_minute;
    v_row.minute_count := 0;
  elsif v_row.minute_bucket <> v_minute then
    v_row.minute_bucket := v_minute;
    v_row.minute_count := 0;
  end if;

  if v_row.day_count >= v_daily_limit then
    v_retry := greatest(60, ceil(extract(epoch from (((v_day + 1)::timestamp at time zone 'utc') - v_now)))::integer);
    update public.ai_usage_counters
      set usage_day = v_row.usage_day,
          day_count = v_row.day_count,
          minute_bucket = v_row.minute_bucket,
          minute_count = v_row.minute_count,
          updated_at = v_now
      where user_id = v_uid;
    return query select false, 0, v_retry, 'DAILY_AI_LIMIT'::text;
    return;
  end if;

  if v_row.minute_count >= v_minute_limit then
    v_retry := greatest(1, 60 - floor(extract(second from v_now))::integer);
    update public.ai_usage_counters
      set usage_day = v_row.usage_day,
          day_count = v_row.day_count,
          minute_bucket = v_row.minute_bucket,
          minute_count = v_row.minute_count,
          updated_at = v_now
      where user_id = v_uid;
    return query select false, greatest(0, v_daily_limit - v_row.day_count), v_retry, 'AI_RATE_LIMIT'::text;
    return;
  end if;

  v_row.day_count := v_row.day_count + 1;
  v_row.minute_count := v_row.minute_count + 1;

  update public.ai_usage_counters
    set usage_day = v_row.usage_day,
        day_count = v_row.day_count,
        minute_bucket = v_row.minute_bucket,
        minute_count = v_row.minute_count,
        updated_at = v_now
    where user_id = v_uid;

  return query select true, greatest(0, v_daily_limit - v_row.day_count), 0, null::text;
end;
$$;

revoke all on function public.consume_voclab_ai_quota() from public, anon;
grant execute on function public.consume_voclab_ai_quota() to authenticated;
