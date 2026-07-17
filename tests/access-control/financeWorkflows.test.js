import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sql = fs.readFileSync(new URL("../../database/supabase-finance-workflows.sql", import.meta.url), "utf8");
for (const table of ["finance_budgets","finance_budget_versions","finance_budget_lines","finance_purchase_requests","finance_reimbursements","finance_collections","finance_reconciliations"]) {
  test(`${table} is protected`, () => {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"));
  });
}
test("finance transitions are trusted and separation of duty is enforced", () => {
  assert.match(sql, /transition_finance_request/i);
  assert.match(sql, /created_by\s*=\s*auth\.uid\(\)/i);
  assert.match(sql, /public\.has_permission\('finance\.transactions\.post'\)/i);
});
test("finance amounts and budget versions are constrained", () => {
  assert.match(sql, /amount numeric\(14,2\) NOT NULL CHECK \(amount > 0\)/i);
  assert.match(sql, /UNIQUE \(budget_id, version_number\)/i);
});
