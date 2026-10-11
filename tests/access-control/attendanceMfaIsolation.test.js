import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const dashboard = readFileSync(new URL("../../src/pages/AdminDashboardPage.jsx", import.meta.url), "utf8");
const recoveryEffect = [...dashboard.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[([^\]]*)\]\);/g)]
  .find((effect) => effect[1].includes("void hydrateScoutYearDeletionRecovery()"));
assert.ok(recoveryEffect, "dashboard must retain an automatic recovery effect");
const recoveryHandler = dashboard.match(/const hydrateScoutYearDeletionRecovery = async \(\) => \{[\s\S]*?\n  \};/)?.[0];
assert.ok(recoveryHandler, "dashboard must retain its recovery handler");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

function recoveryHarness(endpoint = async () => ({ claims: [] })) {
  const state = { status: "loading", error: "", backups: {}, messages: [], requests: 0, errorUpdates: [] };
  const context = {
    scoutYearOperationUserRef: { current: "admin" },
    scoutYearRecoveryVersionRef: { current: 0 },
    scoutYearOperationsMountedRef: { current: true },
    scoutYearBackupVersionRef: { current: {} },
    scoutYearBackupBusyRef: { current: new Set() },
    scoutYearsRef: { current: [{ id: "inactive-year", isActive: false }] },
    getScoutYearDeletionRecovery: () => { state.requests += 1; return endpoint(); },
    setScoutYearRecoveryStatus: (value) => { state.status = value; },
    setScoutYearRecoveryError: (value) => { state.error = value; state.errorUpdates.push(value); },
    setScoutYearBackups: (update) => { state.backups = update(state.backups); },
    setSaveMessage: (message) => { state.messages.push(message); }
  };
  const hydrate = vm.runInNewContext(`${recoveryHandler}\nhydrateScoutYearDeletionRecovery`, context);
  let previousDependencies;
  const requests = [];
  const render = (activeSection, user = { id: "admin", systemAdmin: true }, years = context.scoutYearsRef.current) => {
    context.scoutYearOperationUserRef.current = user?.id;
    context.scoutYearsRef.current = years;
    vm.runInNewContext(`useEffect(() => {${recoveryEffect[1]}\n}, [${recoveryEffect[2]}]);`, {
      activeSection,
      user,
      data: { scoutYears: years },
      canManageSystem: (candidate) => Boolean(candidate?.systemAdmin),
      hydrateScoutYearDeletionRecovery: () => {
        const request = hydrate();
        requests.push(request);
        return request;
      },
      useEffect: (callback, dependencies) => {
        if (!previousDependencies || dependencies.some((value, index) => !Object.is(value, previousDependencies[index]))) {
          previousDependencies = dependencies;
          callback();
        }
      }
    });
  };
  return { state, context, hydrate, render, settle: () => Promise.all(requests) };
}

