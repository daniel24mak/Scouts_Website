-- Scout Registration system for the existing Forms platform.
-- Run after supabase-schema.sql and the normalized access-control migrations.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

INSERT INTO public.permissions (id, description, module, action, risk_level, requires_mfa, is_active)
VALUES
  ('registration.campaigns.manage', 'Create and manage scout registration campaigns', 'registration', 'campaigns.manage', 'elevated', false, true),
  ('registration.center.view', 'View the registration center', 'registration', 'center.view', 'elevated', false, true),
  ('registration.verify', 'Verify registrations for an assigned group', 'registration', 'verify', 'high', true, true),
  ('registration.approve', 'Approve registrations and enroll scouts', 'registration', 'approve', 'high', true, true),
  ('registration.manage_all_groups', 'Manage registration for every scout group', 'registration', 'manage_all_groups', 'high', true, true),
  ('registration.export', 'Export non-document registration data', 'registration', 'export', 'elevated', false, true),
  ('registration.retention.manage', 'Run protected registration retention workflows', 'registration', 'retention.manage', 'high', true, true),
  ('identity_documents.view', 'Reveal protected identity documents', 'registration', 'identity_documents.view', 'high', true, true),
  ('identity_documents.verify', 'Verify protected identity documents', 'registration', 'identity_documents.verify', 'high', true, true),
  ('registration.storage.view', 'View registration storage usage', 'registration', 'storage.view', 'elevated', false, true)
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  risk_level = EXCLUDED.risk_level,
  requires_mfa = EXCLUDED.requires_mfa,
  is_active = true;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'system_administrator', permission.id
FROM public.permissions permission
WHERE permission.module = 'registration'
  AND EXISTS (SELECT 1 FROM public.roles role WHERE role.id = 'system_administrator')
ON CONFLICT DO NOTHING;

-- The scoped Chief role supplies registration permissions. The group guard below
-- still limits operational access to head chiefs, vice chiefs, and coordinators.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'chief', permission_id
FROM (
  VALUES
    ('registration.center.view'),
    ('registration.verify'),
    ('identity_documents.view'),
    ('identity_documents.verify')
) AS registration_permissions(permission_id)
WHERE EXISTS (SELECT 1 FROM public.roles role WHERE role.id = 'chief')
ON CONFLICT DO NOTHING;

ALTER TABLE public.posted_forms
  ADD COLUMN IF NOT EXISTS form_kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS public_slug text,
  ADD COLUMN IF NOT EXISTS public_access_enabled boolean NOT NULL DEFAULT false;

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

CREATE UNIQUE INDEX IF NOT EXISTS posted_forms_public_slug_unique
  ON public.posted_forms (lower(public_slug))
  WHERE public_slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.registration_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_form_id uuid NOT NULL UNIQUE REFERENCES public.posted_forms(id) ON DELETE CASCADE,
  scout_year_id uuid NOT NULL REFERENCES public.scout_years(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','open','closed','archived')),
  returning_enabled boolean NOT NULL DEFAULT true,
  new_enabled boolean NOT NULL DEFAULT false,
  returning_opens_at timestamptz,
  new_opens_at timestamptz,
  closes_at timestamptz,
  show_opening_date boolean NOT NULL DEFAULT true,
  new_scout_waitlist boolean NOT NULL DEFAULT false,
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  accepted_group_ids text[] NOT NULL DEFAULT '{}',
  minimum_age integer CHECK (minimum_age IS NULL OR minimum_age >= 0),
  maximum_age integer CHECK (maximum_age IS NULL OR maximum_age >= minimum_age),
  birth_year_from integer,
  birth_year_to integer,
  require_headshot boolean NOT NULL DEFAULT true,
  require_id_front boolean NOT NULL DEFAULT true,
  require_id_back boolean NOT NULL DEFAULT false,
  require_verification boolean NOT NULL DEFAULT true,
  require_parent_verification boolean NOT NULL DEFAULT true,
  allow_drafts boolean NOT NULL DEFAULT true,
  privacy_text text NOT NULL DEFAULT '',
  consent_text text NOT NULL DEFAULT '',
  retention_text text NOT NULL DEFAULT '',
  retention_days integer CHECK (retention_days IS NULL OR retention_days >= 1),
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK (closes_at IS NULL OR returning_opens_at IS NULL OR closes_at > returning_opens_at),
  CHECK (closes_at IS NULL OR new_opens_at IS NULL OR closes_at > new_opens_at)
);

