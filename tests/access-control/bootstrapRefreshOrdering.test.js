import assert from "node:assert/strict";
import test from "node:test";
import { attendanceRows, loadAttendanceReadPath } from "./helpers/attendanceReadHarness.js";
import { loadBootstrapOrderingRuntime } from "./helpers/bootstrapOrderingHarness.js";

function deferred() {
  let resolve;
  const promise = new Promise((accept) => { resolve = accept; });
  return { promise, resolve };
}

function controlledReads() {
  const requests = [];
  let activeRequest;
  const path = loadAttendanceReadPath({ getSupabaseRows: (table) => {
    if (table === "attendance_sessions") {
      activeRequest = { pending: deferred(), status: "Present", error: null };
      requests.push(activeRequest);
    }
    const request = activeRequest;
    return request.pending.promise.then(() => {
      if (request.error && table === "attendance_records") throw request.error;
      if (table === "attendance_records") return [{ ...attendanceRows.attendance_records[0], status: request.status }];
      return attendanceRows[table];
    });
  } });
  return {
    ...path,
    requests,
    succeed: (index, status) => { requests[index].status = status; requests[index].pending.resolve(); },
    fail: (index, error) => { requests[index].error = error; requests[index].pending.resolve(); }
  };
}

const strict = { throwOnError: true, requireAttendance: true };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const scoutStatus = (data) => data.attendanceMeetings[0]?.records["scout-one"];

test("newer required refresh survives an older forced poll in rendered data and shared cache", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const hook = runtime.mount({ runEffects: false });
  const oldPoll = hook.refresh();
  const requiredRefresh = hook.refresh(strict);
  reads.succeed(1, "Absent");
  const savedData = await requiredRefresh;
  assert.equal(scoutStatus(savedData), "Absent");
  reads.succeed(0, "Present");
  const oldResult = await oldPoll;
  assert.equal(scoutStatus(oldResult), "Present", "superseded callers retain their original resolved result");
  assert.equal(hook.state.data, savedData);
  assert.equal(scoutStatus(hook.state.data), "Absent");
  const laterHook = runtime.mount();
  assert.equal(laterHook.state.data, savedData, "a new hook must read the newer cached result");
  assert.equal(reads.requests.length, 2);
});

test("older completion cannot clear loading or replace data while the newer refresh is pending", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const hook = runtime.mount({ runEffects: false });
  const oldPoll = hook.refresh();
  const requiredRefresh = hook.refresh(strict);
  reads.succeed(0, "Present");
  await oldPoll;
  assert.equal(hook.state.data, reads.loadingData);
  assert.equal(hook.state.isLoading, true);
  assert.equal(hook.state.error, null);
  const joiningHook = runtime.mount();
  assert.equal(reads.requests.length, 2, "initial loads must join the newest same-user request");
  reads.succeed(1, "Absent");
  const savedData = await requiredRefresh;
  await flush();
  assert.equal(hook.state.data, savedData);
  assert.equal(joiningHook.state.data, savedData);
  assert.equal(hook.state.isLoading, false);
});

test("an older required failure cannot overwrite newer success or announce a stale load error", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const hook = runtime.mount({ runEffects: false });
  const oldRefresh = hook.refresh(strict);
  const failure = new Error("Old attendance read failed");
  const oldRejection = assert.rejects(oldRefresh, (error) => error === failure);
  const newRefresh = hook.refresh(strict);
  reads.succeed(1, "Absent");
  const savedData = await newRefresh;
  reads.fail(0, failure);
  await oldRejection;
  assert.equal(hook.state.data, savedData);
  assert.equal(hook.state.error, null);
  assert.equal(hook.state.isLoading, false);
  assert.equal(runtime.notifications.length, 0);
});

test("a stale required failure leaves newer pending loading and error state untouched", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const hook = runtime.mount({ runEffects: false });
  const failure = new Error("Old attendance read failed");
  const oldRejection = assert.rejects(hook.refresh(strict), (error) => error === failure);
  const newRefresh = hook.refresh(strict);
  reads.fail(0, failure);
  await oldRejection;
  assert.equal(hook.state.data, reads.loadingData);
  assert.equal(hook.state.error, null);
  assert.equal(hook.state.isLoading, true);
  assert.equal(runtime.notifications.length, 0);
  reads.succeed(1, "Absent");
  await newRefresh;
  assert.equal(scoutStatus(hook.state.data), "Absent");
});

test("an older success cannot replace the newest required error or enter the shared cache", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const hook = runtime.mount({ runEffects: false });
  const oldPoll = hook.refresh();
  const failure = new Error("Newest attendance read failed");
  const newRejection = assert.rejects(hook.refresh(strict), (error) => error === failure);
  reads.fail(1, failure);
  await newRejection;
  reads.succeed(0, "Present");
  await oldPoll;
  assert.equal(hook.state.data, reads.loadingData);
  assert.equal(hook.state.error, failure);
  assert.equal(hook.state.isLoading, false);
  assert.equal(runtime.mount({ runEffects: false }).state.data, reads.loadingData);
  assert.equal(runtime.notifications.length, 1);
  assert.equal(runtime.notifications[0].error, failure);
});

