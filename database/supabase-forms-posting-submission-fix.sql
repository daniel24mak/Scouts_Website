-- Incremental repair for form posting and draft submission.
-- Run after the Forms, reimbursement, registration, and security migrations.

BEGIN;

ALTER TABLE public.posted_forms
  ADD COLUMN IF NOT EXISTS form_kind text NOT NULL DEFAULT 'standard';

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT constraint_record.conname
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = 'public.posted_forms'::regclass
      AND constraint_record.contype = 'c'
      AND pg_get_constraintdef(constraint_record.oid) ILIKE '%form_kind%'
  LOOP
    EXECUTE format('ALTER TABLE public.posted_forms DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.posted_forms
  ADD CONSTRAINT posted_forms_form_kind_check
  CHECK (form_kind IN ('standard', 'reimbursement', 'scout_registration'));

DROP POLICY IF EXISTS "form submissions update own open forms" ON public.form_submissions;
CREATE POLICY "form submissions update own open forms" ON public.form_submissions
  FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid()
    AND public.can_fill_posted_form(posted_form_id)
    AND (
      status = 'draft'
      OR EXISTS (
        SELECT 1
        FROM public.posted_forms pf
        WHERE pf.id = posted_form_id
          AND pf.allow_edits
      )
    )
  )
  WITH CHECK (
    submitted_by = auth.uid()
    AND public.can_fill_posted_form(posted_form_id)
  );

COMMIT;
