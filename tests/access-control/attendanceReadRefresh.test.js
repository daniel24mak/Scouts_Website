import assert from "node:assert/strict";
import test from "node:test";
import { attendanceRows, loadAttendanceReadPath } from "./helpers/attendanceReadHarness.js";
import { loadBootstrapHook } from "./helpers/bootstrapHarness.js";

const attendanceTables = Object.keys(attendanceRows);
const tolerantOptions = [undefined, {}, null, { requireAttendance: false }, { requireAttendance: "true" }, { requireAttendance: 1 }];

function failingRows(table, failure) {
  return async (requestedTable) => {
    if (requestedTable === table) throw failure;
    return attendanceRows[requestedTable];
  };
}

for (const table of attendanceTables) {
  // Catch any attendance read catch that still turns an explicitly required
  // failed table into an empty collection.
  test(`required attendance service rejects a failed ${table} read`, async () => {
    const failure = new Error(`${table} unavailable`);
    const { getAttendanceData } = loadAttendanceReadPath({ getSupabaseRows: failingRows(table, failure) });
    await assert.rejects(getAttendanceData({ requireAttendance: true }), (error) => error === failure);
  });

  // Catch lost opt-in forwarding, allSettled suppression, and stale-data
  // replacement using the real service, aggregator, and hook together.
  test(`required refresh preserves stale attendance after a failed ${table} read`, async () => {
    const failure = new Error(`${table} unavailable`);
    const { getBootstrap, loadingData } = loadAttendanceReadPath({ getSupabaseRows: failingRows(table, failure) });
    const stale = {
      ...loadingData,
      attendanceMeetings: [{ id: "stale-scout-session", records: { "scout-one": "Present" } }],
      chiefAttendanceMeetings: [{ id: "stale-chief-session", records: { "chief-one": "Late" } }]
    };
    const hook = loadBootstrapHook(getBootstrap, stale);
    await assert.rejects(hook.refresh({ throwOnError: true, requireAttendance: true }), (error) => error === failure);
    assert.equal(hook.state.data, stale);
    assert.equal(hook.state.data.attendanceMeetings[0].records["scout-one"], "Present");
    assert.equal(hook.state.data.chiefAttendanceMeetings[0].records["chief-one"], "Late");
    assert.equal(hook.state.error, failure);
    assert.equal(hook.state.isLoading, false);
    assert.equal(hook.notifications.length, 1);
    assert.equal(hook.notifications[0].error, failure);
  });
}

test("attendance service keeps default and non-true attendance options tolerant", async () => {
  const failure = new Error("Records unavailable");
  const { getAttendanceData } = loadAttendanceReadPath({ getSupabaseRows: failingRows("attendance_records", failure) });
  for (const options of tolerantOptions) {
    const result = await getAttendanceData(options);
    assert.equal(result.attendanceMeetings[0].id, "scout-session");
    assert.deepEqual(Object.keys(result.attendanceMeetings[0].records), []);
    assert.equal(result.chiefAttendanceMeetings[0].records["chief-one"], "Excused");
  }
});

test("bootstrap keeps default and non-true attendance options tolerant", async () => {
  const failure = new Error("Records unavailable");
  const { getBootstrap } = loadAttendanceReadPath({ getSupabaseRows: failingRows("attendance_records", failure) });
  for (const options of tolerantOptions) {
    const result = await getBootstrap(options);
    assert.equal(result.attendanceMeetings[0].id, "scout-session");
    assert.deepEqual(Object.keys(result.attendanceMeetings[0].records), []);
    assert.equal(result.chiefAttendanceMeetings[0].records["chief-one"], "Excused");
  }
});

test("refresh keeps truthy non-true attendance options tolerant even when errors should throw", async () => {
  const failure = new Error("Records unavailable");
  const { getBootstrap, loadingData } = loadAttendanceReadPath({ getSupabaseRows: failingRows("attendance_records", failure) });
  const hook = loadBootstrapHook(getBootstrap, loadingData);
  for (const requireAttendance of [undefined, false, "true", 1]) {
    const result = await hook.refresh({ throwOnError: true, requireAttendance });
    assert.equal(hook.state.data, result);
    assert.equal(result.attendanceMeetings[0].id, "scout-session");
    assert.equal(result.chiefAttendanceMeetings[0].records["chief-one"], "Excused");
    assert.equal(hook.state.error, null);
  }
});

test("required attendance refresh remains tolerant of unrelated bootstrap service failures", async () => {
  const unavailable = async () => { throw new Error("Unrelated service unavailable"); };
  const { getBootstrap, loadingData } = loadAttendanceReadPath({ otherServices: {
    getProfiles: unavailable,
    getScoutData: unavailable,
    getCalendarEvents: unavailable,
    getPosts: unavailable,
    getGallery: unavailable,
    getWebsiteContent: unavailable,
    getPublicEngagementData: unavailable,
    getEquipeData: unavailable,
    getFormsData: unavailable,
    getNotifications: unavailable,
    getWebsiteContentRevisions: unavailable,
    getDocumentsWorkspaceData: unavailable
  } });
  const hook = loadBootstrapHook(getBootstrap, loadingData);
  const result = await hook.refresh({ throwOnError: true, requireAttendance: true });
  assert.equal(result.attendanceMeetings[0].records["scout-one"], "Absent");
  assert.equal(result.chiefAttendanceMeetings[0].records["chief-one"], "Excused");
  assert.equal(result.users.length, 0);
  assert.equal(result.plannedEvents.length, 0);
  assert.equal(hook.state.data, result);
  assert.equal(hook.state.error, null);
});

test("required local API attendance refresh rejects a failed bootstrap instead of demo data", async () => {
  const failure = new Error("Local bootstrap unavailable");
  const { getBootstrap, loadingData } = loadAttendanceReadPath({
    isSupabaseConfigured: false,
    fetch: async () => { throw failure; }
  });
  const stale = { ...loadingData, attendanceMeetings: [{ id: "persisted-session", records: { "scout-one": "Absent" } }] };
  const hook = loadBootstrapHook(getBootstrap, stale);
  await assert.rejects(hook.refresh({ throwOnError: true, requireAttendance: true }), (error) => error === failure);
  assert.equal(hook.state.data, stale);
  assert.equal(hook.state.data.attendanceMeetings[0].id, "persisted-session");
  assert.equal(hook.state.error, failure);
});

test("default and non-true local API attendance options keep the demo fallback", async () => {
  const { getBootstrap } = loadAttendanceReadPath({
    isSupabaseConfigured: false,
    fetch: async () => { throw new Error("Local bootstrap unavailable"); }
  });
  for (const options of tolerantOptions) {
    const result = await getBootstrap(options);
    assert.equal(result.attendanceMeetings[0].id, "demo-session");
    assert.equal(result.attendanceMeetings[0].records["demo-scout"], "Present");
  }
});

test("required local API attendance refresh returns successful server data", async () => {
  const { getBootstrap, loadingData } = loadAttendanceReadPath({
    isSupabaseConfigured: false,
    fetch: async () => ({
      ok: true,
      json: async () => ({ attendanceMeetings: [{ id: "local-session", records: { "scout-one": "Absent" } }] })
    })
  });
  const hook = loadBootstrapHook(getBootstrap, loadingData);
  const result = await hook.refresh({ throwOnError: true, requireAttendance: true });
  assert.equal(result.attendanceMeetings[0].id, "local-session");
  assert.equal(result.attendanceMeetings[0].records["scout-one"], "Absent");
  assert.equal(hook.state.data, result);
  assert.equal(hook.state.error, null);
});
