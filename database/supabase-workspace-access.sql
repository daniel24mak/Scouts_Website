-- Additive granular Finance and Storage workspace permissions.
-- Run after supabase-access-control-foundation.sql and supabase-access-control-seed.sql.

BEGIN;

WITH desired_permissions (id, risk_level, requires_mfa) AS (VALUES
  ('finance.workspace.access','standard',false), ('finance.transactions.view','standard',false),
  ('finance.transactions.create','elevated',false), ('finance.transactions.post','high',true),
  ('finance.transactions.reverse','high',true), ('finance.accounts.view','standard',false),
  ('finance.funds.view','standard',false), ('finance.budgets.view','standard',false),
  ('finance.budgets.manage','elevated',false), ('finance.purchases.view','standard',false),
  ('finance.purchases.create','elevated',false), ('finance.reimbursements.view','standard',false),
  ('finance.reimbursements.create','elevated',false), ('finance.collections.view','standard',false),
  ('finance.collections.manage','elevated',false), ('finance.reconciliation.view','elevated',false),
  ('finance.reconciliation.manage','high',true),
  ('finance.periods.view','standard',false), ('finance.reports.view','elevated',false),
  ('finance.settings.manage','high',true), ('finance.files.manage','elevated',false),
  ('storage.workspace.access','standard',false), ('storage.inventory.view','standard',false),
  ('storage.movements.create','elevated',false), ('storage.restricted_locations.view','elevated',false),
  ('storage.requests.view','standard',false), ('storage.requests.create','standard',false),
  ('storage.requests.reserve','elevated',false), ('storage.loans.view','standard',false),
  ('storage.loans.manage','elevated',false), ('storage.loans.receive','elevated',false),
  ('storage.restocking.view','standard',false), ('storage.suppliers.view','standard',false),
  ('storage.suppliers.manage','elevated',false), ('storage.deliveries.manage','elevated',false),
  ('storage.maintenance.view','standard',false), ('storage.maintenance.create','standard',false),
  ('storage.audits.view','elevated',false), ('storage.audits.manage','elevated',false),
  ('storage.audits.approve','high',true),
  ('storage.reports.view','elevated',false), ('storage.settings.manage','high',true),
  ('storage.files.manage','elevated',false)
)
INSERT INTO public.permissions (id, description, module, action, risk_level, requires_mfa, is_active, updated_at)
SELECT id, initcap(replace(replace(id, '.', ' '), '_', ' ')), split_part(id, '.', 1),
       substring(id from position('.' in id) + 1), risk_level, requires_mfa, true, now()
FROM desired_permissions
ON CONFLICT (id) DO UPDATE SET risk_level=EXCLUDED.risk_level, requires_mfa=EXCLUDED.requires_mfa,
  is_active=true, updated_at=now();

