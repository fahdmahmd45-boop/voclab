-- Bound cloud-synced state so a compromised client cannot grow one row without limit.
-- Current production rows are far below this threshold; 1 MiB leaves ample headroom for
-- legitimate vocabulary/progress data while preventing storage abuse.

alter table public.user_state
  drop constraint if exists user_state_state_size_check;

alter table public.user_state
  add constraint user_state_state_size_check
  check (octet_length(state::text) <= 1048576)
  not valid;

alter table public.user_state
  validate constraint user_state_state_size_check;
