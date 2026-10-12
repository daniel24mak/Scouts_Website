import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { attendanceRows, loadAttendanceReadPath } from "./helpers/attendanceReadHarness.js";
import { loadBootstrapHook } from "./helpers/bootstrapHarness.js";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const stripImports = (source) => source.replace(/import[\s\S]*?from\s+"[^"]+";/g, "");
const plain = (value) => JSON.parse(JSON.stringify(value));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

function element(type, props, ...children) {
  return { type, props: { ...props, children } };
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}

function fixture() {
  return {
    groups: [{ id: "wolves", name: "Wolves" }, { id: "lions", name: "Lions" }],
    users: [{ id: "edited", name: "Chief A", role: "chief", groupId: "wolves" }, { id: "other", name: "Chief B", role: "chief", groupId: "lions" }],
    registeredScouts: [{ id: "edited", name: "Scout A", groupId: "wolves", equipeId: "equipe-a" }, { id: "default", name: "Scout B", groupId: "wolves", equipeId: "equipe-b" }],
    equipes: [{ id: "equipe-a", groupId: "wolves", name: "Equipe A", isActive: true }, { id: "equipe-b", groupId: "wolves", name: "Equipe B", isActive: true }],
    registrationImportSettings: { sortBy: "name" },
    attendanceSheets: [],
    attendanceMeetings: [{ id: "scout-session", date: "2026-10-11", groupId: "wolves", scope: "group", records: { edited: "Present" } }],
    chiefAttendanceMeetings: [{ id: "chief-session", date: "2026-10-11", records: { edited: "Present", other: "Late" } }],
    chiefAttendanceSheet: { fileName: "Supabase", savedRows: 2 }
  };
}

function managerHarness(manager, { embedded = true, save = async () => {}, refresh } = {}) {
  const name = `${manager === "scout" ? "Scout" : "Chief"}AttendanceManager`;
  let data = fixture();
  const user = { id: "admin", role: "admin", chiefLevel: "head", groupId: "wolves" };
  const props = { ...(embedded ? { dataOverride: data, userOverride: user } : {}) };
  const calls = { saves: [], standaloneRefreshes: [], parentRefreshes: [] };
  const states = [];
  let stateIndex = 0;
  const useState = (initial) => {
    const index = stateIndex++;
    if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
    return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
  };
  const refreshData = async (options, refreshParent) => {
    if (refresh) return refresh(options);
    const next = structuredClone(data);
    const meetingKey = manager === "scout" ? "attendanceMeetings" : "chiefAttendanceMeetings";
    const sent = calls.saves.at(-1);
    const meeting = next[meetingKey].find((item) => item.date === sent.date && (manager !== "scout" || item.groupId === sent.groupId && item.scope === sent.scope));
    if (meeting) meeting.records = { ...meeting.records, ...sent.records };
    else next[meetingKey].push({ ...sent, id: "new-session" });
    data = next;
    if (embedded && refreshParent) props.dataOverride = next;
    return next;
  };
  const parentRefresh = async (options) => { calls.parentRefreshes.push(plain(options)); return refreshData(options, true); };
  const standaloneRefresh = async (options) => { calls.standaloneRefreshes.push(plain(options)); return refreshData(options, false); };
  if (embedded) props.onRefresh = parentRefresh;
  const draftPath = new URL("../../src/features/attendance/useAttendanceDraft.js", import.meta.url);
  const draftSource = fs.existsSync(draftPath) ? stripImports(fs.readFileSync(draftPath, "utf8")).replace(/export /g, "") : "";
  const source = stripImports(read(`src/features/attendance/${name}.jsx`)).replace("export default function", "function");
  const context = {
    React: { createElement: element, Fragment: "fragment" },
    useState,
    useRef: (initial) => useState(() => ({ current: initial }))[0],
    useMemo: (calculate) => calculate(),
    useAuth: () => ({ user }),
    useBootstrap: () => ({ data, refresh: standaloneRefresh }),
    [`save${manager === "scout" ? "Scout" : "Chief"}Attendance`]: async (payload) => { calls.saves.push(plain(payload)); return save(payload); }
  };
  const Component = vm.runInNewContext(`${transformSync(`${draftSource}\n${source}`, { loader: "jsx" }).code}\n${name}`, context);
  let tree;
  const render = () => { stateIndex = 0; tree = Component(props); return tree; };
  const controls = () => nodes(tree);
  const dateInput = () => controls().find((node) => node.type === "input" && node.props.type === "date");
  const saveButton = () => controls().find((node) => node.type === "button" && node.props.onClick);
  const attendanceSelects = () => controls().filter((node) => node.type === "select" && nodes(node.props.children).some((child) => child.type === "option" && child.props.children.includes("Excused")));
  const edit = (status, index = 0) => { attendanceSelects()[index].props.onChange({ target: { value: status } }); render(); };
  const setDate = (value) => { dateInput().props.onChange({ target: { value } }); render(); };
  render();
  setDate("2026-10-11");
  return { render, controls, calls, edit, setDate, save: () => saveButton().props.onClick(), attendanceSelects, props, user };
}

