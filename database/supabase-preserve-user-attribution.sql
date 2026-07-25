-- Preserve historical contributor attribution while allowing Auth users to be
-- permanently deleted and later re-invited with the same email address.
--
-- Run this once in the Supabase SQL editor before deploying the updated
-- delete-dashboard-user Edge Function.

BEGIN;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

UPDATE public.user_profiles profile
SET auth_user_id = profile.id
WHERE profile.auth_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM auth.users auth_user
    WHERE auth_user.id = profile.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_auth_user_id_key
  ON public.user_profiles (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- The profile id is the permanent attribution id. Remove only its old direct
-- dependency on auth.users; auth_user_id is the nullable login identity link.
DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT constraint_row.conname
    FROM pg_constraint constraint_row
    WHERE constraint_row.contype = 'f'
      AND constraint_row.conrelid = 'public.user_profiles'::regclass
      AND constraint_row.confrelid = 'auth.users'::regclass
      AND pg_get_constraintdef(constraint_row.oid) LIKE 'FOREIGN KEY (id)%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.user_profiles DROP CONSTRAINT %I',
      constraint_record.conname
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_auth_user_id_fkey'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_auth_user_id_fkey
      FOREIGN KEY (auth_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_user_profile_auth_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.auth_user_id IS NULL
    AND EXISTS (SELECT 1 FROM auth.users auth_user WHERE auth_user.id = NEW.id) THEN
    NEW.auth_user_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_profile_auth_identity_trigger
  ON public.user_profiles;
CREATE TRIGGER set_user_profile_auth_identity_trigger
BEFORE INSERT ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_user_profile_auth_identity();

REVOKE ALL ON FUNCTION public.set_user_profile_auth_identity()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.retire_dashboard_user(target_user_id uuid, reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  previous jsonb;
  saved jsonb;
BEGIN
  PERFORM public.require_people_access_permission('users.delete');
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot remove the account you are currently using.'
      USING ERRCODE = '22023';
  END IF;
  IF length(btrim(COALESCE(reason, ''))) < 8 THEN
    RAISE EXCEPTION 'An account-removal reason of at least 8 characters is required.'
      USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(profile)
  INTO previous
  FROM public.user_profiles profile
  WHERE profile.id = target_user_id
  FOR UPDATE;
  IF previous IS NULL THEN
    RAISE EXCEPTION 'The user no longer exists.' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.user_permission_overrides WHERE user_id = target_user_id;
  DELETE FROM public.user_team_memberships WHERE user_id = target_user_id;
  DELETE FROM public.user_group_assignments WHERE user_id = target_user_id;
  DELETE FROM public.user_role_assignments WHERE user_id = target_user_id;
  DELETE FROM public.user_permissions WHERE user_id = target_user_id;
  UPDATE public.equipe_leaders
  SET is_active = false
  WHERE chief_id = target_user_id AND is_active;

  -- Storage object ownership can prevent Supabase Auth hard deletion. The files
  -- remain in place and public content keeps its existing URLs.
  IF to_regclass('storage.objects') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'storage'
        AND table_name = 'objects'
        AND column_name = 'owner'
    ) THEN
    EXECUTE 'UPDATE storage.objects SET owner = NULL WHERE owner = $1'
      USING target_user_id;
  END IF;

  UPDATE public.user_profiles AS profile
  SET account_status = 'archived',
      auth_user_id = target_user_id,
      group_id = NULL,
      chief_level = NULL,
      is_coordinator = false,
      coordinator_group_ids = ARRAY[]::text[],
      can_publish = false,
      can_create_group_meetings = false,
      can_edit_scouts = false,
      manage_form_templates = false,
      view_all_forms = false,
      post_forms = false,
      updated_at = now()
  WHERE profile.id = target_user_id
  RETURNING to_jsonb(profile.*) INTO saved;

  PERFORM public.write_people_access_audit(
    'user_deleted',
    'User account',
    target_user_id::text,
    target_user_id,
    previous,
    saved,
    reason
  );
  RETURN saved;
END;
$$;

COMMIT;

