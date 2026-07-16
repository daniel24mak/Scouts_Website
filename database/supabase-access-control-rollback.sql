-- Non-destructive access-control rollback.
-- Assignment, audit, migration, role, permission, and backfill data are preserved.

BEGIN;

UPDATE public.authorization_module_modes
SET mode = 'legacy', updated_at = now();

DO $$
BEGIN
  IF to_regprocedure('public.get_my_effective_access()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_my_effective_access() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_my_effective_access() FROM authenticated';
  END IF;
END $$;

COMMIT;