function authoritativeStatus(ui, manager, status) {
  const key = manager === "scout" ? "attendanceMeetings" : "chiefAttendanceMeetings";
  ui.props.dataOverride = {
    ...ui.props.dataOverride,
    [key]: ui.props.dataOverride[key].map((meeting) => ({ ...meeting, records: { ...meeting.records, edited: status } }))
  };
  ui.render();
}

for (const manager of ["scout", "chief"]) {
  test(`${manager} dashboard save refreshes its rendered parent data once with required attendance`, async () => {
    const ui = managerHarness(manager);
    ui.edit("Absent");
    await ui.save();
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent", "confirmed Absent must not revert to stale Present");
    assert.deepEqual(ui.calls.parentRefreshes, [{ throwOnError: true, requireAttendance: true }]);
    assert.deepEqual(ui.calls.standaloneRefreshes, []);
    await ui.save();
    assert.equal(ui.calls.saves[1].records.edited, "Absent", "a repeated save must use refreshed attendance");
  });

  test(`${manager} standalone save refreshes its own data with required attendance`, async () => {
    const ui = managerHarness(manager, { embedded: false });
    ui.edit("Absent");
    await ui.save();
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent");
    assert.deepEqual(ui.calls.standaloneRefreshes, [{ throwOnError: true, requireAttendance: true }]);
    assert.deepEqual(ui.calls.parentRefreshes, []);
  });

  test(`${manager} preserves Excused edited while the earlier Absent save is pending`, async () => {
    const pending = deferred();
    const ui = managerHarness(manager, { save: () => pending.promise });
    ui.edit("Absent");
    const saving = ui.save();
    ui.render();
    assert.ok(ui.controls().filter((node) => node.type === "select" || node.type === "input").every((node) => !node.props.disabled));
    ui.edit("Excused");
    assert.equal(ui.calls.saves[0].records.edited, "Absent", "the outgoing payload remains the submitted snapshot");
    pending.resolve({ id: "saved-session" });
    await saving;
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Excused");
    await ui.save();
    assert.equal(ui.calls.saves[1].records.edited, "Excused");
  });

  test(`${manager} completion of an old date save preserves equal-valued edits on a new date`, async () => {
    const pending = deferred();
    const ui = managerHarness(manager, { save: () => pending.promise });
    ui.edit("Absent");
    const saving = ui.save();
    ui.setDate("2026-10-12");
    ui.edit("Absent");
    pending.resolve({ id: "saved-session" });
    await saving;
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent", "same status on a different date is a separate edit");
    await ui.save();
    assert.equal(ui.calls.saves[1].date, "2026-10-12");
    assert.equal(ui.calls.saves[1].records.edited, "Absent");
  });

  test(`${manager} keeps a locally committed Absent when refreshed attendance cannot load`, async () => {
    const ui = managerHarness(manager, { refresh: async () => { throw new Error("Attendance records unavailable"); } });
    ui.edit("Absent");
    await ui.save();
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent", "failed refresh must not expose pre-save Present");
    assert.ok(ui.controls().some((node) => node.type === "p" && node.props.children.some((text) => typeof text === "string" && text.includes("was saved, but the refreshed list could not be loaded"))));
    await ui.save();
    assert.equal(ui.calls.saves[1].records.edited, "Absent");
  });

  test(`${manager} retains confirmed Absent for the same stale records but reveals a newer authoritative Excused`, async () => {
    const ui = managerHarness(manager, { refresh: async () => { throw new Error("Attendance records unavailable"); } });
    ui.edit("Absent");
    await ui.save();
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent");
    ui.props.dataOverride = { ...ui.props.dataOverride };
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent", "a new parent wrapper containing the same stale records must retain the confirmed snapshot");
    authoritativeStatus(ui, manager, "Excused");
    assert.equal(ui.attendanceSelects()[0].props.value, "Excused", "a later authoritative records object must supersede the confirmed fallback");
    await ui.save();
    assert.equal(ui.calls.saves[1].records.edited, "Excused", "subsequent saves must use recovered authoritative attendance");
  });

  test(`${manager} a resolved superseded refresh keeps confirmed Absent until rendered authority changes`, async () => {
    const result = fixture();
    const key = manager === "scout" ? "attendanceMeetings" : "chiefAttendanceMeetings";
    result[key][0].records.edited = "Absent";
    // A superseded bootstrap call still resolves its original payload but is
    // correctly fenced from updating the authoritative parent's rendered data.
    const ui = managerHarness(manager, { refresh: async () => result });
    ui.edit("Absent");
    await ui.save();
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent", "promise resolution alone cannot discard confirmed attendance over stale props");
    authoritativeStatus(ui, manager, "Excused");
    assert.equal(ui.attendanceSelects()[0].props.value, "Excused");
  });

  test(`${manager} refresh completion without a new authoritative records object retains confirmed Absent`, async () => {
    const refreshing = deferred();
    const started = deferred();
    const ui = managerHarness(manager, { refresh: () => { started.resolve(); return refreshing.promise; } });
    ui.edit("Absent");
    const saving = ui.save();
    await started.promise;
    const key = manager === "scout" ? "attendanceMeetings" : "chiefAttendanceMeetings";
    ui.props.dataOverride = { ...ui.props.dataOverride, [key]: [] };
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent");
    refreshing.resolve();
    await saving;
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent", "missing authoritative records do not prove the confirmed value was replaced");
  });

  test(`${manager} newer authority preserves unsaved edits made after the submitted snapshot`, async () => {
    const pending = deferred();
    const ui = managerHarness(manager, {
      save: () => pending.promise,
      refresh: async () => { throw new Error("Attendance records unavailable"); }
    });
    ui.edit("Absent");
    const saving = ui.save();
    ui.edit("Late");
    pending.resolve({ id: "saved-session" });
    await saving;
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Late");
    authoritativeStatus(ui, manager, "Excused");
    assert.equal(ui.attendanceSelects()[0].props.value, "Late", "a post-submit unsaved edit still wins over recovered authority");
    await ui.save();
    assert.equal(ui.calls.saves[1].records.edited, "Late");
  });

  test(`${manager} installs confirmed records against the latest authority seen while the save was pending`, async () => {
    const pending = deferred();
    const ui = managerHarness(manager, {
      save: () => pending.promise,
      refresh: async () => { throw new Error("Attendance records unavailable"); }
    });
    ui.edit("Absent");
    const saving = ui.save();
    authoritativeStatus(ui, manager, "Late");
    pending.resolve({ id: "saved-session" });
    await saving;
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent", "an authority fetched before confirmation cannot discard the confirmed save");
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent");
    authoritativeStatus(ui, manager, "Excused");
    assert.equal(ui.attendanceSelects()[0].props.value, "Excused");
  });

  test(`${manager} retains a confirmed new meeting across rerenders without an authoritative records object`, async () => {
    const ui = managerHarness(manager, { refresh: async () => { throw new Error("Attendance records unavailable"); } });
    ui.setDate("2026-10-12");
    ui.edit("Absent");
    await ui.save();
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent");
    ui.props.dataOverride = { ...ui.props.dataOverride };
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent", "an absent meeting must not create a new empty-object version on every render");
  });

  test(`${manager} retains edits made during the authoritative refresh after save`, async () => {
    const refreshing = deferred();
    const refreshStarted = deferred();
    const ui = managerHarness(manager, { refresh: () => { refreshStarted.resolve(); return refreshing.promise; } });
    ui.edit("Absent");
    const saving = ui.save();
    await refreshStarted.promise;
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Absent");
    ui.edit("Excused");
    refreshing.resolve();
    await saving;
    ui.render();
    assert.equal(ui.attendanceSelects()[0].props.value, "Excused");
  });

  for (const table of Object.keys(attendanceRows)) {
    test(`${manager} confirmed save reports a real ${table} read failure through bootstrap aggregation`, async () => {
      const failure = new Error(`${table} unavailable`);
      const path = loadAttendanceReadPath({ getSupabaseRows: async (requested) => {
        if (requested === table) throw failure;
        return attendanceRows[requested];
      } });
      const stale = fixture();
      const hook = loadBootstrapHook(path.getBootstrap, stale);
      const ui = managerHarness(manager, { refresh: hook.refresh });
      ui.edit("Absent");
      await ui.save();
      ui.render();
      assert.equal(ui.attendanceSelects()[0].props.value, "Absent");
      assert.equal(hook.state.data, stale);
      assert.equal(hook.state.error, failure);
      assert.ok(ui.controls().some((node) => node.type === "p" && node.props.children.some((text) => typeof text === "string" && text.includes(`was saved, but the refreshed list could not be loaded: ${table} unavailable`))));
      assert.deepEqual(ui.calls.parentRefreshes, [{ throwOnError: true, requireAttendance: true }]);
      assert.deepEqual(ui.calls.standaloneRefreshes, []);
    });
  }

  test(`${manager} dashboard passes its own refresh to the embedded manager`, () => {
    const section = `${manager}Attendance`;
    const name = `${manager === "scout" ? "Scout" : "Chief"}AttendanceManager`;
    const expression = read("src/pages/AdminDashboardPage.jsx").match(new RegExp(`if \\(activeSection === "${section}"\\) return ([\\s\\S]*?);`))[1];
    const refresh = () => {};
    const tree = vm.runInNewContext(`${transformSync(`const rendered = ${expression};`, { loader: "jsx" }).code}\nrendered`, {
      React: { createElement: element, Fragment: "fragment" },
      data: fixture(), scopedUser: {}, search: "", refresh,
      renderCoordinatorGroupSwitcher: () => null, [name]: name
    });
    assert.equal(nodes(tree).find((node) => node.type === name).props.onRefresh, refresh);
  });
}

