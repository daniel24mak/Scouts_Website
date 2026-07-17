-- Storage workflow records: requests, reservations, loans, deliveries, maintenance, and audits.
-- Run after supabase-storage-core.sql and supabase-workflow-engine.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.storage_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text UNIQUE,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  purpose text NOT NULL DEFAULT '',
  needed_from timestamptz NOT NULL,
  needed_until timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','partially_reserved','reserved','prepared','handed_over','completed','rejected','cancelled')),
  requested_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (needed_until IS NULL OR needed_until >= needed_from)
);

CREATE TABLE IF NOT EXISTS public.storage_request_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.storage_requests(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.storage_inventory_items(id) ON DELETE RESTRICT,
  requested_quantity numeric(14,3) NOT NULL CHECK (requested_quantity > 0),
  approved_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (approved_quantity >= 0),
  notes text NOT NULL DEFAULT '',
  UNIQUE (request_id, item_id)
);

CREATE TABLE IF NOT EXISTS public.storage_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_line_id uuid NOT NULL REFERENCES public.storage_request_lines(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.storage_locations(id) ON DELETE RESTRICT,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','fulfilled','released','cancelled')),
  reserved_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.storage_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text UNIQUE,
  request_id uuid REFERENCES public.storage_requests(id) ON DELETE SET NULL,
  borrower_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  handed_over_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  handed_over_at timestamptz,
  due_at timestamptz NOT NULL,
  returned_at timestamptz,
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','active','partially_returned','returned','overdue','lost','cancelled')),
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_loan_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.storage_loans(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.storage_inventory_items(id) ON DELETE RESTRICT,
  asset_id uuid REFERENCES public.storage_assets(id) ON DELETE RESTRICT,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  returned_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
  condition_out text,
  condition_in text,
  inspected_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  inspected_at timestamptz,
  CHECK ((item_id IS NOT NULL) <> (asset_id IS NOT NULL)),
  CHECK (returned_quantity <= quantity)
);

CREATE TABLE IF NOT EXISTS public.storage_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(btrim(name)) > 0),
  contact_name text,
  email text,
  phone text,
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text UNIQUE,
  supplier_id uuid REFERENCES public.storage_suppliers(id) ON DELETE SET NULL,
  purchase_request_id uuid,
  status text NOT NULL DEFAULT 'expected' CHECK (status IN ('expected','arrived','inspecting','accepted','partially_accepted','rejected','cancelled')),
  expected_on date,
  arrived_at timestamptz,
  accepted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.storage_assets(id) ON DELETE RESTRICT,
  issue text NOT NULL CHECK (length(btrim(issue)) > 0),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  status text NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','scheduled','in_progress','awaiting_parts','completed','cannot_repair','cancelled')),
  reported_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  assigned_to uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  completed_at timestamptz,
  cost numeric(14,2) CHECK (cost IS NULL OR cost >= 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  location_id uuid REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','counting','pending_review','completed','cancelled')),
  strict_separation boolean NOT NULL DEFAULT true,
  counted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  inspected_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT strict_separation OR inspected_by IS NULL OR inspected_by <> counted_by)
);

CREATE INDEX IF NOT EXISTS storage_requests_status_needed_idx ON public.storage_requests(status, needed_from);
CREATE INDEX IF NOT EXISTS storage_request_lines_request_idx ON public.storage_request_lines(request_id);
CREATE INDEX IF NOT EXISTS storage_reservations_line_status_idx ON public.storage_reservations(request_line_id,status);
CREATE INDEX IF NOT EXISTS storage_loans_status_due_idx ON public.storage_loans(status,due_at);
CREATE INDEX IF NOT EXISTS storage_loan_lines_loan_idx ON public.storage_loan_lines(loan_id);
CREATE INDEX IF NOT EXISTS storage_deliveries_status_idx ON public.storage_deliveries(status,expected_on);
CREATE INDEX IF NOT EXISTS storage_maintenance_status_idx ON public.storage_maintenance(status,priority);
CREATE INDEX IF NOT EXISTS storage_audits_status_idx ON public.storage_audits(status,created_at DESC);

CREATE OR REPLACE FUNCTION public.reserve_storage_request(target_request_line_id uuid, target_location_id uuid, requested_quantity numeric)
RETURNS public.storage_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE line_row public.storage_request_lines; available_quantity numeric(14,3); already_reserved numeric(14,3); saved public.storage_reservations;
BEGIN
  IF NOT public.has_permission('storage.requests.reserve') THEN RAISE EXCEPTION 'Storage reservation is not permitted' USING ERRCODE='42501'; END IF;
  IF requested_quantity <= 0 THEN RAISE EXCEPTION 'Reservation quantity must be positive' USING ERRCODE='22023'; END IF;
  SELECT * INTO line_row FROM public.storage_request_lines WHERE id=target_request_line_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request line was not found' USING ERRCODE='P0002'; END IF;
  SELECT COALESCE(sum(CASE WHEN to_location_id=target_location_id THEN quantity ELSE 0 END),0)
       - COALESCE(sum(CASE WHEN from_location_id=target_location_id THEN quantity ELSE 0 END),0)
    INTO available_quantity FROM public.storage_stock_movements
    WHERE item_id=line_row.item_id AND (to_location_id=target_location_id OR from_location_id=target_location_id) AND status='posted';
  SELECT COALESCE(sum(quantity),0) INTO already_reserved FROM public.storage_reservations r JOIN public.storage_request_lines rl ON rl.id=r.request_line_id WHERE rl.item_id=line_row.item_id AND r.location_id=target_location_id AND r.status='active';
  available_quantity := available_quantity - already_reserved;
  IF requested_quantity > available_quantity THEN RAISE EXCEPTION 'Reservation exceeds available quantity' USING ERRCODE='23514'; END IF;
  INSERT INTO public.storage_reservations(request_line_id,location_id,quantity,reserved_by) VALUES(target_request_line_id,target_location_id,requested_quantity,auth.uid()) RETURNING * INTO saved;
  UPDATE public.storage_requests SET status=CASE WHEN requested_quantity >= line_row.requested_quantity THEN 'reserved' ELSE 'partially_reserved' END,updated_at=now() WHERE id=line_row.request_id;
  RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_storage_return(target_loan_line_id uuid, quantity_returned numeric, condition_received text)
