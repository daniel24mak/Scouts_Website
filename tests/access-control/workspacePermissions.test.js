import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PERMISSIONS } from "../../src/services/accessControlCatalog.js";

const sql = fs.readFileSync(new URL("../../database/supabase-workspace-access.sql", import.meta.url), "utf8");
const required = [
  "finance.workspace.access", "finance.transactions.view", "finance.transactions.create", "finance.transactions.post", "finance.transactions.reverse",
  "finance.accounts.view", "finance.funds.view", "finance.budgets.view", "finance.purchases.view", "finance.reimbursements.view",
  "finance.collections.view", "finance.reconciliation.view", "finance.periods.view", "finance.reports.view", "finance.settings.manage",
  "storage.workspace.access", "storage.inventory.view", "storage.movements.create", "storage.restricted_locations.view", "storage.requests.view",
  "storage.loans.view", "storage.restocking.view", "storage.suppliers.view", "storage.maintenance.view", "storage.audits.view",
  "storage.reports.view", "storage.settings.manage"
];

test("workspace migration and frontend catalog contain every granular permission", () => {
  const frontend = new Set(Object.values(PERMISSIONS));
  for (const permission of required) {
    assert.match(sql, new RegExp(permission.replaceAll(".", "\\.")));
    assert.equal(frontend.has(permission), true, permission);
  }
});

test("workspace migration is additive and grants high-risk actions with MFA", () => {
  assert.doesNotMatch(sql, /DELETE FROM public\.(permissions|role_permissions)/i);
  for (const permission of ["finance.transactions.post", "finance.transactions.reverse", "finance.settings.manage", "storage.settings.manage"]) {
    assert.match(sql, new RegExp(`'${permission.replaceAll(".", "\\.")}'[^\n]+true`));
  }
  assert.match(sql, /SELECT\s+'system_administrator'\s*,\s*id\s+FROM\s+desired_permissions/i);
});