test("scout scope changes preserve new edits while the group request completes", async () => {
  const pending = deferred();
  const ui = managerHarness("scout", { save: () => pending.promise });
  ui.edit("Absent");
  const saving = ui.save();
  const scopeSelect = ui.controls().find((node) => node.type === "select" && node.props.value === "group");
  scopeSelect.props.onChange({ target: { value: "equipe" } });
  ui.render();
  ui.edit("Absent");
  pending.resolve({ id: "saved-session" });
  await saving;
  ui.render();
  assert.equal(ui.attendanceSelects()[0].props.value, "Absent");
  await ui.save();
  assert.equal(ui.calls.saves[1].scope, "equipe");
  assert.equal(ui.calls.saves[1].records.edited, "Absent");
});

test("chief group switch preserves the next group's edits while another group saves", async () => {
  const pending = deferred();
  const ui = managerHarness("chief", { save: () => pending.promise });
  ui.edit("Absent");
  const saving = ui.save();
  ui.props.userOverride = { ...ui.user, groupId: "lions" };
  ui.render();
  ui.edit("Excused");
  pending.resolve({ id: "saved-session" });
  await saving;
  ui.render();
  assert.equal(ui.attendanceSelects()[0].props.value, "Excused");
  await ui.save();
  assert.deepEqual(ui.calls.saves[1].records, { other: "Excused" });
});