ALTER TABLE public.registration_campaigns
  DROP CONSTRAINT IF EXISTS registration_campaigns_status_check;
ALTER TABLE public.registration_campaigns
  ADD CONSTRAINT registration_campaigns_status_check CHECK (
    status IN (
      'draft','scheduled','open','paused','closed','verification_in_progress',
      'ready_for_season','completed','archived'
    )
  );

CREATE TABLE IF NOT EXISTS public.registration_parent_verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.registration_campaigns(id) ON DELETE CASCADE,
  scout_id uuid REFERENCES public.scouts(id) ON DELETE SET NULL,
  destination_hash text NOT NULL,
  code_hash text,
  attempt_count integer NOT NULL DEFAULT 0,
  verified_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS public.scout_registration_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.registration_campaigns(id) ON DELETE CASCADE,
  registration_path text NOT NULL CHECK (registration_path IN ('returning','new')),
  resume_token_hash text NOT NULL UNIQUE,
  answers_json jsonb NOT NULL DEFAULT '{}',
  current_page_id text,
  matched_scout_id uuid REFERENCES public.scouts(id) ON DELETE SET NULL,
  parent_verification_id uuid REFERENCES public.registration_parent_verification_challenges(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scout_registration_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text NOT NULL UNIQUE DEFAULT ('REG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  campaign_id uuid NOT NULL REFERENCES public.registration_campaigns(id) ON DELETE RESTRICT,
  registration_path text NOT NULL CHECK (registration_path IN ('returning','new')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted','manual_match','duplicate_review','pending_group_verification',
    'needs_changes','verified','approved','waitlisted','rejected','enrolled','archived'
  )),
  target_group_id text REFERENCES public.groups(id) ON DELETE SET NULL,
  matched_scout_id uuid REFERENCES public.scouts(id) ON DELETE SET NULL,
  parent_verification_id uuid REFERENCES public.registration_parent_verification_challenges(id) ON DELETE SET NULL,
  answers_json jsonb NOT NULL DEFAULT '{}',
  source_snapshot_json jsonb NOT NULL DEFAULT '{}',
  classification_json jsonb NOT NULL DEFAULT '{}',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  enrolled_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.scout_registration_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE REFERENCES public.scout_registration_submissions(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  date_of_birth date,
  gender text,
  school_name text,
  school_grade text,
  calculated_age integer,
  requested_group_id text REFERENCES public.groups(id) ON DELETE SET NULL,
  historical_group_id text REFERENCES public.groups(id) ON DELETE SET NULL,
  identity_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scout_registration_parent_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.scout_registration_submissions(id) ON DELETE CASCADE,
  relationship text NOT NULL CHECK (relationship IN ('father','mother','guardian','other')),
  full_name text NOT NULL,
  phone text,
  email text,
  contact_fingerprint text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scout_registration_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES public.scout_registration_submissions(id) ON DELETE CASCADE,
  draft_id uuid REFERENCES public.scout_registration_drafts(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  bucket_id text NOT NULL CHECK (bucket_id IN ('scout-headshots','identity-documents','form-attachments')),
  object_path text NOT NULL UNIQUE,
  document_type text NOT NULL CHECK (document_type IN ('headshot','identity_front','identity_back','attachment','pdf_original','pdf_preview')),
  original_format text NOT NULL,
  processed_format text,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  width integer,
  height integer,
  page_number integer,
  original_document_id uuid REFERENCES public.scout_registration_documents(id) ON DELETE CASCADE,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending','processed','failed','quarantined')),
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected','deleted')),
  content_hash text,
  metadata_json jsonb NOT NULL DEFAULT '{}',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  verified_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  deletion_reason text,
  CHECK ((submission_id IS NOT NULL) <> (draft_id IS NOT NULL)),
  CHECK (object_path ~ '^[0-9a-f-]+/[0-9a-f-]+(?:/[0-9a-f-]+)*\.[a-z0-9]+$')
);

CREATE TABLE IF NOT EXISTS public.scout_registration_duplicate_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.scout_registration_submissions(id) ON DELETE CASCADE,
  candidate_scout_id uuid NOT NULL REFERENCES public.scouts(id) ON DELETE RESTRICT,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  classification text NOT NULL CHECK (classification IN ('low','medium','high')),
  reasons_json jsonb NOT NULL DEFAULT '[]',
  decision text CHECK (decision IN ('same_person','different_person','defer')),
  decided_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, candidate_scout_id)
);

