import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNT_STATUSES,
  PERMISSIONS,
  ROLE_KEYS,
  SCOPE_TYPES,
  TEAM_KEYS
} from "../../src/services/accessControlCatalog.js";
import {
  compareLegacyAndNormalized,
  getAccessibleGroupIds,
  hasEffectivePermission,
  normalizeEffectiveAccess
} from "../../src/services/accessControlResolver.js";

const future = "2099-01-01T00:00:00.000Z";
const past = "2000-01-01T00:00:00.000Z";

test("normalizes missing access to an inactive denied snapshot", () => {
  const access = normalizeEffectiveAccess();
  assert.equal(access.accountStatus, "missing");
  assert.deepEqual(access.roles, []);
  assert.deepEqual(access.permissions, []);
  assert.deepEqual(access.groupAssignments, []);
  assert.equal(hasEffectivePermission(access, "dashboard.access"), false);
});

for (const accountStatus of ["missing", "invited", "disabled", "suspended", "archived"]) {
  test(`${accountStatus} accounts cannot use protected permissions`, () => {
    const access = normalizeEffectiveAccess({
      accountStatus,
      permissions: [{ key: "dashboard.access", scopeType: "global", scopeId: null }]
    });
    assert.equal(hasEffectivePermission(access, "dashboard.access"), false);
  });
}

test("global permissions apply across resource scopes", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [{ key: "reports.view", scopeType: "global", scopeId: null }]
  });
  assert.equal(hasEffectivePermission(access, "reports.view"), true);
  assert.equal(hasEffectivePermission(access, "reports.view", { type: "group", id: "louvetoux" }), true);
});

test("group permissions match only their assigned group", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [{ key: "attendance.record", scopeType: "group", scopeId: "louvetoux" }]
  });
  assert.equal(hasEffectivePermission(access, "attendance.record", { type: "group", id: "louvetoux" }), true);
  assert.equal(hasEffectivePermission(access, "attendance.record", { type: "group", id: "jeannettes" }), false);
  assert.equal(hasEffectivePermission(access, "attendance.record"), false);
});

test("team event and own-record permissions do not cross scopes", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [
      { key: "finance.view", scopeType: "team", scopeId: "finance" },
      { key: "calendar.update_own", scopeType: "event", scopeId: "camp-2026" },
      { key: "content.edit_own", scopeType: "own_records", scopeId: null }
    ]
  });
  assert.equal(hasEffectivePermission(access, "finance.view", { type: "team", id: "finance" }), true);
  assert.equal(hasEffectivePermission(access, "finance.view", { type: "team", id: "storage" }), false);
  assert.equal(hasEffectivePermission(access, "calendar.update_own", { type: "event", id: "camp-2026" }), true);
  assert.equal(hasEffectivePermission(access, "calendar.update_own", { type: "event", id: "other" }), false);
  assert.equal(hasEffectivePermission(access, "content.edit_own", { type: "own_records", id: null }), true);
  assert.equal(hasEffectivePermission(access, "content.edit_own"), false);
});

test("global and own-record grants require null scope identifiers", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [
      { key: "reports.view", scopeType: "global", scopeId: "unexpected" },
      { key: "content.edit_own", scopeType: "own_records", scopeId: "another-user" }
    ]
  });
  assert.equal(hasEffectivePermission(access, "reports.view"), false);
  assert.equal(hasEffectivePermission(access, "content.edit_own", { type: "own_records", id: null }), false);
});

test("global and own-record grants reject omitted scope identifiers", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [
      { key: "reports.view", scopeType: "global" },
      { key: "content.edit_own", scopeType: "own_records" }
    ]
  });
  assert.equal(hasEffectivePermission(access, "reports.view"), false);
  assert.equal(hasEffectivePermission(access, "content.edit_own", { type: "own_records", id: null }), false);
});

test("unknown permission and request scope types fail closed", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [
      { key: "finance.view", scopeType: "unknown", scopeId: "x" },
      { key: "reports.view", scopeType: "global", scopeId: null }
    ]
  });
  assert.equal(hasEffectivePermission(access, "finance.view", { type: "unknown", id: "x" }), false);
  assert.equal(hasEffectivePermission(access, "reports.view", { type: "unknown", id: "x" }), false);
});

