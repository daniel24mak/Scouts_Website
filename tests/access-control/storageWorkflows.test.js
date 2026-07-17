import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sql = fs.readFileSync(new URL("../../database/supabase-storage-workflows.sql", import.meta.url), "utf8");

test("workflow item foreign keys target the canonical inventory table", () => {
  assert.match(sql, /REFERENCES public\.storage_inventory_items\(id\)/i);
  assert.doesNotMatch(sql, /REFERENCES public\.storage_items\(id\)/i);
});

for (const table of ["storage_requests","storage_request_lines","storage_reservations","storage_loans","storage_loan_lines","storage_suppliers","storage_deliveries","storage_maintenance","storage_audits"]) {
  test(`${table} is protected`, () => {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"));
  });
}
test("storage transitions prevent reservation over-allocation and self inspection", () => {
  assert.match(sql, /reserve_storage_request/i);
  assert.match(sql, /available_quantity/i);
  assert.match(sql, /inspected_by\s*=\s*auth\.uid\(\)/i);
});
test("partial return and overdue states are represented", () => {
  assert.match(sql, /returned_quantity/i);
  assert.match(sql, /overdue/i);
});
