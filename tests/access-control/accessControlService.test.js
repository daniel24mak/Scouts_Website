import assert from "node:assert/strict";
import test from "node:test";

import { createAccessControlService } from "../../src/services/accessControlService.js";

test("normalizes the effective-access RPC payload", async () => {
  const calls = [];
  const service = createAccessControlService({
    callRpc: async (name, payload) => {
      calls.push([name, payload]);
      return { accountStatus: "active", permissions: [{ key: "reports.view", scopeType: "global", scopeId: null }] };
    },
    getRows: async () => []
  });

  const access = await service.getMyEffectiveAccess();
  assert.deepEqual(calls, [["get_my_effective_access", {}]]);
  assert.equal(access.accountStatus, "active");
  assert.deepEqual(access.permissions.map(({ key }) => key), ["reports.view"]);
});

test("RPC failure returns a denied snapshot with a safe load error", async () => {
  const service = createAccessControlService({ callRpc: async () => { throw new Error("secret backend detail"); } });
  const access = await service.getMyEffectiveAccess();

  assert.equal(access.accountStatus, "missing");
  assert.deepEqual(access.permissions, []);
  assert.equal(access.loadError, "Effective access could not be loaded.");
  assert.doesNotMatch(access.loadError, /secret/i);
});

test("migration differences are requested only for legacy administrators", async () => {
  const rowCalls = [];
  const service = createAccessControlService({
    callRpc: async () => ({ accountStatus: "active" }),
    getRows: async (table, query) => {
      rowCalls.push([table, query]);
      return [{ user_id: "user-1", permission_key: "forms.post.approve", legacy_allowed: true, normalized_allowed: false }];
    }
  });

  const chiefResult = await service.getBootstrapShadowAccess({ isLegacyAdmin: false });
  assert.deepEqual(chiefResult.authorizationMigrationDifferences, []);
  assert.equal(rowCalls.length, 0);

  const adminResult = await service.getBootstrapShadowAccess({ isLegacyAdmin: true });
  assert.equal(rowCalls.length, 1);
  assert.equal(adminResult.authorizationMigrationDifferences[0].permissionKey, "forms.post.approve");
});

test("shadow service does not accept auth metadata as authorization input", () => {
  const source = createAccessControlService.toString();
  assert.doesNotMatch(source, /user_metadata|app_metadata|auth.*metadata/i);
});