WITH grants(role_id, permission_id) AS (VALUES
  ('finance_viewer','finance.workspace.access'), ('finance_viewer','finance.transactions.view'),
  ('finance_viewer','finance.accounts.view'), ('finance_viewer','finance.funds.view'),
  ('finance_viewer','finance.budgets.view'), ('finance_viewer','finance.purchases.view'),
  ('finance_viewer','finance.reimbursements.view'), ('finance_viewer','finance.collections.view'),
  ('finance_viewer','finance.periods.view'), ('finance_viewer','finance.reports.view'),
  ('finance_contributor','finance.workspace.access'), ('finance_contributor','finance.transactions.view'),
  ('finance_contributor','finance.transactions.create'), ('finance_contributor','finance.accounts.view'),
  ('finance_contributor','finance.funds.view'), ('finance_contributor','finance.budgets.view'),
  ('finance_contributor','finance.budgets.manage'), ('finance_contributor','finance.purchases.view'),
  ('finance_contributor','finance.purchases.create'), ('finance_contributor','finance.reimbursements.view'),
  ('finance_contributor','finance.reimbursements.create'), ('finance_contributor','finance.collections.view'),
  ('finance_contributor','finance.collections.manage'), ('finance_contributor','finance.periods.view'),
  ('finance_contributor','finance.files.manage'),
  ('finance_approver','finance.workspace.access'), ('finance_approver','finance.transactions.view'),
  ('finance_approver','finance.transactions.post'), ('finance_approver','finance.transactions.reverse'),
  ('finance_approver','finance.accounts.view'), ('finance_approver','finance.funds.view'),
  ('finance_approver','finance.budgets.view'), ('finance_approver','finance.purchases.view'),
  ('finance_approver','finance.reimbursements.view'), ('finance_approver','finance.collections.view'),
  ('finance_approver','finance.reconciliation.view'), ('finance_approver','finance.periods.view'),
  ('finance_approver','finance.reconciliation.manage'),
  ('finance_approver','finance.reports.view'),
  ('finance_approver','finance.files.manage'),
  ('storage_assistant','storage.workspace.access'), ('storage_assistant','storage.inventory.view'),
  ('storage_assistant','storage.movements.create'), ('storage_assistant','storage.requests.view'),
  ('storage_assistant','storage.requests.create'), ('storage_assistant','storage.loans.view'),
  ('storage_assistant','storage.loans.receive'), ('storage_assistant','storage.maintenance.create'),
  ('storage_assistant','storage.files.manage'),
  ('storage_manager','storage.workspace.access'), ('storage_manager','storage.inventory.view'),
  ('storage_manager','storage.movements.create'), ('storage_manager','storage.restricted_locations.view'),
  ('storage_manager','storage.requests.view'), ('storage_manager','storage.loans.view'),
  ('storage_manager','storage.requests.create'), ('storage_manager','storage.requests.reserve'),
  ('storage_manager','storage.loans.manage'), ('storage_manager','storage.loans.receive'),
  ('storage_manager','storage.restocking.view'), ('storage_manager','storage.suppliers.view'),
  ('storage_manager','storage.suppliers.manage'), ('storage_manager','storage.deliveries.manage'),
  ('storage_manager','storage.maintenance.view'), ('storage_manager','storage.maintenance.create'),
  ('storage_manager','storage.audits.view'), ('storage_manager','storage.audits.manage'),
  ('storage_manager','storage.audits.approve'),
  ('storage_manager','storage.reports.view'), ('storage_manager','storage.settings.manage'),
  ('storage_manager','storage.files.manage')
)
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT role_id, permission_id FROM grants
ON CONFLICT (role_id, permission_id) DO NOTHING;

WITH desired_permissions(id) AS (VALUES
  ('finance.workspace.access'),('finance.transactions.view'),('finance.transactions.create'),('finance.transactions.post'),
  ('finance.transactions.reverse'),('finance.accounts.view'),('finance.funds.view'),('finance.budgets.view'),
  ('finance.budgets.manage'),('finance.purchases.view'),('finance.purchases.create'),
  ('finance.reimbursements.view'),('finance.reimbursements.create'),('finance.collections.view'),
  ('finance.collections.manage'),('finance.reconciliation.view'),('finance.reconciliation.manage'),
  ('finance.periods.view'),('finance.reports.view'),('finance.settings.manage'),('finance.files.manage'),('storage.workspace.access'),
  ('storage.inventory.view'),('storage.movements.create'),('storage.restricted_locations.view'),('storage.requests.view'),
  ('storage.requests.create'),('storage.requests.reserve'),('storage.loans.view'),('storage.loans.manage'),
  ('storage.loans.receive'),('storage.restocking.view'),('storage.suppliers.view'),('storage.suppliers.manage'),
  ('storage.deliveries.manage'),('storage.maintenance.view'),('storage.maintenance.create'),('storage.audits.view'),
  ('storage.audits.manage'),('storage.audits.approve'),('storage.reports.view'),('storage.settings.manage'),('storage.files.manage')
)
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT 'system_administrator', id FROM desired_permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

DROP POLICY IF EXISTS "workspace report viewers read audit logs" ON public.audit_logs;
CREATE POLICY "workspace report viewers read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    (module = 'finance' AND public.has_permission('finance.reports.view'))
    OR (module = 'storage' AND public.has_permission('storage.reports.view'))
  );

COMMIT;
