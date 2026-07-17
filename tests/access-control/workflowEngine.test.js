import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sql = fs.readFileSync(new URL("../../database/supabase-workflow-engine.sql", import.meta.url), "utf8");

for (const table of [
  "workflow_templates", "workflow_template_versions", "workflow_stages", "workflow_instances",
  "workflow_stage_instances", "workflow_assignments", "workflow_decisions", "workflow_comments", "workspace_tasks"
]) {
  test(`${table} is created with row level security`, () => {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"));
  });
}

test("workflow transitions are trusted, finite, and preserve decision history", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.start_workspace_workflow/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.decide_workspace_workflow/i);
  assert.match(sql, /FOR UPDATE/i);
  assert.match(sql, /pending.+approved.+rejected.+changes_requested/is);
  assert.doesNotMatch(sql, /UPDATE\s+public\.workflow_decisions/i);
});

test("workflow decisions prevent self approval and validate assignment ownership", () => {
  assert.match(sql, /requester_id\s*=\s*auth\.uid\(\)/i);
  assert.match(sql, /assigned_to\s*<>\s*auth\.uid\(\)/i);
  assert.match(sql, /public\.has_permission\(/i);
});

test("workspace tasks have canonical dashboard links and completion support", () => {
  assert.match(sql, /deep_link text NOT NULL CHECK \(deep_link LIKE '\/dashboard\/%'\)/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.complete_workspace_task/i);
  assert.match(sql, /workspace_tasks_assignee_status_due_idx/i);
});

test("approved stages advance to the next ordered stage before completing", () => {
  assert.match(sql, /next_stage/i);
  assert.match(sql, /current_stage_sequence\s*=\s*next_stage\.sequence_number/i);
  assert.match(sql, /IF next_stage\.id IS NULL THEN[\s\S]+status='approved'/i);
});

test("workflow RLS policies qualify outer columns to avoid ambiguous identifiers", () => {
  assert.match(sql, /si\.workflow_instance_id\s*=\s*workflow_instances\.id/i);
  assert.doesNotMatch(sql, /si\.workflow_instance_id\s*=\s*id\b/i);
  assert.match(sql, /i\.id\s*=\s*workflow_stage_instances\.workflow_instance_id/i);
  assert.match(sql, /a\.id\s*=\s*workflow_decisions\.assignment_id/i);
});