test("resource scopes require text identifiers", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [
      { key: "finance.view", scopeType: "team", scopeId: 42 },
      { key: "storage.view", scopeType: "team", scopeId: "storage" }
    ]
  });
  assert.equal(hasEffectivePermission(access, "finance.view", { type: "team", id: 42 }), false);
  assert.equal(hasEffectivePermission(access, "storage.view", { type: "team", id: 7 }), false);
});

test("a matching direct deny wins over an allow", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [{ key: "media.upload", scopeType: "global", scopeId: null }],
    restrictions: [{ key: "media.upload", effect: "deny", scopeType: "global", scopeId: null }]
  });
  assert.equal(hasEffectivePermission(access, "media.upload"), false);
});

test("malformed direct denies fail closed over valid allows", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [
      { key: "reports.view", scopeType: "global", scopeId: null },
      { key: "finance.view", scopeType: "team", scopeId: "finance" }
    ],
    restrictions: [
      { key: "reports.view", effect: "deny", scopeType: "global" },
      { key: "finance.view", effect: "deny", scopeType: "team", scopeId: 42 }
    ]
  });
  assert.equal(hasEffectivePermission(access, "reports.view"), false);
  assert.equal(hasEffectivePermission(access, "finance.view", { type: "team", id: "finance" }), false);
});

test("expired access entries and restrictions are ignored", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    roles: [{ key: "finance_viewer", scopeType: "team", scopeId: "finance", expiresAt: past }],
    permissions: [
      { key: "finance.view", scopeType: "team", scopeId: "finance", expiresAt: past },
      { key: "storage.view", scopeType: "team", scopeId: "storage", expiresAt: future }
    ],
    restrictions: [
      { key: "storage.view", effect: "deny", scopeType: "team", scopeId: "storage", expiresAt: past }
    ]
  });
  assert.deepEqual(access.roles, []);
  assert.equal(hasEffectivePermission(access, "finance.view", { type: "team", id: "finance" }), false);
  assert.equal(hasEffectivePermission(access, "storage.view", { type: "team", id: "storage" }), true);
});

test("malformed assignment timestamps fail closed", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [
      { key: "finance.view", scopeType: "team", scopeId: "finance", expiresAt: "not-a-date" },
      { key: "storage.view", scopeType: "team", scopeId: "storage", startsAt: "invalid" }
    ]
  });
  assert.deepEqual(access.permissions, []);
});

test("empty timestamps fail closed when explicitly supplied", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [
      { key: "finance.view", scopeType: "team", scopeId: "finance", expiresAt: "" },
      { key: "storage.view", scopeType: "team", scopeId: "storage", startsAt: "" }
    ]
  });
  assert.deepEqual(access.permissions, []);
});

test("non-string and non-canonical timestamps fail closed", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [
      { key: "finance.view", scopeType: "team", scopeId: "finance", startsAt: 0 },
      { key: "storage.view", scopeType: "team", scopeId: "storage", expiresAt: "01/02/2099" },
      { key: "reports.view", scopeType: "global", scopeId: null, expiresAt: future }
    ]
  });
  assert.deepEqual(access.permissions.map((permission) => permission.key), ["reports.view"]);
});

test("impossible ISO calendar timestamps fail closed", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [
      { key: "finance.view", scopeType: "team", scopeId: "finance", expiresAt: "2099-02-30T00:00:00Z" },
      { key: "storage.view", scopeType: "team", scopeId: "storage", expiresAt: "2099-02-28T00:00:00+04:00" }
    ]
  });
  assert.deepEqual(access.permissions.map((permission) => permission.key), ["storage.view"]);
});

test("permission checks fail closed for raw malformed snapshots", () => {
  assert.equal(hasEffectivePermission({
    accountStatus: "active",
    permissions: [{ key: "finance.view", scopeType: "global", scopeId: null, expiresAt: past }],
    restrictions: []
  }, "finance.view"), false);
  assert.equal(hasEffectivePermission({
    accountStatus: "active",
    permissions: "not-an-array",
    restrictions: { effect: "deny" }
  }, "finance.view"), false);
  assert.deepEqual(getAccessibleGroupIds({
    accountStatus: "active",
    groupAssignments: [
      { groupId: "expired", expiresAt: past },
      { groupId: "active", expiresAt: future }
    ]
  }), ["active"]);
  assert.deepEqual(getAccessibleGroupIds({
    accountStatus: "active",
    groupAssignments: "not-an-array"
  }), []);
});

