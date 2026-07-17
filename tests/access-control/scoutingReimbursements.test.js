import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sql = fs.readFileSync(new URL("../../database/supabase-scouting-reimbursements.sql", import.meta.url), "utf8");

test("reimbursement forms create one atomic finance workflow record", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.submit_reimbursement_form/i);
  assert.match(sql, /INSERT INTO public\.form_submissions/i);
  assert.match(sql, /INSERT INTO public\.finance_reimbursements/i);
  assert.match(sql, /form_submission_id uuid UNIQUE/i);
});

test("reimbursement submissions enforce targeting, availability, and limits", () => {
  assert.match(sql, /available_from/i);
  assert.match(sql, /target_user_ids/i);
  assert.match(sql, /target_group_ids/i);
  assert.match(sql, /allow_multiple_submissions/i);
  assert.match(sql, /max_submissions/i);
});

test("reimbursement drafts are isolated from completed claims", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.save_reimbursement_form_draft/i);
  assert.match(sql, /status\s*=\s*'draft'/i);
  assert.match(sql, /UPDATE public\.form_submissions[\s\S]*status\s*=\s*'submitted'/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.save_reimbursement_form_draft/i);
});

test("claimants can read only their own reimbursement records", () => {
  assert.match(sql, /CREATE POLICY "claimants read own reimbursements"/i);
  assert.match(sql, /claimant_id\s*=\s*auth\.uid\(\)/i);
  assert.match(sql, /SECURITY DEFINER/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.submit_reimbursement_form/i);
});
