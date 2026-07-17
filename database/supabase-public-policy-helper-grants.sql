-- Allow public RLS policies to evaluate trusted boolean helper functions.
-- These helpers do not grant privileges; anonymous calls return false because auth.uid() is null.

BEGIN;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

COMMIT;
