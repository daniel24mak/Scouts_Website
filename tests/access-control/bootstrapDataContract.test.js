import test from "node:test";
import assert from "node:assert/strict";

import { normalizeBootstrapData } from "../../src/api/bootstrapData.js";
import { normalizeSupabaseRows } from "../../src/services/supabaseClient.js";
import { loadBootstrapHook } from "./helpers/bootstrapHarness.js";

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

test("bootstrap refresh defaults to stale data while retaining the load error", async () => {
  const failure = new Error("Bootstrap unavailable");
  const stale = { groups: [{ id: "stale-group" }] };
  const { refresh, state, notifications } = loadBootstrapHook(async () => { throw failure; }, stale);
  for (const options of [undefined, {}, null, { throwOnError: false }, { throwOnError: "true" }]) {
    assert.equal(await refresh(options), stale);
    assert.equal(state.data, stale);
    assert.equal(state.error, failure);
    assert.equal(state.isLoading, false);
  }
  assert.equal(notifications.length, 5);
  assert.ok(notifications.every(({ error, details }) => error === failure && details.source === "dashboard-bootstrap"));
});

test("bootstrap refresh explicitly opts into the same load error without clearing stale data", async () => {
  const failure = new Error("Bootstrap unavailable");
  const stale = { groups: [{ id: "stale-group" }] };
  const { refresh, state, notifications } = loadBootstrapHook(async () => { throw failure; }, stale);
  await assert.rejects(refresh({ throwOnError: true }), (error) => error === failure);
  assert.equal(state.data, stale);
  assert.equal(state.error, failure);
  assert.equal(state.isLoading, false);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].error, failure);
});

test("bootstrap refresh opt-in returns normalized data and clears prior errors on success", async () => {
  const failure = new Error("Bootstrap unavailable");
  let fails = true;
  const { refresh, state } = loadBootstrapHook(async () => {
    if (fails) throw failure;
    return { groups: [{ id: "new-group" }] };
  }, { groups: [{ id: "stale-group" }] });
  await refresh();
  assert.equal(state.error, failure);
  fails = false;
  const nextData = await refresh({ throwOnError: true });
  assert.equal(state.data, nextData);
  assert.deepEqual(nextData.groups, [{ id: "new-group" }]);
  assert.deepEqual(nextData.users, []);
  assert.equal(state.error, null);
  assert.equal(state.isLoading, false);
});