CREATE TABLE IF NOT EXISTS public.scout_registration_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.scout_registration_submissions(id) ON DELETE CASCADE,
  review_type text NOT NULL CHECK (review_type IN ('manual_match','group_verification','identity_document','duplicate','approval','enrollment','retention')),
  decision text NOT NULL CHECK (decision IN ('approved','rejected','needs_changes','matched','not_matched','verified','deleted')),
  group_id text REFERENCES public.groups(id) ON DELETE SET NULL,
  comment text,
  previous_values jsonb NOT NULL DEFAULT '{}',
  new_values jsonb NOT NULL DEFAULT '{}',
  reviewed_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scout_registration_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.scout_registration_submissions(id) ON DELETE CASCADE,
  consent_version text NOT NULL,
  consent_text_hash text NOT NULL,
  accepted boolean NOT NULL CHECK (accepted),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  signer_name text NOT NULL,
  relationship text,
  request_fingerprint text
);

CREATE TABLE IF NOT EXISTS public.scout_season_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id uuid NOT NULL REFERENCES public.scouts(id) ON DELETE RESTRICT,
  scout_year_id uuid NOT NULL REFERENCES public.scout_years(id) ON DELETE RESTRICT,
  registration_submission_id uuid UNIQUE REFERENCES public.scout_registration_submissions(id) ON DELETE SET NULL,
  group_id text REFERENCES public.groups(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','waitlisted','withdrawn','archived')),
  enrolled_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scout_id, scout_year_id)
);

