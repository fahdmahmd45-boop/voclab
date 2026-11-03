-- Review and apply with Supabase SQL Editor after confirming the app works.
-- RLS already limits access to own rows. This removes unnecessary table grants.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.user_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_state TO authenticated;
-- No anon access, no authenticated DELETE/TRUNCATE/REFERENCES/TRIGGER.
COMMIT;
