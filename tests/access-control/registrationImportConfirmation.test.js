import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("registration imports use separate parse and confirm API operations", () => {
  const client = read("src/api/client.js");
  const parseFunction = client.match(/export function parseRegistrationSheet\(payload\) \{[\s\S]*?\n\}/)?.[0] ?? "";
  const confirmFunction = client.match(/export function confirmRegistrationSheetImport\(payloadWithScouts\) \{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(parseFunction, /invokeSupabaseFunction\("parse-registration-upload", payload\)/);
  assert.match(parseFunction, /request\("\/registration\/parse"/);
  assert.doesNotMatch(parseFunction, /importRegistrationSheetToSupabase/);
  assert.match(confirmFunction, /importRegistrationSheetToSupabase\(payloadWithScouts\)/);
  assert.match(confirmFunction, /request\("\/registration\/upload"/);
});

test("dashboard holds parsed registrations for review before confirmation", () => {
  const dashboard = read("src/pages/AdminDashboardPage.jsx");
  const fileHandler = dashboard.match(/const handleRegistrationUpload = async \(event\) => \{[\s\S]*?\n  \};/)?.[0] ?? "";

  assert.match(dashboard, /const \[pendingRegistrationImport, setPendingRegistrationImport\] = useState\(null\)/);
  assert.match(fileHandler, /parseRegistrationSheet\(/);
  assert.doesNotMatch(fileHandler, /confirmRegistrationSheetImport\(/);
  assert.match(fileHandler, /setPendingRegistrationImport\(/);
  assert.match(dashboard, /Confirm upload/);
  assert.match(dashboard, /Cancel upload/);
  assert.match(dashboard, /pendingRegistrationImport\.scouts\.slice\(0, 5\)/);
  assert.match(dashboard, /existing scouts in that target year are archived/);
});

test("dashboard invalidates a parsed registration when its target changes", () => {
  const dashboard = read("src/pages/AdminDashboardPage.jsx");

  assert.match(dashboard, /pendingRegistrationImport\.targetIdentity !== registrationTargetIdentity/);
  assert.match(dashboard, /setRegistrationTargetMode\("existing"\); cancelRegistrationUpload\(\)/);
  assert.match(dashboard, /setRegistrationTargetMode\("new"\); cancelRegistrationUpload\(\)/);
  assert.match(dashboard, /setRegistrationYearId\(event\.target\.value\); cancelRegistrationUpload\(\)/);
  assert.match(dashboard, /setNewScoutYearName\(event\.target\.value\); cancelRegistrationUpload\(\)/);
});

function registrationHandlers(overrides = {}) {
  const dashboard = read("src/pages/AdminDashboardPage.jsx");
  const handler = (name) => dashboard.match(new RegExp(`const ${name} = (?:async )?\\([^)]*\\) => \\{[\\s\\S]*?\\n  \\};`))?.[0] ?? "";
  const state = { pending: { fileName: "old.csv" }, loading: false, messages: [], imports: 0 };
  const scope = {
    registrationImportBusyRef: { current: false },
    registrationParseVersionRef: { current: 0 },
    registrationFileInputRef: { current: { value: "selected.csv" } },
    registrationImportLoading: false,
    uploadStatus: null,
    registrationTargetMode: "existing",
    registrationYearId: "year-1",
    registrationTargetIdentity: "existing:year-1",
    newScoutYearName: "",
    data: { scoutYears: [{ id: "year-1", label: "2026-2027" }] },
    setPendingRegistrationImport: (value) => { state.pending = value; },
    setRegistrationImportLoading: (value) => { state.loading = value; },
    setSaveMessage: (value) => { state.messages.push(value); },
    arrayBufferToBase64: () => "base64",
    parseRegistrationSheet: async () => ({ scouts: [{ name: "Scout One" }], count: 1 }),
    pendingRegistrationImport: { fileName: "selected.csv", contentBase64: "base64", scouts: [{ name: "Scout One" }], targetIdentity: "existing:year-1", scoutYearId: "year-1" },
    confirmRegistrationSheetImport: async () => { state.imports += 1; return { count: 1 }; },
    refresh: async () => {},
    setNewScoutYearName: () => {},
    setRegistrationTargetMode: () => {},
    ...overrides
  };
  const handlers = new Function(...Object.keys(scope), `${handler("cancelRegistrationUpload")}\n${handler("handleRegistrationUpload")}\n${handler("confirmRegistrationUpload")}\nreturn { cancelRegistrationUpload, handleRegistrationUpload, confirmRegistrationUpload };`)(...Object.values(scope));
  return { ...handlers, state, scope };
}

const fileEvent = () => ({ target: { files: [{ name: "selected.csv", arrayBuffer: async () => new ArrayBuffer(0) }], value: "selected.csv" } });

test("replacement parsing clears the previous preview even when parsing fails", async () => {
  const flow = registrationHandlers({ parseRegistrationSheet: async () => { throw new Error("Invalid file"); } });
  await flow.handleRegistrationUpload(fileEvent());
  assert.equal(flow.state.pending, null);
  assert.equal(flow.state.imports, 0);
  assert.equal(flow.state.loading, false);
  assert.equal(flow.scope.registrationFileInputRef.current.value, "");
});

test("cancelling an in-flight parse prevents it restoring a stale preview", async () => {
  let resolveParse;
  const response = new Promise((resolve) => { resolveParse = resolve; });
  const flow = registrationHandlers({ parseRegistrationSheet: () => response });
  const parsing = flow.handleRegistrationUpload(fileEvent());
  await Promise.resolve();
  flow.cancelRegistrationUpload();
  resolveParse({ scouts: [{ name: "Stale Scout" }], count: 1 });
  await parsing;
  assert.equal(flow.state.pending, null);
  assert.equal(flow.state.imports, 0);
});

test("confirmation rejects stale targets and simultaneous duplicate submissions", async () => {
  const stale = registrationHandlers({ registrationTargetIdentity: "existing:year-2" });
  await stale.confirmRegistrationUpload();
  assert.equal(stale.state.imports, 0);
  assert.equal(stale.state.pending, null);

  const flow = registrationHandlers();
  await Promise.all([flow.confirmRegistrationUpload(), flow.confirmRegistrationUpload()]);
  assert.equal(flow.state.imports, 1);
  assert.equal(flow.state.pending, null);
});