CREATE TABLE IF NOT EXISTS public.registration_retention_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.registration_campaigns(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','running','completed','failed','cancelled')),
  eligible_before timestamptz NOT NULL,
  document_count integer NOT NULL DEFAULT 0,
  requested_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  completed_at timestamptz,
  result_json jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.registration_document_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.scout_registration_documents(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL REFERENCES public.scout_registration_submissions(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('reveal','download','verify','reject','delete')),
  purpose text NOT NULL,
  request_id text,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.registration_request_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_fingerprint text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS registration_request_limits_lookup_idx
  ON public.registration_request_limits (request_fingerprint, action, created_at DESC);

CREATE INDEX IF NOT EXISTS registration_campaigns_year_status_idx ON public.registration_campaigns (scout_year_id, status);
CREATE INDEX IF NOT EXISTS registration_submissions_campaign_status_idx ON public.scout_registration_submissions (campaign_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS registration_submissions_group_status_idx ON public.scout_registration_submissions (target_group_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS registration_people_identity_idx ON public.scout_registration_people (identity_fingerprint) WHERE identity_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS registration_parent_contact_idx ON public.scout_registration_parent_contacts (contact_fingerprint) WHERE contact_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS registration_documents_submission_idx ON public.scout_registration_documents (submission_id, verification_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS registration_duplicates_pending_idx ON public.scout_registration_duplicate_matches (submission_id, classification) WHERE decision IS NULL;
CREATE INDEX IF NOT EXISTS season_enrollments_year_group_idx ON public.scout_season_enrollments (scout_year_id, group_id, status);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('scout-headshots', 'scout-headshots', false, 12582912, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('identity-documents', 'identity-documents', false, 20971520, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']),
  ('form-attachments', 'form-attachments', false, 20971520, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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

CREATE OR REPLACE FUNCTION public.get_public_registration_campaign(target_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', campaign.id,
    'title', campaign.title,
    'slug', campaign.slug,
    'status', campaign.status,
    'returningEnabled', campaign.returning_enabled,
    'newEnabled', campaign.new_enabled,
    'returningOpensAt', campaign.returning_opens_at,
    'newOpensAt', campaign.new_opens_at,
    'closesAt', campaign.closes_at,
    'showOpeningDate', campaign.show_opening_date,
    'newScoutWaitlist', campaign.new_scout_waitlist,
    'capacity', campaign.capacity,
    'acceptedGroupIds', campaign.accepted_group_ids,
    'acceptedGroups', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', group_item.id, 'name', group_item.name) ORDER BY group_item.name), '[]'::jsonb)
      FROM public.groups group_item
      WHERE group_item.id = ANY(campaign.accepted_group_ids)
    ),
    'minimumAge', campaign.minimum_age,
    'maximumAge', campaign.maximum_age,
    'birthYearFrom', campaign.birth_year_from,
    'birthYearTo', campaign.birth_year_to,
    'requireHeadshot', campaign.require_headshot,
    'requireIdFront', campaign.require_id_front,
    'requireIdBack', campaign.require_id_back,
    'requireVerification', campaign.require_verification,
    'requireParentVerification', campaign.require_parent_verification,
    'allowDrafts', campaign.allow_drafts,
    'privacyText', campaign.privacy_text,
    'consentText', campaign.consent_text,
    'retentionText', campaign.retention_text,
    'approvedCount', (
      SELECT count(*) FROM public.scout_registration_submissions submission
      WHERE submission.campaign_id = campaign.id AND submission.status IN ('approved','enrolled')
    ),
    'form', jsonb_build_object(
      'id', form.id,
      'title', form.title,
      'description', form.description,
      'instructions', form.instructions,
      'schemaJson', form.schema_json
    )
  )
  FROM public.registration_campaigns campaign
  JOIN public.posted_forms form ON form.id = campaign.posted_form_id
  WHERE lower(campaign.slug) = lower(btrim(target_slug))
    AND campaign.status IN ('scheduled','open','paused','closed','verification_in_progress','ready_for_season')
    AND form.public_access_enabled = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.list_public_registration_campaigns()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'title', campaign.title,
    'slug', campaign.slug,
    'status', campaign.status,
    'returningEnabled', campaign.returning_enabled,
    'newEnabled', campaign.new_enabled,
    'returningOpensAt', campaign.returning_opens_at,
    'newOpensAt', campaign.new_opens_at,
    'closesAt', campaign.closes_at,
    'showOpeningDate', campaign.show_opening_date
  ) ORDER BY campaign.created_at DESC), '[]'::jsonb)
  FROM public.registration_campaigns campaign
  JOIN public.posted_forms form ON form.id = campaign.posted_form_id
  WHERE campaign.status IN ('scheduled','open')
    AND form.public_access_enabled = true;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_scout_registration(
  target_slug text,
  registration_path text,
  submission_payload jsonb,
  consent_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  campaign public.registration_campaigns%ROWTYPE;
  saved_submission public.scout_registration_submissions%ROWTYPE;
  verified_scout_id uuid;
  person jsonb := COALESCE(submission_payload -> 'person', '{}'::jsonb);
  parent jsonb;
  approved_count integer;
  initial_status text := 'submitted';
  consent_text_hash text;
BEGIN
  IF registration_path NOT IN ('returning','new') THEN
    RAISE EXCEPTION 'Invalid registration path' USING ERRCODE = '22023';
  END IF;

  SELECT item.* INTO campaign
  FROM public.registration_campaigns item
  JOIN public.posted_forms form ON form.id = item.posted_form_id
  WHERE lower(item.slug) = lower(btrim(target_slug))
    AND item.status IN ('scheduled','open')
    AND form.public_access_enabled = true
  FOR UPDATE OF item;

  IF campaign.id IS NULL THEN
    RAISE EXCEPTION 'Registration is not available' USING ERRCODE = 'P0002';
  END IF;
  IF campaign.closes_at IS NOT NULL AND now() > campaign.closes_at THEN
    RAISE EXCEPTION 'Registration is closed' USING ERRCODE = 'P0002';
  END IF;
  IF registration_path = 'returning' AND (NOT campaign.returning_enabled OR (campaign.returning_opens_at IS NOT NULL AND now() < campaign.returning_opens_at)) THEN
    RAISE EXCEPTION 'Returning registration is not open' USING ERRCODE = 'P0002';
  END IF;
  IF registration_path = 'new' AND (NOT campaign.new_enabled OR (campaign.new_opens_at IS NOT NULL AND now() < campaign.new_opens_at)) THEN
    RAISE EXCEPTION 'New registration is not open' USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE((consent_payload ->> 'accepted')::boolean, false) IS NOT TRUE OR length(btrim(consent_payload ->> 'signerName')) = 0 THEN
    RAISE EXCEPTION 'Consent is required' USING ERRCODE = '23514';
  END IF;
  IF registration_path = 'returning'
    AND length(btrim(COALESCE(person ->> 'fullName', ''))) > 0
  THEN
    SELECT challenge.scout_id INTO verified_scout_id
    FROM public.registration_parent_verification_challenges challenge
    WHERE challenge.id = NULLIF(submission_payload ->> 'parentVerificationId', '')::uuid
      AND challenge.campaign_id = campaign.id
      AND challenge.verified_at IS NOT NULL
      AND challenge.expires_at > now();

    IF campaign.require_parent_verification AND verified_scout_id IS NULL THEN
      RAISE EXCEPTION 'Parent verification is required' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT count(*) INTO approved_count
  FROM public.scout_registration_submissions item
  WHERE item.campaign_id = campaign.id AND item.status IN ('approved','enrolled');
  IF registration_path = 'new' AND campaign.capacity IS NOT NULL AND approved_count >= campaign.capacity THEN
    IF campaign.new_scout_waitlist THEN initial_status := 'waitlisted';
    ELSE RAISE EXCEPTION 'Registration capacity has been reached' USING ERRCODE = 'P0002';
    END IF;
  ELSIF campaign.require_verification THEN
    initial_status := CASE WHEN registration_path = 'returning'
      AND length(btrim(COALESCE(person ->> 'fullName', ''))) > 0
      AND verified_scout_id IS NULL
      THEN 'manual_match' ELSE 'pending_group_verification' END;
  END IF;

  INSERT INTO public.scout_registration_submissions (
    campaign_id, registration_path, status, target_group_id, matched_scout_id,
    parent_verification_id, answers_json, source_snapshot_json
  ) VALUES (
    campaign.id,
    registration_path,
    initial_status,
    NULLIF(person ->> 'requestedGroupId', ''),
    verified_scout_id,
    NULLIF(submission_payload ->> 'parentVerificationId', '')::uuid,
    COALESCE(submission_payload -> 'answers', '{}'::jsonb),
    COALESCE(submission_payload -> 'sourceSnapshot', '{}'::jsonb)
  ) RETURNING * INTO saved_submission;

  IF length(btrim(COALESCE(person ->> 'fullName', ''))) > 0 THEN
    INSERT INTO public.scout_registration_people (
      submission_id, full_name, date_of_birth, gender, school_name, school_grade,
      calculated_age, requested_group_id, historical_group_id, identity_fingerprint
    ) VALUES (
      saved_submission.id,
      btrim(person ->> 'fullName'),
      NULLIF(person ->> 'dateOfBirth', '')::date,
      NULLIF(person ->> 'gender', ''),
      NULLIF(person ->> 'schoolName', ''),
      NULLIF(person ->> 'schoolGrade', ''),
      NULLIF(person ->> 'calculatedAge', '')::integer,
      NULLIF(person ->> 'requestedGroupId', ''),
      NULLIF(person ->> 'historicalGroupId', ''),
      NULLIF(person ->> 'identityFingerprint', '')
    );
  END IF;

  FOR parent IN SELECT * FROM jsonb_array_elements(COALESCE(submission_payload -> 'parents', '[]'::jsonb))
  LOOP
    INSERT INTO public.scout_registration_parent_contacts (
      submission_id, relationship, full_name, phone, email, contact_fingerprint, is_primary
    ) VALUES (
      saved_submission.id,
      COALESCE(NULLIF(parent ->> 'relationship', ''), 'guardian'),
      btrim(parent ->> 'fullName'),
      NULLIF(parent ->> 'phone', ''),
      NULLIF(parent ->> 'email', ''),
      NULLIF(parent ->> 'contactFingerprint', ''),
      COALESCE((parent ->> 'isPrimary')::boolean, false)
    );
  END LOOP;

  consent_text_hash := encode(digest(campaign.consent_text, 'sha256'), 'hex');
  INSERT INTO public.scout_registration_consents (
    submission_id, consent_version, consent_text_hash, accepted, signer_name, relationship, request_fingerprint
  ) VALUES (
    saved_submission.id,
    COALESCE(NULLIF(consent_payload ->> 'version', ''), '1'),
    consent_text_hash,
    true,
    btrim(consent_payload ->> 'signerName'),
    NULLIF(consent_payload ->> 'relationship', ''),
    NULLIF(consent_payload ->> 'requestFingerprint', '')
  );

  RETURN jsonb_build_object('referenceNumber', saved_submission.reference_number, 'status', saved_submission.status);
END;
$$;

ALTER TABLE public.registration_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_parent_verification_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_registration_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_registration_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_registration_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_registration_parent_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_registration_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_registration_duplicate_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_registration_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_registration_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_season_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_retention_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_document_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_request_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "registration campaigns managed" ON public.registration_campaigns;
CREATE POLICY "registration campaigns managed" ON public.registration_campaigns
  FOR ALL TO authenticated
  USING (public.has_permission('registration.campaigns.manage'))
  WITH CHECK (public.has_permission('registration.campaigns.manage'));
DROP POLICY IF EXISTS "registration submissions reviewed" ON public.scout_registration_submissions;
CREATE POLICY "registration submissions reviewed" ON public.scout_registration_submissions
  FOR SELECT TO authenticated
  USING (public.can_manage_registration_group(target_group_id));
DROP POLICY IF EXISTS "registration people follow submission" ON public.scout_registration_people;
CREATE POLICY "registration people follow submission" ON public.scout_registration_people
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.scout_registration_submissions submission
    WHERE submission.id = submission_id
      AND public.can_manage_registration_group(submission.target_group_id)
  ));
DROP POLICY IF EXISTS "registration parents follow submission" ON public.scout_registration_parent_contacts;
CREATE POLICY "registration parents follow submission" ON public.scout_registration_parent_contacts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.scout_registration_submissions submission
    WHERE submission.id = submission_id
      AND public.can_manage_registration_group(submission.target_group_id)
  ));
DROP POLICY IF EXISTS "registration documents metadata reviewed" ON public.scout_registration_documents;
CREATE POLICY "registration documents metadata reviewed" ON public.scout_registration_documents
  FOR SELECT TO authenticated
  USING (submission_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.scout_registration_submissions submission
    WHERE submission.id = submission_id AND public.can_manage_registration_group(submission.target_group_id)
  ));
