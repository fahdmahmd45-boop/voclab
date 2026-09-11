-- Replace the old per-day request counter with weighted monthly AI credits.
-- Free: 30 credits/month. Pro: 300 credits/month.
-- Word lookup costs 1 credit; file analysis costs 5 credits.

alter table public.ai_usage_counters
  add column if not exists usage_month date,
  add column if not exists month_credits integer;

update public.ai_usage_counters
set usage_month = date_trunc('month', now() at time zone 'utc')::date
where usage_month is null;

update public.ai_usage_counters
set month_credits = 0
where month_credits is null;

alter table public.ai_usage_counters
  alter column usage_month set default date_trunc('month', now() at time zone 'utc')::date,
  alter column usage_month set not null,
  alter column month_credits set default 0,
  alter column month_credits set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_usage_counters_month_credits_check'
      and conrelid = 'public.ai_usage_counters'::regclass
  ) then
    alter table public.ai_usage_counters
      add constraint ai_usage_counters_month_credits_check
      check (month_credits >= 0);
  end if;
end
$$;

-- Remove the previous one-argument version before adding the cost-aware version.
drop function if exists public.consume_voclab_ai_quota(uuid);

create function public.consume_voclab_ai_quota(
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
