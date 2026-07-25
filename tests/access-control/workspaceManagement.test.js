import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("workspace routes remount dashboard workspaces instead of emitting stale sections", async () => {
  const source = await read("src/workspaces/DashboardWorkspaceRoute.jsx");
  assert.match(source, /<DashboardComponent\s+key=\{workspace\.key\}/);
});

test("fresh login navigation starts at overview without changing reload restoration", async () => {
  const [loginSource, routeSource] = await Promise.all([
    read("src/pages/LoginPage.jsx"),
    read("src/workspaces/DashboardWorkspaceRoute.jsx")
  ]);

  assert.match(loginSource, /freshLogin:\s*true/);
  assert.match(routeSource, /location\.state\?\.freshLogin\s*===\s*true/);
  assert.match(routeSource, /startAtOverview:\s*isFreshLogin/);
});

test("Finance and Storage management migration protects mutations and supports collection lifecycle", async () => {
  const sql = await read("database/supabase-finance-storage-management.sql");
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.manage_finance_record/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.manage_storage_record/);
  assert.match(sql, /finance\.collections\.manage/);
  assert.match(sql, /payload->>'status' IN \('open','cancelled'\)/);
  assert.match(sql, /storage\.update_item/);
  assert.match(sql, /INSERT INTO public\.audit_logs/);
  assert.match(sql, /normalize_workspace_audit_compatibility/);
  assert.match(sql, /entity_type/);
  assert.match(sql, /entity_id/);
});