DROP POLICY IF EXISTS "registration duplicates reviewed" ON public.scout_registration_duplicate_matches;
CREATE POLICY "registration duplicates reviewed" ON public.scout_registration_duplicate_matches
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.scout_registration_submissions submission
    WHERE submission.id = submission_id
      AND public.can_manage_registration_group(submission.target_group_id)
  ));
DROP POLICY IF EXISTS "registration reviews visible" ON public.scout_registration_reviews;
CREATE POLICY "registration reviews visible" ON public.scout_registration_reviews
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.scout_registration_submissions submission
    WHERE submission.id = submission_id
      AND public.can_manage_registration_group(submission.target_group_id)
  ));
DROP POLICY IF EXISTS "season enrollments visible" ON public.scout_season_enrollments;
CREATE POLICY "season enrollments visible" ON public.scout_season_enrollments
  FOR SELECT TO authenticated
  USING (public.has_permission('scouts.view') AND public.can_manage_registration_group(group_id));
DROP POLICY IF EXISTS "retention jobs managed" ON public.registration_retention_jobs;
CREATE POLICY "retention jobs managed" ON public.registration_retention_jobs
  FOR ALL TO authenticated
  USING (public.has_permission('registration.retention.manage'))
  WITH CHECK (public.has_permission('registration.retention.manage'));