RETURNS public.storage_loan_lines
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE line_row public.storage_loan_lines; saved public.storage_loan_lines; remaining integer;
BEGIN
  IF NOT public.has_permission('storage.loans.receive') THEN RAISE EXCEPTION 'Storage return is not permitted' USING ERRCODE='42501'; END IF;
  SELECT * INTO line_row FROM public.storage_loan_lines WHERE id=target_loan_line_id FOR UPDATE;
  IF NOT FOUND OR quantity_returned <= 0 OR line_row.returned_quantity + quantity_returned > line_row.quantity THEN RAISE EXCEPTION 'Invalid return quantity' USING ERRCODE='23514'; END IF;
  UPDATE public.storage_loan_lines SET returned_quantity=returned_quantity+quantity_returned,condition_in=condition_received,inspected_by=auth.uid(),inspected_at=now() WHERE id=target_loan_line_id RETURNING * INTO saved;
  SELECT count(*) INTO remaining FROM public.storage_loan_lines WHERE loan_id=line_row.loan_id AND returned_quantity < quantity;
  UPDATE public.storage_loans SET status=CASE WHEN remaining=0 THEN 'returned' ELSE 'partially_returned' END,returned_at=CASE WHEN remaining=0 THEN now() ELSE returned_at END,updated_at=now() WHERE id=line_row.loan_id;
  RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_storage_audit(target_audit_id uuid, reason text)
RETURNS public.storage_audits
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE audit_row public.storage_audits;
BEGIN
  IF NOT public.has_permission('storage.audits.approve') THEN RAISE EXCEPTION 'Storage audit approval is not permitted' USING ERRCODE='42501'; END IF;
  SELECT * INTO audit_row FROM public.storage_audits WHERE id=target_audit_id FOR UPDATE;
  IF audit_row.inspected_by = auth.uid() OR (audit_row.strict_separation AND audit_row.counted_by = auth.uid()) THEN RAISE EXCEPTION 'A strict audit cannot be self-inspected' USING ERRCODE='42501'; END IF;
  UPDATE public.storage_audits SET status='completed',inspected_by=auth.uid(),completed_at=now(),updated_at=now() WHERE id=target_audit_id RETURNING * INTO audit_row;
  RETURN audit_row;
END;
$$;

-- Loans past due_at are represented by the overdue state and may be advanced by a scheduled job.

ALTER TABLE public.storage_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_loan_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_audits ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['storage_requests','storage_request_lines','storage_reservations','storage_loans','storage_loan_lines','storage_suppliers','storage_deliveries','storage_maintenance','storage_audits'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "storage workspace read %1$s" ON public.%1$I', table_name);
    EXECUTE format('CREATE POLICY "storage workspace read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.has_permission(''storage.workspace.access''))', table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "storage users create own requests" ON public.storage_requests;
DROP POLICY IF EXISTS "storage managers create loans" ON public.storage_loans;
DROP POLICY IF EXISTS "storage managers create suppliers" ON public.storage_suppliers;
DROP POLICY IF EXISTS "storage managers create deliveries" ON public.storage_deliveries;
DROP POLICY IF EXISTS "storage users report maintenance" ON public.storage_maintenance;
DROP POLICY IF EXISTS "storage auditors create audits" ON public.storage_audits;
CREATE POLICY "storage users create own requests" ON public.storage_requests FOR INSERT TO authenticated WITH CHECK(requested_by=auth.uid() AND public.has_permission('storage.requests.create'));
CREATE POLICY "storage managers create loans" ON public.storage_loans FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND public.has_permission('storage.loans.manage'));
CREATE POLICY "storage managers create suppliers" ON public.storage_suppliers FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND public.has_permission('storage.suppliers.manage'));
CREATE POLICY "storage managers create deliveries" ON public.storage_deliveries FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND public.has_permission('storage.deliveries.manage'));
CREATE POLICY "storage users report maintenance" ON public.storage_maintenance FOR INSERT TO authenticated WITH CHECK(reported_by=auth.uid() AND public.has_permission('storage.maintenance.create'));
CREATE POLICY "storage auditors create audits" ON public.storage_audits FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND public.has_permission('storage.audits.manage'));

REVOKE ALL ON FUNCTION public.reserve_storage_request(uuid,uuid,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_storage_return(uuid,numeric,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_storage_audit(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_storage_request(uuid,uuid,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_storage_return(uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_storage_audit(uuid,text) TO authenticated;

COMMIT;
