-- Form response email delivery log.
-- Run once in the Supabase SQL editor before deploying send-form-response-email.

CREATE TABLE IF NOT EXISTS public.form_response_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('form_submission', 'scout_registration')),
  source_submission_id uuid NOT NULL,
  posted_form_id uuid REFERENCES public.posted_forms(id) ON DELETE SET NULL,
  recipient_email_hash text NOT NULL,
  recipient_email_masked text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent', 'failed')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS form_response_email_deliveries_submission_idx
  ON public.form_response_email_deliveries (source_type, source_submission_id);

CREATE INDEX IF NOT EXISTS form_response_email_deliveries_status_idx
  ON public.form_response_email_deliveries (status, created_at DESC);

ALTER TABLE public.form_response_email_deliveries ENABLE ROW LEVEL SECURITY;

-- Delivery writes and provider errors are server-only. The service-role client
-- used by the Edge Functions bypasses RLS; browser clients receive no access.
REVOKE ALL ON public.form_response_email_deliveries FROM anon, authenticated;