test("an older failure cannot replace a newer failure while each opted-in caller still rejects", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const hook = runtime.mount({ runEffects: false });
  const oldFailure = new Error("Old attendance read failed");
  const newFailure = new Error("Newest attendance read failed");
  const oldRejection = assert.rejects(hook.refresh(strict), (error) => error === oldFailure);
  const newRejection = assert.rejects(hook.refresh(strict), (error) => error === newFailure);
  reads.fail(1, newFailure);
  await newRejection;
  reads.fail(0, oldFailure);
  await oldRejection;
  assert.equal(hook.state.error, newFailure);
  assert.equal(runtime.notifications.length, 1);
  assert.equal(runtime.notifications[0].error, newFailure);
});

test("globally superseded initial hooks adopt the newer required result instead of stale initial data", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const first = runtime.mount();
  const second = runtime.mount();
  assert.equal(reads.requests.length, 1, "same-user initial loads share one request");
  const newerRefresh = second.refresh(strict);
  reads.succeed(1, "Absent");
  const savedData = await newerRefresh;
  reads.succeed(0, "Present");
  await flush();
  assert.equal(first.state.data, savedData);
  assert.equal(second.state.data, savedData);
  assert.equal(first.state.isLoading, false);
  assert.equal(second.state.isLoading, false);
  assert.equal(first.state.error, null);
  assert.equal(runtime.mount().state.data, savedData);
});

test("an initial hook adopts the newest pending request when its old initial result arrives first", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const first = runtime.mount();
  const second = runtime.mount();
  const newerRefresh = second.refresh(strict);
  reads.succeed(0, "Present");
  await flush();
  assert.equal(first.state.data, reads.loadingData);
  assert.equal(second.state.data, reads.loadingData);
  assert.equal(first.state.isLoading, true);
  reads.succeed(1, "Absent");
  const savedData = await newerRefresh;
  await flush();
  assert.equal(first.state.data, savedData);
  assert.equal(first.state.isLoading, false);
});

test("superseded initial hooks adopt the newest required failure and finish loading without stale data", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const first = runtime.mount();
  const second = runtime.mount();
  const failure = new Error("Newest attendance read failed");
  const newRejection = assert.rejects(second.refresh(strict), (error) => error === failure);
  reads.fail(1, failure);
  await newRejection;
  reads.succeed(0, "Present");
  await flush();
  assert.equal(first.state.data, reads.loadingData);
  assert.equal(second.state.data, reads.loadingData);
  assert.equal(first.state.error, failure);
  assert.equal(second.state.error, failure);
  assert.equal(first.state.isLoading, false);
  assert.equal(second.state.isLoading, false);
  assert.equal(runtime.notifications.length, 1);
});

test("same-user initial deduplication and cached initial loads still settle both hooks", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const first = runtime.mount();
  const second = runtime.mount();
  assert.equal(reads.requests.length, 1);
  reads.succeed(0, "Late");
  await flush();
  assert.equal(scoutStatus(first.state.data), "Late");
  assert.equal(first.state.data, second.state.data);
  assert.equal(first.state.isLoading, false);
  assert.equal(second.state.isLoading, false);
  assert.equal(runtime.mount().state.data, first.state.data);
  assert.equal(reads.requests.length, 1);
});

test("required read errors remain tolerant at the hook unless throwOnError is exactly true", async () => {
  for (const throwOnError of [undefined, false, "true"]) {
    const reads = controlledReads();
    const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
    const hook = runtime.mount({ runEffects: false });
    const failure = new Error("Attendance read failed");
    const refreshing = hook.refresh({ requireAttendance: true, throwOnError });
    reads.fail(0, failure);
    assert.equal(await refreshing, reads.loadingData);
    assert.equal(hook.state.data, reads.loadingData);
    assert.equal(hook.state.error, failure);
    assert.equal(hook.state.isLoading, false);
  }
});

test("an account switch prevents the pending initial result from rendering or entering cache", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const hook = runtime.mount();
  runtime.setUserId("another-user");
  reads.succeed(0, "Present");
  await flush();
  assert.equal(hook.state.data, reads.loadingData);
  runtime.setUserId("current-user");
  assert.equal(runtime.mount({ runEffects: false }).state.data, reads.loadingData);
});

test("unmount cancels an initial hook while it adopts the newest pending request", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const first = runtime.mount();
  const second = runtime.mount();
  const newerRefresh = second.refresh(strict);
  reads.succeed(0, "Present");
  await flush();
  first.unmount();
  reads.succeed(1, "Absent");
  await newerRefresh;
  await flush();
  assert.equal(first.state.data, reads.loadingData);
  assert.equal(second.state.data.attendanceMeetings[0].records["scout-one"], "Absent");
});

