-- Incremental repair for public scout registration submissions.
-- Safe to run after database/supabase-scout-registration.sql.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER FUNCTION public.submit_public_scout_registration(text, text, jsonb, jsonb)
  SET search_path TO public, extensions;

COMMIT;

-- Queue visibility is read-only and must not require the AAL2 permission used
-- for verification and approval actions.
CREATE OR REPLACE FUNCTION public.can_manage_registration_group(target_group_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission('registration.center.view')
    OR (
      target_group_id IS NOT NULL
      AND public.has_permission_for_group('registration.verify', target_group_id)
      AND EXISTS (
        SELECT 1
        FROM public.user_group_assignments assignment
        WHERE assignment.user_id = auth.uid()
          AND assignment.group_id = target_group_id
          AND assignment.position IN ('head_chief', 'vice_chief', 'coordinator')
          AND assignment.starts_at <= now()
          AND (assignment.expires_at IS NULL OR assignment.expires_at > now())
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_registration_group(text) TO authenticated;

-- Registration reviewers need safe document metadata in the review queue at AAL1.
-- The private object itself remains protected by the MFA-gated reveal Edge Function.
DROP POLICY IF EXISTS "registration documents metadata reviewed" ON public.scout_registration_documents;
CREATE POLICY "registration documents metadata reviewed" ON public.scout_registration_documents
  FOR SELECT TO authenticated
  USING (submission_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.scout_registration_submissions submission
    WHERE submission.id = submission_id
      AND public.can_manage_registration_group(submission.target_group_id)
  ));
