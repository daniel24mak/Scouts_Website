-- Permission-scoped Scouting access to Finance reimbursements, group budgets, and Storage self-service.
-- Run after supabase-workspace-access.sql, supabase-finance-workflows.sql,
-- supabase-storage-workflows.sql, and supabase-scouting-reimbursements.sql.

BEGIN;

WITH desired(id, description, module, action) AS (VALUES
  ('finance.reimbursements.submit', 'Submit own reimbursements', 'finance', 'reimbursements.submit'),
  ('finance.reimbursements.view_own', 'View own reimbursements', 'finance', 'reimbursements.view_own'),
  ('finance.group_budget.view', 'View authorized group budgets', 'finance', 'group_budget.view'),
  ('storage.catalog.view', 'View requestable Storage catalog', 'storage', 'catalog.view'),
  ('storage.requests.submit', 'Submit own Storage requests', 'storage', 'requests.submit'),
  ('storage.requests.view_own', 'View own Storage requests', 'storage', 'requests.view_own'),
  ('storage.loans.view_own', 'View own Storage loans', 'storage', 'loans.view_own')
)
INSERT INTO public.permissions(id, description, module, action, risk_level, requires_mfa, is_active, updated_at)
SELECT id, description, module, action, 'standard', false, true, now() FROM desired
ON CONFLICT (id) DO UPDATE SET description=EXCLUDED.description, module=EXCLUDED.module,
  action=EXCLUDED.action, is_active=true, updated_at=now();

