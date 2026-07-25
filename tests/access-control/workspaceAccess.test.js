import test from "node:test";
import assert from "node:assert/strict";
import {
  getAvailableWorkspaces,
  isWorkspaceRouteAllowed,
  resolveWorkspaceDestination
} from "../../src/workspaces/workspaceAccess.js";

const activeAccess = (permissions = [], extra = {}) => ({
  accountStatus: "active",
  permissions: permissions.map((key) => ({ key, scopeType: "global", scopeId: null })),
  roles: [],
  restrictions: [],
  ...extra
});

test("a Chief with legacy access only sees the Scouting workspace", () => {
  const workspaces = getAvailableWorkspaces({
    user: { role: "chief", accountStatus: "active" }
  });

  assert.deepEqual(workspaces.map(({ key }) => key), ["scouting"]);
});

test("normalized permissions expose every explicitly granted workspace", () => {
  const workspaces = getAvailableWorkspaces({
    user: { role: "chief", accountStatus: "active" },
    effectiveAccess: activeAccess([
      "scouting.workspace.access",
      "finance.workspace.access",
      "storage.workspace.access"
    ])
  });

  assert.deepEqual(workspaces.map(({ key }) => key), ["scouting", "finance", "storage"]);
});

test("service permissions do not expose department management workspaces", () => {
  const workspaces = getAvailableWorkspaces({
    effectiveAccess: activeAccess(["finance.view", "storage.view"])
  });

  assert.deepEqual(workspaces.map(({ key }) => key), []);
});

test("a direct deny wins over a matching workspace allow", () => {
  const effectiveAccess = activeAccess(["finance.workspace.access"], {
    restrictions: [{
      key: "finance.workspace.access",
      effect: "deny",
      scopeType: "global",
      scopeId: null
    }]
  });

  assert.equal(isWorkspaceRouteAllowed({ workspaceKey: "finance", effectiveAccess }), false);
});

test("expired workspace grants do not provide access", () => {
  const effectiveAccess = activeAccess([], {
    permissions: [{
      key: "storage.workspace.access",
      scopeType: "global",
      scopeId: null,
      expiresAt: "2000-01-01T00:00:00.000Z"
    }]
  });

  assert.equal(isWorkspaceRouteAllowed({ workspaceKey: "storage", effectiveAccess }), false);
});

test("an Admin remains compatible when normalized access is unavailable", () => {
  const workspaces = getAvailableWorkspaces({
    user: { role: "admin", accountStatus: "active" }
  });

  assert.deepEqual(workspaces.map(({ key }) => key), [
    "scouting",
    "finance",
    "storage",
    "media",
    "admin"
  ]);
});

test("a stale saved workspace falls back to the first allowed workspace", () => {
  const destination = resolveWorkspaceDestination({
    requestedWorkspace: "storage",
    lastWorkspace: "finance",
    effectiveAccess: activeAccess(["scouting.workspace.access"])
  });

  assert.deepEqual(destination, { workspaceKey: "scouting", path: "/dashboard/scouting" });
});

test("an allowed requested workspace wins over saved preferences", () => {
  const destination = resolveWorkspaceDestination({
    requestedWorkspace: "finance",
    lastWorkspace: "storage",
    preferredWorkspace: "scouting",
    effectiveAccess: activeAccess([
      "scouting.workspace.access",
      "finance.workspace.access",
      "storage.workspace.access"
    ])
  });

  assert.deepEqual(destination, { workspaceKey: "finance", path: "/dashboard/finance" });
});

test("the last valid route is restored only inside its allowed workspace", () => {
  const destination = resolveWorkspaceDestination({
    requestedWorkspace: "finance",
    lastRoutes: {
      finance: "/dashboard/finance/transactions",
      storage: "/dashboard/storage/inventory"
    },
    effectiveAccess: activeAccess(["finance.workspace.access"])
  });

  assert.deepEqual(destination, {
    workspaceKey: "finance",
    path: "/dashboard/finance/transactions"
  });
});

test("a fresh login opens an allowed workspace overview instead of a saved section", () => {
  const destination = resolveWorkspaceDestination({
    user: { role: "admin", accountStatus: "active" },
    startAtOverview: true,
    lastWorkspace: "storage",
    lastRoutes: {
      storage: "/dashboard/storage/inventory",
      admin: "/dashboard/admin/users"
    }
  });

  assert.deepEqual(destination, {
    workspaceKey: "admin",
    path: "/dashboard/admin"
  });
});

test("a fresh department login opens its permitted overview", () => {
  const destination = resolveWorkspaceDestination({
    startAtOverview: true,
    lastWorkspace: "finance",
    lastRoutes: {
      finance: "/dashboard/finance/transactions"
    },
    effectiveAccess: activeAccess(["finance.workspace.access"])
  });

  assert.deepEqual(destination, {
    workspaceKey: "finance",
    path: "/dashboard/finance"
  });
});

test("a manipulated last route cannot escape the selected workspace", () => {
  const destination = resolveWorkspaceDestination({
    requestedWorkspace: "finance",
    lastRoutes: { finance: "/dashboard/admin/users" },
    effectiveAccess: activeAccess(["finance.workspace.access"])
  });

  assert.deepEqual(destination, { workspaceKey: "finance", path: "/dashboard/finance" });
});

test("users with no workspace access receive no destination", () => {
  assert.equal(resolveWorkspaceDestination({
    user: { role: "chief", accountStatus: "disabled" }
  }), null);
});
