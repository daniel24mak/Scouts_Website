import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("focused workspaces keep My Work and Notifications inside the active workspace", () => {
  const shell = read("../../src/workspaces/FocusedWorkspaceShell.jsx");
  assert.doesNotMatch(shell, /dashboard\/scouting\/notifications/);
  assert.doesNotMatch(shell, /navigate\("\/dashboard\/my-work"\)/);
  assert.match(shell, /selectSection\("myWork"\)/);
  assert.match(shell, /selectSection\("notifications"\)/);
});

test("Finance and Storage render shared sections instead of domain workflow panels", () => {
  const finance = read("../../src/features/finance/FinanceWorkspace.jsx");
  const storage = read("../../src/features/storage/StorageWorkspace.jsx");
  for (const source of [finance, storage]) {
    assert.match(source, /WorkspaceMyWork/);
    assert.match(source, /WorkspaceNotifications/);
    assert.match(source, /WorkspaceActivityLog/);
  }
});

test("workspace reports read module-scoped audit logs", () => {
  const auditService = read("../../src/services/auditService.js");
  assert.match(auditService, /getWorkspaceAuditLogs/);
  assert.match(auditService, /module=eq\./);
});

test("workspace searches live with page content instead of the shared top bar", () => {
  const shell = read("../../src/workspaces/FocusedWorkspaceShell.jsx");
  const dashboard = read("../../src/pages/AdminDashboardPage.jsx");
  const records = read("../../src/workspaces/WorkspaceRecordManager.jsx");

  assert.doesNotMatch(shell, /dashboard-topbar-search|dashboard-mobile-search-toggle|Search current section/);
  assert.doesNotMatch(dashboard, /dashboard-topbar-search|dashboard-mobile-search-toggle|Search current section/);
  assert.match(dashboard, /dashboard-page-search/);
  assert.match(records, /workspace-manager-search/);
});
