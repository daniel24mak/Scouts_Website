import test from "node:test";
import assert from "node:assert/strict";

import { normalizeBootstrapData } from "../../src/api/bootstrapData.js";
import { normalizeSupabaseRows } from "../../src/services/supabaseClient.js";

test("Supabase row responses always expose an array contract", () => {
  const rows = [{ id: "one" }];

  assert.equal(normalizeSupabaseRows(rows, "example"), rows);
  assert.deepEqual(normalizeSupabaseRows(null, "example"), []);
  assert.throws(
    () => normalizeSupabaseRows({ id: "not-a-list" }, "example"),
    /example returned an invalid row collection/
  );
});

test("dashboard bootstrap normalizes missing and malformed collections", () => {
  const result = normalizeBootstrapData({
    users: undefined,
    groups: null,
    plannedEvents: { error: "unexpected payload" },
    registrationImportSettings: undefined,
    groupingRulesStore: { rules: undefined }
  });

  assert.deepEqual(result.users, []);
  assert.deepEqual(result.groups, []);
  assert.deepEqual(result.plannedEvents, []);
  assert.equal(typeof result.registrationImportSettings, "object");
  assert.deepEqual(result.groupingRulesStore.rules, []);
});