DROP POLICY IF EXISTS "document access logs visible" ON public.registration_document_access_logs;
CREATE POLICY "document access logs visible" ON public.registration_document_access_logs
  FOR SELECT TO authenticated
  USING (public.has_permission('audit_logs.view'));

CREATE OR REPLACE FUNCTION public.get_registration_storage_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used_bytes bigint;
  document_count bigint;
  largest_document_bytes bigint;
  capacity_bytes constant bigint := 1073741824;
BEGIN
  IF NOT public.has_permission('registration.storage.view') THEN
    RAISE EXCEPTION 'You do not have permission to view registration storage usage'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(sum(document.size_bytes), 0),
    count(*),
    COALESCE(max(document.size_bytes), 0)
  INTO used_bytes, document_count, largest_document_bytes
  FROM public.scout_registration_documents document
  WHERE document.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'usedBytes', used_bytes,
    'capacityBytes', capacity_bytes,
    'documentCount', document_count,
    'averageDocumentBytes', CASE WHEN document_count = 0 THEN 0 ELSE used_bytes / document_count END,
    'largestDocumentBytes', largest_document_bytes,
    'usagePercent', round((used_bytes::numeric / capacity_bytes::numeric) * 100, 2)
  );
END;
$$;

REVOKE ALL ON TABLE
  public.registration_campaigns,
  public.registration_parent_verification_challenges,
  public.scout_registration_drafts,
  public.scout_registration_submissions,
  public.scout_registration_people,
  public.scout_registration_parent_contacts,
  public.scout_registration_documents,
  public.scout_registration_duplicate_matches,
  public.scout_registration_reviews,
  public.scout_registration_consents,
  public.scout_season_enrollments,
  public.registration_retention_jobs,
  public.registration_document_access_logs
  ,public.registration_request_limits
FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_registration_campaign(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_registration_campaigns() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_scout_registration(text,text,jsonb,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_registration_group(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registration_storage_summary() TO authenticated;

-- Registration buckets intentionally have no anon/authenticated storage.objects
-- policies. Upload and signed reveal operations are performed by the reviewed
-- registration Edge Function after permission, content, and path validation.

COMMIT;
