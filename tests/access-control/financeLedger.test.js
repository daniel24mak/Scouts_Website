import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../../database/supabase-finance-core.sql", import.meta.url), "utf8");

test("finance core separates physical accounts, reserved funds, and ledger accounts", () => {
  for (const table of [
    "finance_accounts",
    "finance_funds",
    "finance_categories",
    "finance_ledger_accounts",
    "finance_journal_entries",
    "finance_journal_lines",
    "finance_accounting_periods"
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`, "i"));
  }
  assert.match(sql, /finance_journal_lines[\s\S]*operational_account_id uuid[\s\S]*fund_id uuid/i);
});

test("official references are generated under a database lock", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.workspace_reference_sequences/i);
  assert.match(sql, /FUNCTION public\.next_workspace_reference\(reference_prefix text, reference_year integer\)/i);
  assert.match(sql, /FOR UPDATE/i);
  assert.match(sql, /FIN-TXN-/i);
});

test("posting is trusted, permission checked, balanced, and period aware", () => {
  const start = sql.search(/FUNCTION public\.post_finance_journal_entry\(/i);
  assert.ok(start >= 0, "post_finance_journal_entry must exist");
  const body = sql.slice(start, start + 10000);
  assert.match(body, /SECURITY DEFINER/i);
  assert.match(body, /SET search_path = pg_catalog, public/i);
  assert.match(body, /has_permission\('finance\.transactions\.post'\)/i);
  assert.match(body, /FOR UPDATE/i);
  assert.match(body, /status\s*=\s*'closed'/i);
  assert.match(body, /SUM\(CASE WHEN direction = 'debit'/i);
  assert.match(body, /must balance/i);
  assert.match(body, /status\s*=\s*'posted'/i);
});

test("posted entries and lines cannot be silently changed or deleted", () => {
  assert.match(sql, /FUNCTION public\.protect_posted_finance_entry\(\)/i);
  assert.match(sql, /FUNCTION public\.protect_posted_finance_line\(\)/i);
  assert.match(sql, /CREATE TRIGGER protect_posted_finance_entry/i);
  assert.match(sql, /CREATE TRIGGER protect_posted_finance_line/i);
  assert.match(sql, /Posted finance entries are immutable/i);
});

test("reversals preserve history and transfers are explicitly classified", () => {
  assert.match(sql, /FUNCTION public\.reverse_finance_journal_entry\(/i);
  assert.match(sql, /reversal_of_id uuid REFERENCES public\.finance_journal_entries/i);
  assert.match(sql, /entry_type[\s\S]*'transfer'/i);
  assert.match(sql, /finance_income_expense_summary[\s\S]*entry_type NOT IN \('transfer','opening','adjustment'\)/i);
});

test("finance tables deny anonymous access and use RLS with scoped policies", () => {
  assert.match(sql, /ALTER TABLE public\.finance_accounts ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /ALTER TABLE public\.finance_journal_entries ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /has_permission\('finance\.transactions\.view'\)/i);
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*public\.finance_journal_entries[\s\S]*FROM anon/i);
  assert.doesNotMatch(sql, /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\s+ON\s+(?:TABLE\s+)?public\.finance_journal_entries\s+TO authenticated/i);
});

test("posting and reversal functions are the authenticated write boundary", () => {
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.post_finance_journal_entry\(uuid,text\) TO authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.reverse_finance_journal_entry\(uuid,text\) TO authenticated/i);
  assert.match(sql, /audit_logs[\s\S]*finance\.transaction\.posted/i);
  assert.match(sql, /audit_logs[\s\S]*finance\.transaction\.reversed/i);
});
