-- Scouting reimbursement forms backed by distinct Finance workflow records.
-- Run after supabase-schema.sql and supabase-finance-workflows.sql.

BEGIN;

ALTER TABLE public.posted_forms
  ADD COLUMN IF NOT EXISTS form_kind text NOT NULL DEFAULT 'standard'
    CHECK (form_kind IN ('standard', 'reimbursement')),
  ADD COLUMN IF NOT EXISTS allow_multiple_submissions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_submissions integer CHECK (max_submissions IS NULL OR max_submissions > 0),
  ADD COLUMN IF NOT EXISTS available_from timestamptz,
  ADD COLUMN IF NOT EXISTS available_until timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_required boolean NOT NULL DEFAULT false;

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.form_submissions'::regclass
    AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) ILIKE '%posted_form_id%submitted_by%'
  LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.form_submissions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS submission_number integer NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS form_submission_number_unique
  ON public.form_submissions(posted_form_id, submitted_by, submission_number);

ALTER TABLE public.finance_reimbursements
  ADD COLUMN IF NOT EXISTS posted_form_id uuid REFERENCES public.posted_forms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS form_submission_id uuid UNIQUE REFERENCES public.form_submissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_scheduled'
    CHECK (payment_status IN ('not_scheduled', 'scheduled', 'processing', 'paid', 'failed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS workflow_metadata jsonb NOT NULL DEFAULT '{}';

DROP POLICY IF EXISTS "claimants read own reimbursements" ON public.finance_reimbursements;
CREATE POLICY "claimants read own reimbursements" ON public.finance_reimbursements
  FOR SELECT TO authenticated USING (claimant_id = auth.uid());

CREATE OR REPLACE FUNCTION public.submit_reimbursement_form(
  target_form_id uuid,
  submitted_answers jsonb,
  claimant_group_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  target_form public.posted_forms%ROWTYPE;
  profile public.user_profiles%ROWTYPE;
  question jsonb;
  amount_question_id text;
  date_question_id text;
  description_question_id text;
  claim_amount numeric(14,2);
  claim_date date;
  claim_description text;
  existing_count integer;
  next_number integer;
  draft_submission public.form_submissions%ROWTYPE;
  saved_submission public.form_submissions%ROWTYPE;
  saved_claim public.finance_reimbursements%ROWTYPE;
BEGIN
  SELECT * INTO target_form FROM public.posted_forms WHERE id = target_form_id FOR UPDATE;
  IF target_form.id IS NULL OR target_form.form_kind <> 'reimbursement' OR target_form.status <> 'open' THEN
    RAISE EXCEPTION 'This reimbursement form is not available' USING ERRCODE = '42501';
  END IF;
  IF target_form.available_from IS NOT NULL AND now() < target_form.available_from
     OR target_form.available_until IS NOT NULL AND now() > target_form.available_until THEN
    RAISE EXCEPTION 'This reimbursement form is outside its availability period' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO profile FROM public.user_profiles WHERE id = auth.uid();
  IF profile.id IS NULL THEN RAISE EXCEPTION 'A dashboard profile is required' USING ERRCODE = '42501'; END IF;
  IF target_form.target_type = 'users' AND NOT auth.uid() = ANY(target_form.target_user_ids) THEN
    RAISE EXCEPTION 'You are not eligible for this reimbursement form' USING ERRCODE = '42501';
  END IF;
  IF target_form.target_type = 'groups' AND NOT profile.group_id = ANY(target_form.target_group_ids) THEN
    RAISE EXCEPTION 'Your group is not eligible for this reimbursement form' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO existing_count
  FROM public.form_submissions
  WHERE posted_form_id = target_form.id AND submitted_by = auth.uid() AND status IN ('submitted', 'edited', 'locked');
  SELECT * INTO draft_submission
  FROM public.form_submissions
  WHERE posted_form_id = target_form.id AND submitted_by = auth.uid() AND status = 'draft'
  ORDER BY updated_at DESC NULLS LAST LIMIT 1 FOR UPDATE;
  SELECT COALESCE(max(submission_number), 0) + 1 INTO next_number
  FROM public.form_submissions
  WHERE posted_form_id = target_form.id AND submitted_by = auth.uid();
  IF NOT target_form.allow_multiple_submissions AND existing_count > 0 THEN
    RAISE EXCEPTION 'This reimbursement form allows one submission per user' USING ERRCODE = '23505';
  END IF;
  IF target_form.max_submissions IS NOT NULL AND existing_count >= target_form.max_submissions THEN
    RAISE EXCEPTION 'The maximum number of reimbursements has been reached' USING ERRCODE = '23514';
  END IF;

  FOR question IN SELECT value FROM jsonb_array_elements(COALESCE(target_form.schema_json->'questions', '[]'::jsonb)) LOOP
    IF amount_question_id IS NULL AND question->>'type' = 'number' THEN amount_question_id := question->>'id'; END IF;
    IF date_question_id IS NULL AND question->>'type' = 'date' THEN date_question_id := question->>'id'; END IF;
    IF description_question_id IS NULL AND question->>'type' IN ('short_text', 'long_text') THEN description_question_id := question->>'id'; END IF;
  END LOOP;
  BEGIN claim_amount := NULLIF(submitted_answers->>amount_question_id, '')::numeric; EXCEPTION WHEN OTHERS THEN claim_amount := NULL; END;
  BEGIN claim_date := NULLIF(submitted_answers->>date_question_id, '')::date; EXCEPTION WHEN OTHERS THEN claim_date := NULL; END;
  claim_description := NULLIF(btrim(submitted_answers->>description_question_id), '');
  IF claim_amount IS NULL OR claim_amount <= 0 OR claim_date IS NULL OR claim_description IS NULL THEN
    RAISE EXCEPTION 'Reimbursement forms require a valid amount, purchase date, and description' USING ERRCODE = '23514';
  END IF;

  IF draft_submission.id IS NOT NULL THEN
    UPDATE public.form_submissions
    SET answers_json = COALESCE(submitted_answers, '{}'),
        group_id = COALESCE(claimant_group_id, profile.group_id),
        status = 'submitted', submitted_at = now(), updated_at = now()
    WHERE id = draft_submission.id
    RETURNING * INTO saved_submission;
  ELSE
    INSERT INTO public.form_submissions(posted_form_id, submitted_by, group_id, answers_json, status, submitted_at, submission_number)
    VALUES(target_form.id, auth.uid(), COALESCE(claimant_group_id, profile.group_id), COALESCE(submitted_answers, '{}'), 'submitted', now(), next_number)
    RETURNING * INTO saved_submission;
  END IF;

  INSERT INTO public.finance_reimbursements(
    reference_number, claimant_id, description, amount, expense_date, status, created_by,
    posted_form_id, form_submission_id, workflow_metadata
  ) VALUES(
    'REIM-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    auth.uid(), claim_description, claim_amount, claim_date, 'pending_approval', auth.uid(),
    target_form.id, saved_submission.id,
    jsonb_build_object('group_id', COALESCE(claimant_group_id, profile.group_id), 'form_title', target_form.title)
  ) RETURNING * INTO saved_claim;

  RETURN jsonb_build_object('submission', to_jsonb(saved_submission), 'reimbursement', to_jsonb(saved_claim));
END;
$$;

CREATE OR REPLACE FUNCTION public.save_reimbursement_form_draft(
  target_form_id uuid,
  submitted_answers jsonb,
  claimant_group_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  target_form public.posted_forms%ROWTYPE;
  profile public.user_profiles%ROWTYPE;
  draft_submission public.form_submissions%ROWTYPE;
  next_number integer;
BEGIN
  SELECT * INTO target_form FROM public.posted_forms WHERE id = target_form_id;
  IF target_form.id IS NULL OR target_form.form_kind <> 'reimbursement' OR target_form.status <> 'open' THEN
    RAISE EXCEPTION 'This reimbursement form is not available' USING ERRCODE = '42501';
  END IF;
  IF target_form.available_from IS NOT NULL AND now() < target_form.available_from
     OR target_form.available_until IS NOT NULL AND now() > target_form.available_until THEN
    RAISE EXCEPTION 'This reimbursement form is outside its availability period' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO profile FROM public.user_profiles WHERE id = auth.uid();
  IF profile.id IS NULL THEN RAISE EXCEPTION 'A dashboard profile is required' USING ERRCODE = '42501'; END IF;
  IF target_form.target_type = 'users' AND NOT auth.uid() = ANY(target_form.target_user_ids) THEN
    RAISE EXCEPTION 'You are not eligible for this reimbursement form' USING ERRCODE = '42501';
  END IF;
  IF target_form.target_type = 'groups' AND NOT profile.group_id = ANY(target_form.target_group_ids) THEN
    RAISE EXCEPTION 'Your group is not eligible for this reimbursement form' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO draft_submission
  FROM public.form_submissions
  WHERE posted_form_id = target_form.id AND submitted_by = auth.uid() AND status = 'draft'
  ORDER BY updated_at DESC NULLS LAST LIMIT 1 FOR UPDATE;

  IF draft_submission.id IS NOT NULL THEN
    UPDATE public.form_submissions
    SET answers_json = COALESCE(submitted_answers, '{}'),
        group_id = COALESCE(claimant_group_id, profile.group_id), updated_at = now()
    WHERE id = draft_submission.id
    RETURNING * INTO draft_submission;
  ELSE
    SELECT COALESCE(max(submission_number), 0) + 1 INTO next_number
    FROM public.form_submissions
    WHERE posted_form_id = target_form.id AND submitted_by = auth.uid();
    INSERT INTO public.form_submissions(posted_form_id, submitted_by, group_id, answers_json, status, submission_number)
    VALUES(target_form.id, auth.uid(), COALESCE(claimant_group_id, profile.group_id), COALESCE(submitted_answers, '{}'), 'draft', next_number)
    RETURNING * INTO draft_submission;
  END IF;

  RETURN to_jsonb(draft_submission);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_reimbursement_form(uuid,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_reimbursement_form(uuid,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION public.save_reimbursement_form_draft(uuid,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_reimbursement_form_draft(uuid,jsonb,text) TO authenticated;

COMMIT;
