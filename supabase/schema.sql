-- VocLab Supabase schema mirror.
-- Production database changes are versioned in supabase/migrations/ from 2026-09-09 onward.
-- Keep this file aligned with the post-migration production schema; do not apply ad-hoc edits
-- directly in production without adding a migration.

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
grant all on table public.profiles to anon, authenticated, service_role;

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
  updated_at timestamptz not null default now(),
  constraint user_state_state_size_check
    check (octet_length(state::text) <= 1048576)
);

alter table public.user_state enable row level security;
grant all on table public.user_state to anon, authenticated, service_role;

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

revoke all on function public.handle_new_voclab_user() from public, anon, authenticated;
grant execute on function public.handle_new_voclab_user() to service_role;

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
-- Legacy daily columns are retained for compatibility/observability; monthly credits
-- are the billing/plan limit used by consume_voclab_ai_quota.
create table if not exists public.ai_usage_counters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usage_day date not null default ((now() at time zone 'utc')::date),
  day_count integer not null default 0 check (day_count >= 0),
  usage_month date not null default date_trunc('month', now() at time zone 'utc')::date,
  month_credits integer not null default 0 check (month_credits >= 0),
  minute_bucket timestamptz not null default date_trunc('minute', now()),
  minute_count integer not null default 0 check (minute_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.ai_usage_counters enable row level security;
revoke all on table public.ai_usage_counters from anon, authenticated;
grant all on table public.ai_usage_counters to service_role;

-- Intentionally NO RLS policies on ai_usage_counters.
-- anon and authenticated have all table privileges revoked, and the quota RPC below is
-- executable only by service_role. Adding client policies here would broaden the attack surface.
comment on table public.ai_usage_counters is
  'No client RLS policies by design: anon/authenticated privileges are revoked; service_role-only access.';

-- Remove legacy overloads so there is no client-callable quota RPC.
drop function if exists public.consume_voclab_ai_quota();
drop function if exists public.consume_voclab_ai_quota(uuid);

create or replace function public.consume_voclab_ai_quota(
  p_user_id uuid,
  p_cost integer default 1
)
returns table (
  allowed boolean,
  remaining_today integer,
  retry_after_seconds integer,
  code text,
  remaining_monthly integer,
  monthly_limit integer,
  plan text,
  cost integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := p_user_id;
  v_cost integer := p_cost;
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now at time zone 'utc')::date;
  v_month date := date_trunc('month', v_now at time zone 'utc')::date;
  v_next_month timestamptz := ((date_trunc('month', v_now at time zone 'utc') + interval '1 month') at time zone 'utc');
  v_minute timestamptz := date_trunc('minute', v_now);
  v_row public.ai_usage_counters%rowtype;
  v_plan text := 'free';
  v_monthly_limit integer;
  v_minute_limit constant integer := 5;
  v_retry integer;
  v_remaining integer;
begin
  if v_uid is null then
    return query select false, 0, 0, 'AUTH_REQUIRED'::text, 0, 0, 'free'::text, 0;
    return;
  end if;

  if v_cost not in (1, 5) then
    return query select false, 0, 0, 'INVALID_AI_COST'::text, 0, 0, 'free'::text, v_cost;
    return;
  end if;

  select coalesce(p.plan, 'free')
    into v_plan
  from public.profiles p
  where p.id = v_uid;

  v_plan := coalesce(v_plan, 'free');
  v_monthly_limit := case when v_plan = 'pro' then 300 else 30 end;

  insert into public.ai_usage_counters (
    user_id,
    usage_day,
    day_count,
    usage_month,
    month_credits,
    minute_bucket,
    minute_count
  )
  values (v_uid, v_day, 0, v_month, 0, v_minute, 0)
  on conflict (user_id) do nothing;

  select * into v_row
  from public.ai_usage_counters
  where user_id = v_uid
  for update;

  if v_row.usage_month <> v_month then
    v_row.usage_month := v_month;
    v_row.month_credits := 0;
  end if;

  if v_row.usage_day <> v_day then
    v_row.usage_day := v_day;
    v_row.day_count := 0;
  end if;

  if v_row.minute_bucket <> v_minute then
    v_row.minute_bucket := v_minute;
    v_row.minute_count := 0;
  end if;

  v_remaining := greatest(0, v_monthly_limit - v_row.month_credits);

  if v_row.month_credits + v_cost > v_monthly_limit then
    v_retry := greatest(60, ceil(extract(epoch from (v_next_month - v_now)))::integer);
    update public.ai_usage_counters
      set usage_day = v_row.usage_day,
          day_count = v_row.day_count,
          usage_month = v_row.usage_month,
          month_credits = v_row.month_credits,
          minute_bucket = v_row.minute_bucket,
          minute_count = v_row.minute_count,
          updated_at = v_now
      where user_id = v_uid;

    return query select false, v_remaining, v_retry, 'MONTHLY_AI_CREDIT_LIMIT'::text,
      v_remaining, v_monthly_limit, v_plan, v_cost;
    return;
  end if;

  if v_row.minute_count >= v_minute_limit then
    v_retry := greatest(1, 60 - floor(extract(second from v_now))::integer);
    update public.ai_usage_counters
      set usage_day = v_row.usage_day,
          day_count = v_row.day_count,
          usage_month = v_row.usage_month,
          month_credits = v_row.month_credits,
          minute_bucket = v_row.minute_bucket,
          minute_count = v_row.minute_count,
          updated_at = v_now
      where user_id = v_uid;

    return query select false, v_remaining, v_retry, 'AI_RATE_LIMIT'::text,
      v_remaining, v_monthly_limit, v_plan, v_cost;
    return;
  end if;

  v_row.day_count := v_row.day_count + 1;
  v_row.month_credits := v_row.month_credits + v_cost;
  v_row.minute_count := v_row.minute_count + 1;
  v_remaining := greatest(0, v_monthly_limit - v_row.month_credits);

  update public.ai_usage_counters
    set usage_day = v_row.usage_day,
        day_count = v_row.day_count,
        usage_month = v_row.usage_month,
        month_credits = v_row.month_credits,
        minute_bucket = v_row.minute_bucket,
        minute_count = v_row.minute_count,
        updated_at = v_now
    where user_id = v_uid;

  return query select true, v_remaining, 0, null::text,
    v_remaining, v_monthly_limit, v_plan, v_cost;
end;
$$;

revoke all on function public.consume_voclab_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_voclab_ai_quota(uuid, integer) to service_role;