WITH grants(role_id, permission_id) AS (VALUES
  ('chief','finance.reimbursements.submit'), ('chief','finance.reimbursements.view_own'),
  ('chief','storage.catalog.view'), ('chief','storage.requests.submit'),
  ('chief','storage.requests.view_own'), ('chief','storage.loans.view_own'),
  ('system_administrator','finance.reimbursements.submit'), ('system_administrator','finance.reimbursements.view_own'),
  ('system_administrator','finance.group_budget.view'), ('system_administrator','storage.catalog.view'),
  ('system_administrator','storage.requests.submit'), ('system_administrator','storage.requests.view_own'),
  ('system_administrator','storage.loans.view_own')
)
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT role_id, permission_id FROM grants
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_scouting_storage_self_service()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.is_admin() OR public.has_permission('storage.catalog.view') OR public.has_permission('storage.workspace.access')
  ) THEN
    RAISE EXCEPTION 'Storage self-service access is not permitted' USING ERRCODE='42501';
  END IF;

  WITH physical AS (
    SELECT item_id, COALESCE(sum(available_quantity),0)::numeric(14,3) quantity
    FROM public.storage_location_balances GROUP BY item_id
  ), reserved AS (
    SELECT line.item_id, COALESCE(sum(reservation.quantity),0)::numeric(14,3) quantity,
           min(request.needed_until) next_available_at
    FROM public.storage_reservations reservation
    JOIN public.storage_request_lines line ON line.id=reservation.request_line_id
    JOIN public.storage_requests request ON request.id=line.request_id
    WHERE reservation.status='active'
    GROUP BY line.item_id
  ), borrowed AS (
    SELECT COALESCE(line.item_id, asset.item_id) item_id,
           COALESCE(sum(line.quantity-line.returned_quantity),0)::numeric(14,3) quantity,
           min(loan.due_at) next_available_at
    FROM public.storage_loan_lines line
    JOIN public.storage_loans loan ON loan.id=line.loan_id
    LEFT JOIN public.storage_assets asset ON asset.id=line.asset_id
    WHERE loan.status IN ('prepared','active','partially_returned','overdue')
      AND line.returned_quantity < line.quantity
    GROUP BY COALESCE(line.item_id, asset.item_id)
  ), catalog AS (
    SELECT item.id, item.sku, item.name, item.item_kind, item.unit_name, item.description,
           category.name category_name,
           GREATEST(COALESCE(physical.quantity,0)-COALESCE(reserved.quantity,0),0)::numeric(14,3) available_quantity,
           COALESCE(reserved.quantity,0)::numeric(14,3) reserved_quantity,
           COALESCE(borrowed.quantity,0)::numeric(14,3) borrowed_quantity,
           (GREATEST(COALESCE(physical.quantity,0)-COALESCE(reserved.quantity,0),0)
             + COALESCE(reserved.quantity,0) + COALESCE(borrowed.quantity,0))::numeric(14,3) total_quantity,
           LEAST(reserved.next_available_at, borrowed.next_available_at) next_available_at
    FROM public.storage_inventory_items item
    LEFT JOIN public.storage_categories category ON category.id=item.category_id
    LEFT JOIN physical ON physical.item_id=item.id
    LEFT JOIN reserved ON reserved.item_id=item.id
    LEFT JOIN borrowed ON borrowed.item_id=item.id
    WHERE item.is_active AND item.safety_status='clear'
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(catalog) ORDER BY name) FROM catalog), '[]'::jsonb),
    'requests', COALESCE((SELECT jsonb_agg(to_jsonb(request_row) ORDER BY updated_at DESC) FROM (
      SELECT request.id, request.reference_number, request.title, request.purpose, request.needed_from,
             request.needed_until, request.status, request.created_at, request.updated_at,
             COALESCE((SELECT jsonb_agg(jsonb_build_object('name',item.name,'quantity',line.requested_quantity))
               FROM public.storage_request_lines line JOIN public.storage_inventory_items item ON item.id=line.item_id
               WHERE line.request_id=request.id), '[]'::jsonb) items
      FROM public.storage_requests request WHERE request.requested_by=auth.uid()
    ) request_row), '[]'::jsonb),
    'loans', COALESCE((SELECT jsonb_agg(to_jsonb(loan_row) ORDER BY due_at) FROM (
      SELECT loan.id, loan.reference_number, loan.due_at, loan.returned_at, loan.status, loan.notes, loan.updated_at,
             COALESCE((SELECT jsonb_agg(jsonb_build_object(
               'name',COALESCE(item.name,asset_item.name),'quantity',line.quantity,
               'returnedQuantity',line.returned_quantity,'condition',line.condition_out))
               FROM public.storage_loan_lines line
               LEFT JOIN public.storage_inventory_items item ON item.id=line.item_id
               LEFT JOIN public.storage_assets asset ON asset.id=line.asset_id
               LEFT JOIN public.storage_inventory_items asset_item ON asset_item.id=asset.item_id
               WHERE line.loan_id=loan.id), '[]'::jsonb) items
      FROM public.storage_loans loan
      WHERE loan.borrower_id=auth.uid() AND loan.status IN ('prepared','active','partially_returned','overdue')
    ) loan_row), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_scouting_storage_request(
  target_item_id uuid,
  requested_quantity numeric,
  request_title text,
  request_purpose text,
  requested_from timestamptz,
  requested_until timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE saved_request_id uuid; physical_quantity numeric; reserved_quantity numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.is_admin() OR public.has_permission('storage.requests.submit') OR public.has_permission('storage.requests.create')
  ) THEN RAISE EXCEPTION 'Storage request submission is not permitted' USING ERRCODE='42501'; END IF;
  IF requested_quantity IS NULL OR requested_quantity <= 0 OR requested_from IS NULL
     OR length(btrim(request_title))=0 OR (requested_until IS NOT NULL AND requested_until < requested_from) THEN
    RAISE EXCEPTION 'Invalid Storage request details' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.storage_inventory_items
    WHERE id=target_item_id AND is_active AND safety_status='clear' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This item is not requestable' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(sum(available_quantity),0) INTO physical_quantity
    FROM public.storage_location_balances WHERE item_id=target_item_id;
  SELECT COALESCE(sum(reservation.quantity),0) INTO reserved_quantity
    FROM public.storage_reservations reservation
    JOIN public.storage_request_lines line ON line.id=reservation.request_line_id
    WHERE line.item_id=target_item_id AND reservation.status='active';
  IF requested_quantity > GREATEST(physical_quantity-reserved_quantity,0) THEN
    RAISE EXCEPTION 'Requested quantity exceeds current availability' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.storage_requests(reference_number,title,purpose,needed_from,needed_until,status,requested_by)
  VALUES('SR-'||to_char(clock_timestamp(),'YYYYMMDD-HH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)),
    btrim(request_title),COALESCE(btrim(request_purpose),''),requested_from,requested_until,'pending_approval',auth.uid())
  RETURNING id INTO saved_request_id;
  INSERT INTO public.storage_request_lines(request_id,item_id,requested_quantity)
  VALUES(saved_request_id,target_item_id,requested_quantity);
  RETURN jsonb_build_object('requestId',saved_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_scouting_group_budget_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required' USING ERRCODE='42501'; END IF;
  WITH authorized_budgets AS (
    SELECT budget.* FROM public.finance_budgets budget
    WHERE budget.status IN ('approved','active') AND budget.group_id IS NOT NULL
      AND (public.is_admin() OR public.can_manage_group(budget.group_id)
        OR public.has_permission_for_group('finance.group_budget.view', budget.group_id))
  ), versions AS (
    SELECT budget.*,
      first_version.id first_version_id, latest_version.id latest_version_id
    FROM authorized_budgets budget
    LEFT JOIN LATERAL (
      SELECT id FROM public.finance_budget_versions WHERE budget_id=budget.id AND status='approved'
      ORDER BY version_number ASC LIMIT 1
    ) first_version ON true
    LEFT JOIN LATERAL (
      SELECT id FROM public.finance_budget_versions WHERE budget_id=budget.id AND status='approved'
      ORDER BY version_number DESC LIMIT 1
    ) latest_version ON true
  ), summaries AS (
    SELECT version.id, version.name, version.group_id, groups.name group_name, version.fiscal_year,
      COALESCE((SELECT sum(amount) FROM public.finance_budget_lines WHERE budget_version_id=version.first_version_id),0) approved_budget,
      COALESCE((SELECT sum(amount) FROM public.finance_budget_lines WHERE budget_version_id=version.latest_version_id),0) revised_budget,
      COALESCE((SELECT sum(spent_amount) FROM public.finance_budget_lines WHERE budget_version_id=version.latest_version_id),0) spent,
      COALESCE((SELECT sum(committed_amount) FROM public.finance_budget_lines WHERE budget_version_id=version.latest_version_id),0) committed,
      COALESCE((SELECT sum(reimbursement.amount) FROM public.finance_reimbursements reimbursement
        WHERE reimbursement.workflow_metadata->>'group_id'=version.group_id
          AND reimbursement.status IN ('pending_approval','changes_requested','approved','scheduled')),0) pending_reimbursements,
      COALESCE((SELECT sum(request.amount) FROM public.finance_purchase_requests request
        JOIN public.finance_budget_lines line ON line.id=request.budget_line_id
        WHERE line.budget_version_id=version.latest_version_id
          AND request.status IN ('pending_approval','changes_requested','approved','ordered')),0) pending_purchase_requests,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('label',line.label,'spent',line.spent_amount,'budget',line.amount) ORDER BY line.spent_amount DESC)
        FROM public.finance_budget_lines line WHERE line.budget_version_id=version.latest_version_id), '[]'::jsonb) categories
    FROM versions version JOIN public.groups groups ON groups.id=version.group_id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(summary) ORDER BY group_name), '[]'::jsonb) INTO result FROM summaries summary;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_scouting_storage_self_service() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_scouting_storage_request(uuid,numeric,text,text,timestamptz,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_scouting_group_budget_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_scouting_storage_self_service() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_scouting_storage_request(uuid,numeric,text,text,timestamptz,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scouting_group_budget_summary() TO authenticated;

COMMIT;