test("admin dashboard and non-registration navigation never request retention recovery", async () => {
  const flow = recoveryHarness();
  const sections = [...dashboard.matchAll(/if \(activeSection === "([^"]+)"\)/g)]
    .map((match) => match[1]).filter((section) => section !== "scouts");
  for (const section of ["overview", "scoutAttendance", "chiefAttendance", "attendanceSheets", ...sections]) {
    flow.render(section);
  }
  await flow.settle();
  assert.equal(flow.state.requests, 0);
});

test("entering registration requests recovery for an identified system administrator", async () => {
  const flow = recoveryHarness();
  flow.render("scoutAttendance");
  assert.equal(flow.state.requests, 0);
  flow.render("scouts");
  assert.equal(flow.state.requests, 1);
  await flow.settle();
  assert.equal(flow.state.status, "ready");
});

test("registration does not request recovery for non-system administrators or missing users", async () => {
  const flow = recoveryHarness();
  for (const user of [{ id: "chief", systemAdmin: false }, { systemAdmin: true }, null]) flow.render("scouts", user);
  await flow.settle();
  assert.equal(flow.state.requests, 0);
});

test("year-list changes refresh recovery only while registration is active", async () => {
  const flow = recoveryHarness();
  flow.render("overview");
  flow.render("overview", undefined, [{ id: "year-a" }]);
  flow.render("scoutAttendance", undefined, [{ id: "year-b" }]);
  assert.equal(flow.state.requests, 0);
  flow.render("scouts");
  assert.equal(flow.state.requests, 1);
  flow.render("scouts");
  assert.equal(flow.state.requests, 1, "unchanged effect dependencies must not request again");
  flow.render("scouts", undefined, [{ id: "year-c" }]);
  assert.equal(flow.state.requests, 2);
  flow.render("attendanceSheets", undefined, [{ id: "year-d" }]);
  assert.equal(flow.state.requests, 2);
  flow.render("scouts");
  assert.equal(flow.state.requests, 3, "returning to registration must refresh recovery");
  await flow.settle();
  for (const dependency of ["activeSection", "user?.id", "data.scoutYears"]) assert.ok(recoveryEffect[2].includes(dependency));
});

test("retention MFA failures stay local and clear before a successful retry", async () => {
  let fail = true;
  const flow = recoveryHarness(async () => {
    if (fail) throw new Error("Multi-factor authentication is required for retention management.");
    return { claims: [] };
  });
  flow.render("scouts");
  await flow.settle();
  assert.equal(flow.state.status, "error");
  assert.equal(flow.state.error, "Multi-factor authentication is required for retention management.");
  assert.deepEqual(flow.state.messages, []);
  flow.render("scoutAttendance");
  assert.equal(flow.state.requests, 1);
  fail = false;
  flow.render("scouts");
  assert.equal(flow.state.status, "loading");
  assert.equal(flow.state.error, "");
  await flow.settle();
  assert.equal(flow.state.status, "ready");
  assert.equal(flow.state.error, "");
  assert.deepEqual(flow.state.errorUpdates, ["", "Multi-factor authentication is required for retention management.", "", ""]);
});

test("recovery catch uses a safe fallback without global messaging", async () => {
  const flow = recoveryHarness(async () => { throw null; });
  await flow.hydrate();
  assert.equal(flow.state.status, "error");
  assert.match(flow.state.error, /Recovery state unavailable/);
  assert.deepEqual(flow.state.messages, []);
  const recoveryCatch = recoveryHandler.slice(recoveryHandler.indexOf("} catch (error)"));
  assert.doesNotMatch(recoveryCatch, /setSaveMessage|toast|notify/i);
  assert.match(dashboard, /const \[scoutYearRecoveryError, setScoutYearRecoveryError\] = useState\(""\)/);
  const errorUses = [...dashboard.matchAll(/\{scoutYearRecoveryError\b[^}]*\}/g)];
  assert.equal(errorUses.length, 1, "recovery errors must have one local rendering location");
  const controls = dashboard.match(/<div className="scout-year-backup-status" aria-live="polite">[\s\S]*?<\/div>/)?.[0];
  assert.match(controls, /scoutYearRecoveryStatus === "error" && <span role="alert">\{scoutYearRecoveryError/);
  assert.match(controls, /scoutYearRecoveryError \|\| "Recovery state unavailable/);
});

test("registration backup controls stay locked until a successful valid recovery response", async () => {
  const pending = deferred();
  const flow = recoveryHarness(() => pending.promise);
  assert.match(dashboard, /\[scoutYearRecoveryStatus, setScoutYearRecoveryStatus\] = useState\("loading"\)/);
  flow.render("scouts");
  assert.equal(flow.state.status, "loading");
  pending.resolve({ claims: [] });
  await flow.settle();
  assert.equal(flow.state.status, "ready");
  const invalid = recoveryHarness(async () => ({}));
  await invalid.hydrate();
  assert.equal(invalid.state.status, "error");
  assert.match(invalid.state.error, /incomplete state/);
  const button = dashboard.match(/<button[^>]*onClick=\{\(\) => downloadScoutYearBackup\(year\)\}[^>]*>/)?.[0];
  assert.match(button, /disabled=\{[^}]*scoutYearRecoveryStatus !== "ready"/);
});

test("late recovery errors cannot overwrite a newer successful response or a changed user", async () => {
  const late = deferred();
  let first = true;
  const flow = recoveryHarness(() => {
    if (first) { first = false; return late.promise; }
    return Promise.resolve({ claims: [] });
  });
  const oldRequest = flow.hydrate();
  await flow.hydrate();
  late.reject(new Error("Stale MFA failure"));
  await oldRequest;
  assert.equal(flow.state.status, "ready");
  assert.equal(flow.state.error, "");
  const changed = deferred();
  const second = recoveryHarness(() => changed.promise);
  const changedRequest = second.hydrate();
  second.context.scoutYearOperationUserRef.current = "different-user";
  changed.reject(new Error("Prior user's MFA failure"));
  await changedRequest;
  assert.equal(second.state.status, "loading");
  assert.equal(second.state.error, "");
});