test("a forced refresh superseded by another hook still adopts canonical data and finishes initial loading", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const first = runtime.mount();
  const second = runtime.mount();
  const oldForced = first.refresh(strict);
  const newestForced = second.refresh(strict);
  reads.succeed(1, "Late");
  const oldResult = await oldForced;
  assert.equal(scoutStatus(oldResult), "Late", "original forced caller retains its own result");
  reads.succeed(0, "Present");
  await flush();
  assert.equal(first.state.data, reads.loadingData);
  assert.equal(first.state.isLoading, true);
  reads.succeed(2, "Absent");
  const canonicalData = await newestForced;
  await flush();
  assert.equal(first.state.data, canonicalData);
  assert.equal(second.state.data, canonicalData);
  assert.equal(first.state.isLoading, false);
  assert.equal(first.state.error, null);
});

test("a globally superseded forced failure retains its rejection but adopts the latest error and finishes loading", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const first = runtime.mount();
  const second = runtime.mount();
  const oldFailure = new Error("Old forced read failed");
  const latestFailure = new Error("Latest forced read failed");
  const oldRejection = assert.rejects(first.refresh(strict), (error) => error === oldFailure);
  const latestRejection = assert.rejects(second.refresh(strict), (error) => error === latestFailure);
  reads.fail(1, oldFailure);
  await oldRejection;
  reads.succeed(0, "Present");
  await flush();
  assert.equal(first.state.error, null);
  assert.equal(first.state.isLoading, true);
  reads.fail(2, latestFailure);
  await latestRejection;
  await flush();
  assert.equal(first.state.error, latestFailure);
  assert.equal(second.state.error, latestFailure);
  assert.equal(first.state.isLoading, false);
  assert.equal(first.state.data, reads.loadingData);
  assert.equal(runtime.notifications.length, 1);
  assert.equal(runtime.notifications[0].error, latestFailure);
});

test("unmount cancels a forced refresh before it can change rendered state", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const hook = runtime.mount();
  const refreshing = hook.refresh(strict);
  hook.unmount();
  reads.succeed(1, "Absent");
  const result = await refreshing;
  reads.succeed(0, "Present");
  await flush();
  assert.equal(scoutStatus(result), "Absent");
  assert.equal(hook.state.data, reads.loadingData);
});

test("a joined initial hook adopts completed canonical data while its obsolete request remains pending", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const first = runtime.mount();
  const second = runtime.mount();
  const newestRefresh = second.refresh(strict);
  reads.succeed(1, "Absent");
  const canonicalData = await newestRefresh;
  await flush();
  assert.equal(first.state.data, canonicalData);
  assert.equal(first.state.isLoading, false);
  assert.equal(first.state.error, null);
  reads.succeed(0, "Present");
  await flush();
  assert.equal(first.state.data, canonicalData);
});

test("a joined initial hook adopts the newest error while its obsolete request remains pending", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const first = runtime.mount();
  const second = runtime.mount();
  const failure = new Error("Newest required read failed");
  const newestRejection = assert.rejects(second.refresh(strict), (error) => error === failure);
  reads.fail(1, failure);
  await newestRejection;
  await flush();
  assert.equal(first.state.error, failure);
  assert.equal(first.state.isLoading, false);
  assert.equal(first.state.data, reads.loadingData);
  reads.succeed(0, "Present");
  await flush();
  assert.equal(first.state.error, failure);
});

test("a forced hook adopts canonical data without waiting for its superseded refresh caller to return", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const first = runtime.mount();
  const second = runtime.mount();
  let oldCallerReturned = false;
  const oldRefresh = first.refresh(strict);
  oldRefresh.then(() => { oldCallerReturned = true; });
  const newestRefresh = second.refresh(strict);
  reads.succeed(2, "Absent");
  const canonicalData = await newestRefresh;
  await flush();
  assert.equal(first.state.data, canonicalData);
  assert.equal(first.state.isLoading, false);
  assert.equal(oldCallerReturned, false, "canonical state adoption does not change the original caller's promise");
  reads.succeed(1, "Late");
  const originalData = await oldRefresh;
  assert.equal(scoutStatus(originalData), "Late");
  reads.succeed(0, "Present");
  await flush();
  assert.equal(first.state.data, canonicalData);
});

test("a forced hook adopts the canonical error while its original rejection remains pending", async () => {
  const reads = controlledReads();
  const runtime = loadBootstrapOrderingRuntime(reads.getBootstrap, reads.loadingData);
  const first = runtime.mount();
  const second = runtime.mount();
  const originalFailure = new Error("Original required read failed");
  const canonicalFailure = new Error("Canonical required read failed");
  const originalRejection = assert.rejects(first.refresh(strict), (error) => error === originalFailure);
  const canonicalRejection = assert.rejects(second.refresh(strict), (error) => error === canonicalFailure);
  reads.fail(2, canonicalFailure);
  await canonicalRejection;
  await flush();
  assert.equal(first.state.error, canonicalFailure);
  assert.equal(first.state.isLoading, false);
  reads.fail(1, originalFailure);
  await originalRejection;
  reads.succeed(0, "Present");
  await flush();
  assert.equal(first.state.error, canonicalFailure);
});
