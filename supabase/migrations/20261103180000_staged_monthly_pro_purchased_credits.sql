-- STAGED / NOT APPLIED — 2026-11-03
-- IMPORTANT: Run this only after review on a clone/staging Supabase project,
-- and after the payment webhook + quota failure refund flow have tests.
-- Preserves the existing pro lifetime account at 300 Credits/month.
-- New pro_monthly: 750 Credits/month if expires_at is in the future.
-- Purchased packs: 350 for 10 SAR or 800 for 20 SAR; do not grant
-- credits without verifying paid status and webhook signatures.
begin;

alter table public.profiles
  add column if not exists pro_monthly_expires_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'pro', 'pro_monthly'));

alter table public.profiles
  add constraint profiles_monthly_expiry_required
  check (plan <> 'pro_monthly' or pro_monthly_expires_at is not null);

alter table public.ai_usage_counters
  add column if not exists purchased_credits integer not null default 0
  check (purchased_credits >= 0);

-- This table is NEVER client-writeable. Only a verified provider webhook,
-- using the server-side service_role, may call the grant function below.
create table if not exists public.voclab_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_payment_id text not null,
  amount_halalas integer not null,
  package_credits integer not null,
  created_at timestamptz not null default now(),
  constraint voclab_credit_purchase_unique unique(provider, provider_payment_id),
  constraint voclab_credit_purchase_pack check (
    (package_credits = 350 and amount_halalas = 1000)
    or (package_credits = 800 and amount_halalas = 2000)
  )
);
alter table public.voclab_credit_purchases enable row level security;
revoke all on table public.voclab_credit_purchases from public, anon, authenticated;
grant select, insert on table public.voclab_credit_purchases to service_role;

create table if not exists public.voclab_monthly_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_payment_id text not null,
  amount_halalas integer not null default 1500 check (amount_halalas = 1500),
  period_end timestamptz not null,
  created_at timestamptz not null default now(),
  constraint voclab_monthly_payment_unique unique(provider, provider_payment_id)
);
alter table public.voclab_monthly_payments enable row level security;
revoke all on table public.voclab_monthly_payments from public, anon, authenticated;
grant select, insert on table public.voclab_monthly_payments to service_role;

-- Keep existing function signature and return columns for existing Edge calls.
-- A separate production rollout will add request-level reserve/refund semantics.

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
  v_plan_expires timestamptz;
  v_monthly_limit integer;
  v_monthly_spend integer;
  v_purchased_spend integer;
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

  select coalesce(p.plan, 'free'), p.pro_monthly_expires_at
    into v_plan, v_plan_expires
  from public.profiles p
  where p.id = v_uid;

  v_plan := coalesce(v_plan, 'free');
  -- Expired monthly subscriptions automatically use Free limits.
  -- Existing plan='pro' is grandfathered lifetime and stays at 300/month.
  if v_plan = 'pro_monthly' and (v_plan_expires is null or v_plan_expires <= v_now) then
    v_plan := 'free';
  end if;
  v_monthly_limit := case when v_plan = 'pro' then 300 when v_plan = 'pro_monthly' then 750 else 30 end;

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

  -- Monthly credits are used first, then purchased credits. Never overspend either.
  if v_remaining + v_row.purchased_credits < v_cost then
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
  v_monthly_spend := least(v_cost, v_remaining);
  v_purchased_spend := v_cost - v_monthly_spend;
  v_row.month_credits := v_row.month_credits + v_monthly_spend;
  v_row.purchased_credits := v_row.purchased_credits - v_purchased_spend;
  v_row.minute_count := v_row.minute_count + 1;
  v_remaining := greatest(0, v_monthly_limit - v_row.month_credits);

  update public.ai_usage_counters
    set usage_day = v_row.usage_day,
        day_count = v_row.day_count,
        usage_month = v_row.usage_month,
        month_credits = v_row.month_credits,
        purchased_credits = v_row.purchased_credits,
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

create or replace function public.grant_voclab_credit_pack(
  p_user_id uuid,
  p_provider text,
  p_provider_payment_id text,
  p_credits integer,
  p_amount_halalas integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_original public.voclab_credit_purchases%rowtype;
begin
  if p_user_id is null or nullif(trim(p_provider), '') is null
     or nullif(trim(p_provider_payment_id), '') is null
     or length(p_provider) > 32 or length(p_provider_payment_id) > 150
     or not ((p_credits = 350 and p_amount_halalas = 1000)
          or (p_credits = 800 and p_amount_halalas = 2000)) then
    raise exception 'Invalid paid pack event';
  end if;

  insert into public.voclab_credit_purchases
    (user_id,provider,provider_payment_id,amount_halalas,package_credits)
  values (p_user_id,p_provider,p_provider_payment_id,p_amount_halalas,p_credits)
  on conflict (provider,provider_payment_id) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_original from public.voclab_credit_purchases
      where provider = p_provider and provider_payment_id = p_provider_payment_id;
    if not found or v_original.user_id <> p_user_id
       or v_original.package_credits <> p_credits
       or v_original.amount_halalas <> p_amount_halalas then
      raise exception 'Conflicting payment id';
    end if;
    return false; -- same settled payment must never grant twice
  end if;

  insert into public.ai_usage_counters(user_id,purchased_credits)
  values (p_user_id,p_credits)
  on conflict (user_id) do update
    set purchased_credits = public.ai_usage_counters.purchased_credits + excluded.purchased_credits,
        updated_at = now();
  return true;
end;
$$;
revoke all on function public.grant_voclab_credit_pack(uuid,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.grant_voclab_credit_pack(uuid,text,text,integer,integer) to service_role;

create or replace function public.activate_voclab_monthly_pro(
  p_user_id uuid,
  p_provider text,
  p_provider_payment_id text,
  p_period_end timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan text;
  v_id uuid;
  v_original public.voclab_monthly_payments%rowtype;
begin
  if p_user_id is null or nullif(trim(p_provider), '') is null
     or nullif(trim(p_provider_payment_id), '') is null
     or length(p_provider) > 32 or length(p_provider_payment_id) > 150
     or p_period_end is null or p_period_end <= now()
     or p_period_end > now() + interval '70 days' then
    raise exception 'Invalid monthly payment event';
  end if;

  select plan into v_plan
  from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Profile missing'; end if;
  if v_plan = 'pro' then
    raise exception 'Existing lifetime plan must not be overwritten';
  end if;

  insert into public.voclab_monthly_payments
    (user_id,provider,provider_payment_id,period_end,amount_halalas)
  values (p_user_id,p_provider,p_provider_payment_id,p_period_end,1500)
  on conflict (provider,provider_payment_id) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_original from public.voclab_monthly_payments
      where provider = p_provider and provider_payment_id = p_provider_payment_id;
    if not found or v_original.user_id <> p_user_id
       or v_original.period_end <> p_period_end
       or v_original.amount_halalas <> 1500 then
      raise exception 'Conflicting monthly payment id';
    end if;
    return false;
  end if;

  update public.profiles
    set plan = 'pro_monthly',
        pro_monthly_expires_at = greatest(
          coalesce(pro_monthly_expires_at, p_period_end), p_period_end
        ),
        updated_at = now()
    where id = p_user_id;
  return true;
end;
$$;
revoke all on function public.activate_voclab_monthly_pro(uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.activate_voclab_monthly_pro(uuid,text,text,timestamptz) to service_role;

commit;
