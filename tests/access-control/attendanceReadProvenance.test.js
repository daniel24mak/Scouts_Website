import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { attendanceRows, loadAttendanceReadPath } from "./helpers/attendanceReadHarness.js";
import { loadBootstrapOrderingRuntime } from "./helpers/bootstrapOrderingHarness.js";

function loadDraft() {
  const source = fs.readFileSync(new URL("../../src/features/attendance/useAttendanceDraft.js", import.meta.url), "utf8")
    .replace(/import[^;]+;/g, "").replace(/export /g, "");
  const values = [];
  const refs = [];
  let stateIndex;
  let refIndex;
  const useAttendanceDraft = vm.runInNewContext(`${source}\nuseAttendanceDraft`, {
    useState: (initial) => {
      const index = stateIndex++;
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], (update) => { values[index] = typeof update === "function" ? update(values[index]) : update; }];
    },
    useRef: (initial) => refs[refIndex++] ??= { current: initial }
  });
  return (data) => {
    stateIndex = 0;
    refIndex = 0;
    return useAttendanceDraft("wolves/group/2026-10-11", data.attendanceMeetings[0]?.records, data.attendanceReadComplete);
  };
}

test("confirmed attendance survives strict failure and a failed tolerant poll, then reconciles only successful reads without losing newer edits", async () => {
  for (const newerEdit of [null, "Late"]) {
    let readFails = false;
    let status = "Present";
    const failure = new Error("Attendance records unavailable");
    const path = loadAttendanceReadPath({ getSupabaseRows: async (table) => {
      if (table === "attendance_records") {
        if (readFails) throw failure;
        return [{ ...attendanceRows.attendance_records[0], status }];
      }
      return attendanceRows[table];
    } });
    const runtime = loadBootstrapOrderingRuntime(path.getBootstrap, path.loadingData);
    const bootstrap = runtime.mount({ runEffects: false });
    await bootstrap.refresh({ requireAttendance: true, throwOnError: true });
    const renderDraft = loadDraft();
    let draft = renderDraft(bootstrap.state.data);
    draft.setRecords({ "scout-one": "Absent" });
    draft = renderDraft(bootstrap.state.data);
    const submittedEdits = { ...draft.records };
    if (newerEdit) {
      draft.setRecords({ "scout-one": newerEdit });
      draft = renderDraft(bootstrap.state.data);
    }
    // Install the production hook's confirmed RPC snapshot, then exercise the
    // real service -> aggregator -> bootstrap hook for all following reads.
    draft.commitSubmittedRecords({ "scout-one": "Absent" }, submittedEdits);
    const previousData = bootstrap.state.data;
    readFails = true;
    await assert.rejects(bootstrap.refresh({ requireAttendance: true, throwOnError: true }), (error) => error === failure);
    assert.equal(bootstrap.state.data, previousData);
    draft = renderDraft(bootstrap.state.data);
    assert.equal(draft.effectiveRecords["scout-one"], newerEdit ?? "Absent");

    const failedPoll = await bootstrap.refresh();
    assert.equal(bootstrap.state.error, null, "default callers retain the tolerant poll contract");
    assert.equal(Object.keys(failedPoll.attendanceMeetings[0].records).length, 0, "failed tolerant reads keep their existing empty-record fallback");
    draft = renderDraft(bootstrap.state.data);
    assert.equal(draft.effectiveRecords["scout-one"] ?? "Present", newerEdit ?? "Absent", "a failed tolerant read must not turn confirmed Absent into Present");
    draft.clearCommittedRecords();
    draft = renderDraft(bootstrap.state.data);
    assert.equal(draft.effectiveRecords["scout-one"] ?? "Present", newerEdit ?? "Absent", "invalid read provenance must also guard explicit overlay cleanup");

    readFails = false;
    status = "Excused";
    await bootstrap.refresh();
    draft = renderDraft(bootstrap.state.data);
    assert.equal(draft.effectiveRecords["scout-one"], newerEdit ?? "Excused", "a successful authoritative read replaces only the committed fallback");
  }
});
