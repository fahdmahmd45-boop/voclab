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
