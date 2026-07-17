import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sql = fs.readFileSync(new URL("../../database/supabase-scouting-service-access.sql", import.meta.url), "utf8");
const storagePanel = fs.readFileSync(new URL("../../src/features/storage/ScoutingStoragePanel.jsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../../src/pages/AdminDashboardPage.jsx", import.meta.url), "utf8");
const budgetSummary = fs.readFileSync(new URL("../../src/features/finance/ScoutingBudgetSummary.jsx", import.meta.url), "utf8");
const formsDashboard = fs.readFileSync(new URL("../../src/features/forms/FormsDashboard.jsx", import.meta.url), "utf8");

test("Scouting service access is permission-scoped and authenticated", () => {
  assert.match(sql, /finance\.group_budget\.view/i);
  assert.match(sql, /storage\.catalog\.view/i);
  assert.match(sql, /storage\.requests\.submit/i);
  assert.match(sql, /SECURITY DEFINER/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.get_scouting_storage_self_service\(\) FROM PUBLIC, anon/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_scouting_storage_self_service\(\) TO authenticated/i);
});

test("Storage self-service returns only the signed-in user's workflow records", () => {
  assert.match(sql, /request\.requested_by\s*=\s*auth\.uid\(\)/i);
  assert.match(sql, /loan\.borrower_id\s*=\s*auth\.uid\(\)/i);
  assert.match(sql, /GREATEST\(COALESCE\(physical\.quantity,0\)-COALESCE\(reserved\.quantity,0\),0\)/i);
  assert.match(sql, /saved_request_id uuid/i);
});

test("Group budgets are limited by trusted group authorization", () => {
  assert.match(sql, /public\.can_manage_group\(budget\.group_id\)/i);
  assert.match(sql, /public\.has_permission_for_group\('finance\.group_budget\.view', budget\.group_id\)/i);
});

test("Scouting UI uses trusted service APIs", () => {
  assert.match(storagePanel, /getScoutingStorageSelfService/);
  assert.match(storagePanel, /submitScoutingStorageRequest/);
  assert.doesNotMatch(storagePanel, /insertSupabaseRow|storage_inventory_summary/);
  assert.match(dashboard, /ScoutingBudgetSummary/);
  assert.match(dashboard, /FINANCE_GROUP_BUDGET_VIEW/);
});

test("Scouting overview exposes useful budget and event context", () => {
  assert.match(budgetSummary, /scouting-budget-categories/);
  assert.match(budgetSummary, /Pending reimbursements/);
  assert.match(budgetSummary, /Pending purchases/);
  assert.match(dashboard, /event\.groupId/);
  assert.match(dashboard, /event\.location/);
});

test("Reimbursements keeps drafts inside the reimbursement workspace", () => {
  assert.match(formsDashboard, /reimbursementDrafts/);
  assert.match(formsDashboard, /Reimbursement drafts/);
  assert.match(formsDashboard, /onOpen=\{openForm\}/);
});
