-- Finance workspace core: accounts, funds, double-entry journals, and periods.
-- Run after supabase-access-control-foundation.sql and supabase-workspace-access.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_reference_sequences (
  prefix text NOT NULL,
  reference_year integer NOT NULL,
  last_value bigint NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prefix, reference_year)
);

CREATE OR REPLACE FUNCTION public.next_workspace_reference(reference_prefix text, reference_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  sequence_value bigint;
  clean_prefix text := upper(btrim(reference_prefix));
BEGIN
  IF clean_prefix !~ '^[A-Z]{3}-[A-Z]{2,4}$' OR reference_year NOT BETWEEN 2000 AND 9999 THEN
    RAISE EXCEPTION 'Invalid workspace reference request' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.workspace_reference_sequences (prefix, reference_year, last_value)
  VALUES (clean_prefix, reference_year, 0)
  ON CONFLICT (prefix, reference_year) DO NOTHING;

  SELECT last_value INTO sequence_value
  FROM public.workspace_reference_sequences
  WHERE prefix = clean_prefix AND workspace_reference_sequences.reference_year = next_workspace_reference.reference_year
  FOR UPDATE;

  sequence_value := sequence_value + 1;
  UPDATE public.workspace_reference_sequences
  SET last_value = sequence_value, updated_at = now()
  WHERE prefix = clean_prefix AND workspace_reference_sequences.reference_year = next_workspace_reference.reference_year;

  RETURN clean_prefix || '-' || reference_year::text || '-' || lpad(sequence_value::text, 4, '0');
END;
$$;

-- Official finance references use FIN-TXN-YYYY-NNNN.

CREATE TABLE IF NOT EXISTS public.finance_accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closing','closed','reopened')),
  closed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  closed_at timestamptz,
  close_reason text,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS public.finance_ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (length(btrim(code)) > 0),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  account_class text NOT NULL CHECK (account_class IN ('asset','liability','equity','income','expense')),
  parent_id uuid REFERENCES public.finance_ledger_accounts(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_account_id uuid NOT NULL UNIQUE REFERENCES public.finance_ledger_accounts(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  account_type text NOT NULL CHECK (account_type IN ('bank','cashbox','petty_cash','event_cashbox','card','temporary')),
  currency text NOT NULL DEFAULT 'AED' CHECK (currency ~ '^[A-Z]{3}$'),
  description text NOT NULL DEFAULT '',
  internal_notes text NOT NULL DEFAULT '',
  masked_bank_details text,
  responsible_user_ids uuid[] NOT NULL DEFAULT '{}',
  reconciliation_status text NOT NULL DEFAULT 'not_reconciled' CHECK (reconciliation_status IN ('not_reconciled','in_progress','reconciled','needs_review')),
  last_reconciled_on date,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (length(btrim(code)) > 0),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  description text NOT NULL DEFAULT '',
  parent_id uuid REFERENCES public.finance_funds(id) ON DELETE RESTRICT,
  is_restricted boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (length(btrim(code)) > 0),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  category_type text NOT NULL CHECK (category_type IN ('income','expense','transfer','adjustment')),
  ledger_account_id uuid REFERENCES public.finance_ledger_accounts(id) ON DELETE RESTRICT,
  parent_id uuid REFERENCES public.finance_categories(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text UNIQUE,
  entry_type text NOT NULL CHECK (entry_type IN ('income','expense','transfer','reimbursement','collection','refund','opening','adjustment','reversal')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','changes_requested','approved','scheduled','posted','rejected','cancelled','reversed')),
  entry_date date NOT NULL DEFAULT current_date,
  posting_date date,
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  source_type text,
  source_id uuid,
  group_id text REFERENCES public.groups(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  event_id text,
  project_reference text,
  accounting_period_id uuid REFERENCES public.finance_accounting_periods(id) ON DELETE RESTRICT,
  reversal_of_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE RESTRICT,
  reversal_entry_id uuid REFERENCES public.finance_journal_entries(id) ON DELETE RESTRICT,
  idempotency_key text UNIQUE,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  posted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  posted_at timestamptz,
  reversal_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status IN ('posted','reversed')) = (posted_at IS NOT NULL)),
  CHECK (reversal_of_id IS NULL OR entry_type = 'reversal')
);

CREATE TABLE IF NOT EXISTS public.finance_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.finance_journal_entries(id) ON DELETE CASCADE,
  ledger_account_id uuid NOT NULL REFERENCES public.finance_ledger_accounts(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('debit','credit')),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'AED' CHECK (currency ~ '^[A-Z]{3}$'),
  operational_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
  fund_id uuid REFERENCES public.finance_funds(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES public.finance_categories(id) ON DELETE RESTRICT,
  memo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_journal_entries_status_date_idx ON public.finance_journal_entries (status, entry_date DESC);
CREATE INDEX IF NOT EXISTS finance_journal_entries_source_idx ON public.finance_journal_entries (source_type, source_id);
CREATE INDEX IF NOT EXISTS finance_journal_entries_scope_idx ON public.finance_journal_entries (group_id, team_id, event_id);
CREATE INDEX IF NOT EXISTS finance_journal_lines_entry_idx ON public.finance_journal_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS finance_journal_lines_ledger_idx ON public.finance_journal_lines (ledger_account_id, journal_entry_id);
CREATE INDEX IF NOT EXISTS finance_journal_lines_operational_idx ON public.finance_journal_lines (operational_account_id, journal_entry_id) WHERE operational_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS finance_journal_lines_fund_idx ON public.finance_journal_lines (fund_id, journal_entry_id) WHERE fund_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS finance_period_date_unique ON public.finance_accounting_periods (starts_on, ends_on);

CREATE OR REPLACE FUNCTION public.create_finance_journal_entry(
  requested_entry_type text,
  requested_entry_date date,
  requested_description text,
  requested_lines jsonb,
  requested_source_type text DEFAULT NULL,
  requested_source_id uuid DEFAULT NULL,
  requested_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  new_entry_id uuid;
  line jsonb;
BEGIN
  IF NOT public.has_permission('finance.transactions.create') THEN
    RAISE EXCEPTION 'Finance transaction creation is not permitted' USING ERRCODE = '42501';
  END IF;
  IF requested_entry_type NOT IN ('income','expense','transfer','reimbursement','collection','refund','opening','adjustment') THEN
    RAISE EXCEPTION 'Unsupported finance entry type' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(requested_lines) <> 'array' OR jsonb_array_length(requested_lines) < 2 THEN
    RAISE EXCEPTION 'At least two journal lines are required' USING ERRCODE = '22023';
  END IF;

  IF requested_idempotency_key IS NOT NULL THEN
    SELECT id INTO new_entry_id FROM public.finance_journal_entries WHERE idempotency_key = requested_idempotency_key;
    IF new_entry_id IS NOT NULL THEN RETURN new_entry_id; END IF;
  END IF;

  INSERT INTO public.finance_journal_entries (
    entry_type, entry_date, description, source_type, source_id, idempotency_key, created_by
  ) VALUES (
    requested_entry_type, COALESCE(requested_entry_date, current_date), btrim(requested_description),
    requested_source_type, requested_source_id, requested_idempotency_key, auth.uid()
  ) RETURNING id INTO new_entry_id;

  FOR line IN SELECT value FROM jsonb_array_elements(requested_lines)
  LOOP
    INSERT INTO public.finance_journal_lines (
      journal_entry_id, ledger_account_id, direction, amount, currency,
      operational_account_id, fund_id, category_id, memo
    ) VALUES (
      new_entry_id,
      (line->>'ledgerAccountId')::uuid,
      line->>'direction',
      (line->>'amount')::numeric,
      COALESCE(nullif(line->>'currency',''), 'AED'),
      nullif(line->>'operationalAccountId','')::uuid,
      nullif(line->>'fundId','')::uuid,
      nullif(line->>'categoryId','')::uuid,
      COALESCE(line->>'memo','')
    );
  END LOOP;
  RETURN new_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_finance_journal_entry(target_entry_id uuid, reason text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  entry_record public.finance_journal_entries%ROWTYPE;
  debit_total numeric(18,2);
  credit_total numeric(18,2);
  line_count integer;
  official_reference text;
BEGIN
  IF NOT public.has_permission('finance.transactions.post') THEN
    RAISE EXCEPTION 'Finance transaction posting is not permitted' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(COALESCE(reason,''))) < 4 THEN
    RAISE EXCEPTION 'A posting reason is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO entry_record FROM public.finance_journal_entries WHERE id = target_entry_id FOR UPDATE;
  IF NOT FOUND OR entry_record.status NOT IN ('draft','approved','scheduled') THEN
    RAISE EXCEPTION 'Finance entry cannot be posted from its current status' USING ERRCODE = '23514';
  END IF;

  SELECT period.id INTO entry_record.accounting_period_id
  FROM public.finance_accounting_periods period
  WHERE entry_record.entry_date BETWEEN period.starts_on AND period.ends_on
  ORDER BY period.starts_on DESC LIMIT 1;
  IF entry_record.accounting_period_id IS NULL THEN
    RAISE EXCEPTION 'No accounting period covers the posting date' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.finance_accounting_periods WHERE id = entry_record.accounting_period_id AND status = 'closed') THEN
    RAISE EXCEPTION 'The accounting period is closed' USING ERRCODE = '23514';
  END IF;

  SELECT
    COUNT(*),
    COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END), 0)
  INTO line_count, debit_total, credit_total
  FROM public.finance_journal_lines WHERE journal_entry_id = target_entry_id;
  IF line_count < 2 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'A posted journal entry must balance' USING ERRCODE = '23514';
  END IF;

  official_reference := public.next_workspace_reference('FIN-TXN', extract(year FROM entry_record.entry_date)::integer);
  UPDATE public.finance_journal_entries
  SET reference_number = official_reference, status = 'posted', posting_date = entry_date,
      accounting_period_id = entry_record.accounting_period_id, posted_by = auth.uid(),
      posted_at = now(), updated_at = now()
  WHERE id = target_entry_id;

  INSERT INTO public.audit_logs (actor_id, action, module, resource_type, resource_id, outcome, reason, metadata)
  VALUES (auth.uid(), 'finance.transaction.posted', 'finance', 'finance_journal_entry', target_entry_id::text, 'success', reason,
          jsonb_build_object('reference', official_reference, 'debits', debit_total, 'credits', credit_total));
  RETURN official_reference;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_finance_journal_entry(target_entry_id uuid, reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  original public.finance_journal_entries%ROWTYPE;
  reversal_id uuid;
BEGIN
  IF NOT public.has_permission('finance.transactions.reverse') THEN
    RAISE EXCEPTION 'Finance transaction reversal is not permitted' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(COALESCE(reason,''))) < 8 THEN
    RAISE EXCEPTION 'A detailed reversal reason is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO original FROM public.finance_journal_entries WHERE id = target_entry_id FOR UPDATE;
  IF NOT FOUND OR original.status <> 'posted' OR original.reversal_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only an unreversed posted entry can be reversed' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.finance_journal_entries (
    entry_type, status, entry_date, description, source_type, source_id, accounting_period_id,
    reversal_of_id, created_by, reversal_reason
  ) VALUES (
    'reversal', 'draft', current_date, 'Reversal of ' || original.reference_number,
    original.source_type, original.source_id, original.accounting_period_id,
    original.id, auth.uid(), reason
  ) RETURNING id INTO reversal_id;

  INSERT INTO public.finance_journal_lines (
    journal_entry_id, ledger_account_id, direction, amount, currency,
    operational_account_id, fund_id, category_id, memo
  )
  SELECT reversal_id, ledger_account_id,
         CASE direction WHEN 'debit' THEN 'credit' ELSE 'debit' END,
         amount, currency, operational_account_id, fund_id, category_id,
         'Reversal: ' || memo
  FROM public.finance_journal_lines WHERE journal_entry_id = original.id;

  PERFORM public.post_finance_journal_entry(reversal_id, reason);
  UPDATE public.finance_journal_entries
  SET status = 'reversed', reversal_entry_id = reversal_id, updated_at = now()
  WHERE id = original.id;

  INSERT INTO public.audit_logs (actor_id, action, module, resource_type, resource_id, outcome, reason, metadata)
  VALUES (auth.uid(), 'finance.transaction.reversed', 'finance', 'finance_journal_entry', original.id::text, 'success', reason,
          jsonb_build_object('reversalEntryId', reversal_id));
  RETURN reversal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_posted_finance_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status IN ('posted','reversed') THEN
    RAISE EXCEPTION 'Posted finance entries are immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('posted','reversed') THEN
    IF OLD.status = 'posted' AND NEW.status = 'reversed' AND NEW.reversal_entry_id IS NOT NULL
       AND NEW.id = OLD.id AND NEW.reference_number = OLD.reference_number THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Posted finance entries are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_posted_finance_line()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE target_id uuid := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
BEGIN
  IF EXISTS (SELECT 1 FROM public.finance_journal_entries WHERE id = target_id AND status IN ('posted','reversed')) THEN
    RAISE EXCEPTION 'Posted finance entries are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_posted_finance_entry ON public.finance_journal_entries;
CREATE TRIGGER protect_posted_finance_entry BEFORE UPDATE OR DELETE ON public.finance_journal_entries
FOR EACH ROW EXECUTE FUNCTION public.protect_posted_finance_entry();
DROP TRIGGER IF EXISTS protect_posted_finance_line ON public.finance_journal_lines;
CREATE TRIGGER protect_posted_finance_line BEFORE UPDATE OR DELETE ON public.finance_journal_lines
FOR EACH ROW EXECUTE FUNCTION public.protect_posted_finance_line();

CREATE OR REPLACE VIEW public.finance_account_balances WITH (security_invoker = true) AS
SELECT account.id AS account_id, account.currency,
       COALESCE(SUM(CASE line.direction WHEN 'debit' THEN line.amount ELSE -line.amount END), 0)::numeric(18,2) AS calculated_balance
FROM public.finance_accounts account
LEFT JOIN public.finance_journal_lines line ON line.operational_account_id = account.id
LEFT JOIN public.finance_journal_entries entry ON entry.id = line.journal_entry_id AND entry.status = 'posted'
WHERE entry.id IS NOT NULL OR line.id IS NULL
GROUP BY account.id, account.currency;

CREATE OR REPLACE VIEW public.finance_income_expense_summary WITH (security_invoker = true) AS
SELECT entry.entry_date, entry.entry_type, line.category_id,
       SUM(line.amount)::numeric(18,2) AS amount
FROM public.finance_journal_entries entry
JOIN public.finance_journal_lines line ON line.journal_entry_id = entry.id
WHERE entry.status = 'posted'
  AND entry.entry_type NOT IN ('transfer','opening','adjustment')
  AND line.category_id IS NOT NULL
GROUP BY entry.entry_date, entry.entry_type, line.category_id;

ALTER TABLE public.workspace_reference_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance users read accounts" ON public.finance_accounts FOR SELECT TO authenticated USING (public.has_permission('finance.accounts.view'));
CREATE POLICY "finance users read funds" ON public.finance_funds FOR SELECT TO authenticated USING (public.has_permission('finance.funds.view'));
CREATE POLICY "finance users read categories" ON public.finance_categories FOR SELECT TO authenticated USING (public.has_permission('finance.transactions.view'));
CREATE POLICY "finance users read ledger accounts" ON public.finance_ledger_accounts FOR SELECT TO authenticated USING (public.has_permission('finance.transactions.view'));
CREATE POLICY "finance users read entries" ON public.finance_journal_entries FOR SELECT TO authenticated USING (public.has_permission('finance.transactions.view'));
CREATE POLICY "finance users read lines" ON public.finance_journal_lines FOR SELECT TO authenticated USING (
  public.has_permission('finance.transactions.view') AND EXISTS (
    SELECT 1 FROM public.finance_journal_entries entry WHERE entry.id = journal_entry_id
  )
);
CREATE POLICY "finance users read periods" ON public.finance_accounting_periods FOR SELECT TO authenticated USING (public.has_permission('finance.periods.view'));

REVOKE ALL ON TABLE public.workspace_reference_sequences, public.finance_accounting_periods,
  public.finance_ledger_accounts, public.finance_accounts, public.finance_funds, public.finance_categories,
  public.finance_journal_entries, public.finance_journal_lines FROM PUBLIC;
REVOKE ALL ON TABLE public.workspace_reference_sequences, public.finance_accounting_periods,
  public.finance_ledger_accounts, public.finance_accounts, public.finance_funds, public.finance_categories,
  public.finance_journal_entries, public.finance_journal_lines FROM anon;
REVOKE ALL ON TABLE public.workspace_reference_sequences, public.finance_accounting_periods,
  public.finance_ledger_accounts, public.finance_accounts, public.finance_funds, public.finance_categories,
  public.finance_journal_entries, public.finance_journal_lines FROM authenticated;
GRANT SELECT ON TABLE public.finance_accounting_periods, public.finance_ledger_accounts, public.finance_accounts,
  public.finance_funds, public.finance_categories, public.finance_journal_entries, public.finance_journal_lines,
  public.finance_account_balances, public.finance_income_expense_summary TO authenticated;

REVOKE ALL ON FUNCTION public.next_workspace_reference(text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_finance_journal_entry(text,date,text,jsonb,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_finance_journal_entry(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_finance_journal_entry(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_finance_journal_entry(text,date,text,jsonb,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_finance_journal_entry(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_finance_journal_entry(uuid,text) TO authenticated;

COMMIT;
