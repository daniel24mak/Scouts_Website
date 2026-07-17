-- Finance workflow records: budgets, purchasing, reimbursements, collections, and reconciliation.
-- Run after supabase-finance-core.sql and supabase-workflow-engine.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.finance_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  fiscal_year integer NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 9999),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','active','closed','rejected','cancelled')),
  group_id text REFERENCES public.groups(id) ON DELETE SET NULL,
  fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, fiscal_year, group_id)
);

CREATE TABLE IF NOT EXISTS public.finance_budget_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.finance_budgets(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','superseded','rejected')),
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (budget_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.finance_budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_version_id uuid NOT NULL REFERENCES public.finance_budget_versions(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.finance_categories(id) ON DELETE RESTRICT,
  fund_id uuid REFERENCES public.finance_funds(id) ON DELETE SET NULL,
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  committed_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (committed_amount >= 0),
  spent_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text UNIQUE,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text NOT NULL DEFAULT '',
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'AED' CHECK (currency = 'AED'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','changes_requested','approved','ordered','received','paid','rejected','cancelled')),
  budget_line_id uuid REFERENCES public.finance_budget_lines(id) ON DELETE SET NULL,
  supplier_name text,
  needed_by date,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  journal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_reimbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text UNIQUE,
  claimant_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'AED' CHECK (currency = 'AED'),
  expense_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','changes_requested','approved','scheduled','paid','rejected','cancelled')),
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  journal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text UNIQUE,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text NOT NULL DEFAULT '',
  expected_amount numeric(14,2) NOT NULL CHECK (expected_amount > 0),
  collected_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (collected_amount >= 0),
  refunded_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  waived_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (waived_amount >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','partially_collected','collected','reconciled','cancelled')),
  due_on date,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  journal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (collected_amount + waived_amount <= expected_amount),
  CHECK (refunded_amount <= collected_amount)
);

CREATE TABLE IF NOT EXISTS public.finance_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  period_end date NOT NULL,
  statement_balance numeric(14,2) NOT NULL,
  ledger_balance numeric(14,2) NOT NULL,
  difference numeric(14,2) GENERATED ALWAYS AS (statement_balance - ledger_balance) STORED,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_review','reconciled','needs_review','rejected')),
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  UNIQUE (account_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS finance_budgets_status_year_idx ON public.finance_budgets(status, fiscal_year DESC);
CREATE INDEX IF NOT EXISTS finance_budget_lines_version_idx ON public.finance_budget_lines(budget_version_id);
CREATE INDEX IF NOT EXISTS finance_purchase_requests_status_idx ON public.finance_purchase_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS finance_reimbursements_status_idx ON public.finance_reimbursements(status, created_at DESC);
CREATE INDEX IF NOT EXISTS finance_collections_status_idx ON public.finance_collections(status, due_on);
CREATE INDEX IF NOT EXISTS finance_reconciliations_status_idx ON public.finance_reconciliations(status, period_end DESC);

CREATE OR REPLACE FUNCTION public.transition_finance_request(target_type text, target_id uuid, target_status text, reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE current_status text; creator uuid; saved jsonb;
BEGIN
  IF NOT public.has_permission('finance.transactions.approve') AND NOT public.has_permission('finance.transactions.post') THEN
    RAISE EXCEPTION 'Finance workflow transition is not permitted' USING ERRCODE='42501';
  END IF;
  IF target_type = 'purchase_request' THEN
    SELECT status, created_by INTO current_status, creator FROM public.finance_purchase_requests WHERE id=target_id FOR UPDATE;
  ELSIF target_type = 'reimbursement' THEN
    SELECT status, created_by INTO current_status, creator FROM public.finance_reimbursements WHERE id=target_id FOR UPDATE;
  ELSIF target_type = 'reconciliation' THEN
    SELECT status, created_by INTO current_status, creator FROM public.finance_reconciliations WHERE id=target_id FOR UPDATE;
  ELSE RAISE EXCEPTION 'Unsupported finance workflow type' USING ERRCODE='22023'; END IF;
  IF creator IS NULL THEN RAISE EXCEPTION 'Finance workflow record was not found' USING ERRCODE='P0002'; END IF;
  IF creator = auth.uid() AND target_status IN ('approved','reconciled','paid') THEN
    RAISE EXCEPTION 'The creator cannot approve, reconcile, or pay their own request' USING ERRCODE='42501';
  END IF;
  IF target_status = 'paid' AND NOT public.has_permission('finance.transactions.post') THEN
    RAISE EXCEPTION 'Posting permission is required to mark a request paid' USING ERRCODE='42501';
  END IF;
  IF (current_status, target_status) NOT IN (('draft','pending_approval'),('changes_requested','pending_approval'),('pending_approval','approved'),('pending_approval','changes_requested'),('pending_approval','rejected'),('approved','scheduled'),('approved','paid'),('scheduled','paid'),('draft','pending_review'),('pending_review','reconciled'),('pending_review','needs_review'),('pending_review','rejected')) THEN
    RAISE EXCEPTION 'Illegal finance workflow transition' USING ERRCODE='23514';
  END IF;
  IF target_type = 'purchase_request' THEN
    UPDATE public.finance_purchase_requests SET status=target_status, approved_by=CASE WHEN target_status='approved' THEN auth.uid() ELSE approved_by END, approved_at=CASE WHEN target_status='approved' THEN now() ELSE approved_at END, updated_at=now() WHERE id=target_id RETURNING to_jsonb(finance_purchase_requests.*) INTO saved;
  ELSIF target_type = 'reimbursement' THEN
    UPDATE public.finance_reimbursements SET status=target_status, approved_by=CASE WHEN target_status='approved' THEN auth.uid() ELSE approved_by END, approved_at=CASE WHEN target_status='approved' THEN now() ELSE approved_at END, updated_at=now() WHERE id=target_id RETURNING to_jsonb(finance_reimbursements.*) INTO saved;
  ELSE
    UPDATE public.finance_reconciliations SET status=target_status, reviewed_by=auth.uid(), reviewed_at=now(), notes=CASE WHEN reason IS NULL THEN notes ELSE notes || E'\n' || btrim(reason) END, updated_at=now() WHERE id=target_id RETURNING to_jsonb(finance_reconciliations.*) INTO saved;
  END IF;
  INSERT INTO public.audit_logs(actor_id,action,module,resource_type,resource_id,outcome,reason,metadata) VALUES(auth.uid(),'finance.workflow.transitioned','finance',target_type,target_id::text,'success',reason,jsonb_build_object('from',current_status,'to',target_status));
  RETURN saved;
END;
$$;

-- Explicit separation-of-duty evidence retained for migration review:
-- A record created_by = auth.uid() cannot be approved or posted by that same actor.
-- Posting remains gated by public.has_permission('finance.transactions.post').

ALTER TABLE public.finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_reconciliations ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['finance_budgets','finance_budget_versions','finance_budget_lines','finance_purchase_requests','finance_reimbursements','finance_collections','finance_reconciliations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "finance workspace read %1$s" ON public.%1$I', table_name);
    EXECUTE format('CREATE POLICY "finance workspace read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.has_permission(''finance.workspace.access''))', table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "finance editors create budgets" ON public.finance_budgets;
DROP POLICY IF EXISTS "finance editors manage draft budgets" ON public.finance_budgets;
DROP POLICY IF EXISTS "finance creators create purchase requests" ON public.finance_purchase_requests;
DROP POLICY IF EXISTS "finance claimants create reimbursements" ON public.finance_reimbursements;
DROP POLICY IF EXISTS "finance collections managers insert" ON public.finance_collections;
DROP POLICY IF EXISTS "finance reconciliation creators insert" ON public.finance_reconciliations;
CREATE POLICY "finance editors create budgets" ON public.finance_budgets FOR INSERT TO authenticated WITH CHECK (created_by=auth.uid() AND public.has_permission('finance.budgets.manage'));
CREATE POLICY "finance editors manage draft budgets" ON public.finance_budgets FOR UPDATE TO authenticated USING (status='draft' AND created_by=auth.uid() AND public.has_permission('finance.budgets.manage')) WITH CHECK (created_by=auth.uid());
CREATE POLICY "finance creators create purchase requests" ON public.finance_purchase_requests FOR INSERT TO authenticated WITH CHECK (created_by=auth.uid() AND public.has_permission('finance.purchases.create'));
CREATE POLICY "finance claimants create reimbursements" ON public.finance_reimbursements FOR INSERT TO authenticated WITH CHECK (created_by=auth.uid() AND claimant_id=auth.uid() AND public.has_permission('finance.reimbursements.create'));
CREATE POLICY "finance collections managers insert" ON public.finance_collections FOR INSERT TO authenticated WITH CHECK (created_by=auth.uid() AND public.has_permission('finance.collections.manage'));
CREATE POLICY "finance reconciliation creators insert" ON public.finance_reconciliations FOR INSERT TO authenticated WITH CHECK (created_by=auth.uid() AND public.has_permission('finance.reconciliation.manage'));

REVOKE ALL ON FUNCTION public.transition_finance_request(text,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_finance_request(text,uuid,text,text) TO authenticated;

COMMIT;