test("accessible groups are active unique and sorted", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    groupAssignments: [
      { groupId: "louvetoux", position: "chief" },
      { groupId: "louvetoux", position: "head_chief" },
      { groupId: "jeannettes", position: "coordinator", expiresAt: future },
      { groupId: "guides", position: "chief", expiresAt: past },
      { groupId: null, position: "chief" }
    ]
  });
  assert.deepEqual(getAccessibleGroupIds(access), ["jeannettes", "louvetoux"]);
});

test("accessible groups reject malformed identifiers", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    groupAssignments: [
      { groupId: 7, position: "chief" },
      { groupId: { id: "object" }, position: "chief" },
      { groupId: "", position: "chief" },
      { groupId: "louvetoux", position: "chief" }
    ]
  });
  assert.deepEqual(getAccessibleGroupIds(access), ["louvetoux"]);
});

test("reports legacy and normalized mismatches", () => {
  assert.deepEqual(compareLegacyAndNormalized({
    legacyAllowed: true,
    normalizedAllowed: false,
    permissionKey: "forms.responses.view_all",
    scope: { type: "global", id: null }
  }), {
    matches: false,
    legacyAllowed: true,
    normalizedAllowed: false,
    permissionKey: "forms.responses.view_all",
    scopeType: "global",
    scopeId: null
  });
});

test("normalizes comparison booleans and omitted scope", () => {
  assert.deepEqual(compareLegacyAndNormalized({
    legacyAllowed: 1,
    normalizedAllowed: "",
    permissionKey: "finance.view"
  }), {
    matches: false,
    legacyAllowed: true,
    normalizedAllowed: false,
    permissionKey: "finance.view",
    scopeType: "global",
    scopeId: null
  });
});

test("catalogue exposes independent Finance and Storage families", () => {
  assert.deepEqual(SCOPE_TYPES, ["global", "group", "team", "event", "own_records"]);
  assert.deepEqual(ACCOUNT_STATUSES, ["invited", "active", "disabled", "suspended", "archived"]);
  assert.deepEqual([
    ROLE_KEYS.FINANCE_VIEWER,
    ROLE_KEYS.FINANCE_CONTRIBUTOR,
    ROLE_KEYS.FINANCE_APPROVER
  ], ["finance_viewer", "finance_contributor", "finance_approver"]);
  assert.deepEqual([
    ROLE_KEYS.STORAGE_ASSISTANT,
    ROLE_KEYS.STORAGE_MANAGER
  ], ["storage_assistant", "storage_manager"]);
  assert.equal(TEAM_KEYS.FINANCE, "finance");
  assert.equal(TEAM_KEYS.STORAGE, "storage");

  const financeKeys = Object.values(PERMISSIONS).filter((key) => key.startsWith("finance."));
  const storageKeys = Object.values(PERMISSIONS).filter((key) => key.startsWith("storage."));
  const legacyFinanceKeys = [
    "finance.approve_transaction",
    "finance.create_transaction",
    "finance.edit_all_transactions",
    "finance.edit_own_transaction",
    "finance.export",
    "finance.manage_categories",
    "finance.manage_settings",
    "finance.upload_receipt",
    "finance.view"
  ];
  const legacyStorageKeys = [
    "storage.adjust_quantity",
    "storage.audit",
    "storage.create_item",
    "storage.export",
    "storage.issue_items",
    "storage.manage_categories",
    "storage.record_returns",
    "storage.update_item",
    "storage.view",
    "storage.write_off"
  ];
  assert.equal(legacyFinanceKeys.every((key) => financeKeys.includes(key)), true);
  assert.equal(legacyStorageKeys.every((key) => storageKeys.includes(key)), true);
  assert.equal(financeKeys.includes("finance.workspace.access"), true);
  assert.equal(storageKeys.includes("storage.workspace.access"), true);
  assert.equal(financeKeys.some((key) => key.startsWith("storage.")), false);
  assert.equal(storageKeys.some((key) => key.startsWith("finance.")), false);
});

test("normalization does not mutate caller arrays", () => {
  const permissions = [{ key: "dashboard.access", scopeType: "global", scopeId: null }];
  const access = normalizeEffectiveAccess({ accountStatus: "active", permissions });
  access.permissions.push({ key: "reports.view", scopeType: "global", scopeId: null });
  assert.equal(permissions.length, 1);
});
