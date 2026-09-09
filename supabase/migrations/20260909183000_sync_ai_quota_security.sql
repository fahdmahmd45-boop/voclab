-- Sync the repository with the production AI quota boundary.
-- ai_usage_counters intentionally has NO RLS policies: anon/authenticated table
-- privileges are revoked, and the quota RPC is service_role-only.

alter table public.ai_usage_counters enable row level security;
revoke all on table public.ai_usage_counters from anon, authenticated;
grant all on table public.ai_usage_counters to service_role;

comment on table public.ai_usage_counters is
  'No client RLS policies by design: anon/authenticated privileges are revoked; service_role-only access.';

revoke all on function public.handle_new_voclab_user() from public, anon, authenticated;
grant execute on function public.handle_new_voclab_user() to service_role;

drop function if exists public.consume_voclab_ai_quota();

create or replace function public.consume_voclab_ai_quota(p_user_id uuid)
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
  v_uid uuid := p_user_id;
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

revoke all on function public.consume_voclab_ai_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_voclab_ai_quota(uuid) to service_role;
