import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");
const client = read("../../src/api/client.js");
const dashboard = read("../../src/pages/AdminDashboardPage.jsx");
const styles = read("../../src/styles.css");

function functionSource(name) {
  const match = dashboard.match(new RegExp(`  const ${name} = (?:async )?\\([^)]*\\) => \\{[\\s\\S]*?\\n  \\};`));
  assert.ok(match, `${name} must remain an extractable dashboard handler`);
  return match[0];
}

function optionalFunctionSource(name, fallback) {
  const match = dashboard.match(new RegExp(`  const ${name} = (?:async )?\\([^)]*\\) => \\{[\\s\\S]*?\\n  \\};`));
  return match?.[0] ?? `  const ${name} = ${fallback};`;
}

function deletionHarness(overrides = {}) {
  const sources = [
    "hasValidScoutYearReceipt",
    "cancelRegistrationUpload",
    "invalidateScoutYearBackup",
    "triggerScoutYearBackupDownload",
    "downloadScoutYearBackup",
    "openScoutYearDelete",
    "cancelScoutYearDelete",
    "handleScoutYearDeleteModalKeyDown",
    "confirmScoutYearDelete"
  ].map(functionSource).concat([
    optionalFunctionSource("expireScoutYearReceipts", "(current) => current"),
    optionalFunctionSource("cleanupScoutYearOperations", "() => {}"),
    optionalFunctionSource("focusScoutYearDeleteEnabledControl", "() => {}")
  ]).join("\n");
  const events = [];
  const year = overrides.year ?? { id: "year-a", label: "2024-2025", status: "inactive", isActive: false };
  const secondYear = { id: "year-b", label: "2023-2024", status: "inactive", isActive: false };
  const scope = {
    events,
    initialBackups: overrides.initialBackups ?? {},
    initialRequest: null,
    initialLabel: "",
    initialRegistrationYearId: overrides.registrationYearId ?? year.id,
    initialPendingRegistrationImport: overrides.pendingRegistrationImport ?? { targetIdentity: `existing:${year.id}`, scouts: [{ name: "Pending Scout" }] },
    initialRegistrationTargetMode: overrides.registrationTargetMode ?? "existing",
    data: overrides.data ?? { scoutYears: [year, secondYear] },
    refresh: overrides.refresh ?? (async () => { events.push("refresh"); }),
    createScoutYearBackup: overrides.createScoutYearBackup ?? (async () => ({
      receiptId: "receipt-a",
      downloadUrl: "https://signed.example/year-a.zip",
      expiresAt: "2099-01-01T00:00:00.000Z",
      manifest: { counts: { scouts: 12 }, files: [{ archivePath: "scouts.csv" }] }
    })),
    deleteScoutYear: overrides.deleteScoutYear ?? (async (payload) => {
      events.push(["delete", payload]);
      return { deleted: true, storageCleanupPending: true };
    }),
    document: overrides.document ?? {
      body: {
        appendChild(anchor) { events.push(["append", anchor.href]); anchor.isConnected = true; }
      },
      createElement(tag) {
        assert.equal(tag, "a");
        return {
          href: "",
          download: "",
          rel: "",
          isConnected: false,
          click() { events.push(["click", this.href, this.download]); },
          remove() { events.push("remove"); this.isConnected = false; }
        };
      },
      activeElement: null
    },
    Date,
    modalControlsEnabled: overrides.modalControlsEnabled ?? false,
    setSaveMessage(message) { events.push(["message", message]); }
  };
  const factory = new Function(...Object.keys(scope), `
    let scoutYearBackups = initialBackups;
    let scoutYearDeleteRequest = initialRequest;
    let scoutYearDeleteLabel = initialLabel;
    let registrationYearId = initialRegistrationYearId;
    let pendingRegistrationImport = initialPendingRegistrationImport;
    const registrationTargetMode = initialRegistrationTargetMode;
    const scoutYearBackupBusyRef = { current: new Set() };
    const scoutYearBackupVersionRef = { current: {} };
    const scoutYearDeleteBusyRef = { current: false };
    const scoutYearDeleteVersionRef = { current: 0 };
    const scoutYearOperationsMountedRef = { current: true };
    const scoutYearsRef = { current: data.scoutYears };
    const scoutYearDeleteReturnFocusRef = { current: null };
    const confirmationInput = { disabled: false, focus() { document.activeElement = this; events.push("input-focus"); } };
    const cancelButton = { disabled: false, focus() { document.activeElement = this; events.push("cancel-focus"); } };
    const scoutYearDeleteModalElement = {
      querySelectorAll: () => modalControlsEnabled ? [confirmationInput, cancelButton] : [],
      focus() { document.activeElement = this; events.push("modal-focus"); }
    };
    const scoutYearDeleteModalRef = { current: scoutYearDeleteModalElement };
    const scoutYearDeleteInputRef = { current: confirmationInput };
    const registrationParseVersionRef = { current: 0 };
    const registrationFileInputRef = { current: { value: "selected.csv" } };
    const setScoutYearBackups = (update) => { scoutYearBackups = typeof update === "function" ? update(scoutYearBackups) : update; };
    const setScoutYearDeleteRequest = (update) => { scoutYearDeleteRequest = typeof update === "function" ? update(scoutYearDeleteRequest) : update; };
    const setScoutYearDeleteLabel = (update) => { scoutYearDeleteLabel = typeof update === "function" ? update(scoutYearDeleteLabel) : update; };
    const setRegistrationYearId = (update) => { registrationYearId = typeof update === "function" ? update(registrationYearId) : update; };
    const setPendingRegistrationImport = (update) => { pendingRegistrationImport = typeof update === "function" ? update(pendingRegistrationImport) : update; };
    ${sources}
    return {
      hasValidScoutYearReceipt,
      invalidateScoutYearBackup,
      downloadScoutYearBackup,
      openScoutYearDelete,
      cancelScoutYearDelete,
      handleScoutYearDeleteModalKeyDown,
      confirmScoutYearDelete,
      expireScoutYearReceipts,
      cleanupScoutYearOperations,
      focusScoutYearDeleteEnabledControl,
      setDeleteLabel: setScoutYearDeleteLabel,
      replaceBackups: setScoutYearBackups,
      replaceYears: (years) => { scoutYearsRef.current = years; },
      focusModal: () => { document.activeElement = scoutYearDeleteModalElement; },
      focusOutside: () => { document.activeElement = { outside: true }; },
      state: () => ({ scoutYearBackups, scoutYearDeleteRequest, scoutYearDeleteLabel, registrationYearId, pendingRegistrationImport, registrationParseVersion: registrationParseVersionRef.current, registrationFileValue: registrationFileInputRef.current?.value })
    };
  `);
  return { year, events, ...factory(...Object.values(scope)) };
}

test("dashboard API exposes Supabase-only backup and deletion wrappers", () => {
  assert.match(client, /createScoutYearBackup as createScoutYearBackupInSupabase/);
  assert.match(client, /deleteScoutYear as deleteScoutYearInSupabase/);
  const backupWrapper = client.match(/export function createScoutYearBackup\(scoutYearId\) \{[\s\S]*?\n\}/)?.[0] ?? "";
  const deleteWrapper = client.match(/export function deleteScoutYear\(payload\) \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(backupWrapper, /Supabase is required/i);
  assert.match(deleteWrapper, /Supabase is required/i);
  assert.match(backupWrapper, /createScoutYearBackupInSupabase\(scoutYearId\)/);
  assert.match(deleteWrapper, /deleteScoutYearInSupabase\(payload\)/);
  assert.doesNotMatch(`${backupWrapper}\n${deleteWrapper}`, /request\(/);
});

test("year rows expose an active lock and receipt-gated destructive controls", () => {
  assert.match(dashboard, /Download complete backup/);
  assert.match(dashboard, /Delete scouting year/);
  assert.match(dashboard, /Activate another year before deleting this one\./);
  assert.match(dashboard, /scoutYearBackups\[year\.id\]/);
  assert.match(dashboard, /disabled=\{[^}]*!hasValidScoutYearReceipt\(year\.id\)/);
  assert.match(dashboard, /className="scout-year-danger-zone"/);
  assert.match(dashboard, /className="scout-year-backup-status"/);
  assert.match(dashboard, /className="[^"]*scout-year-delete-action[^"]*"/);
});

test("signed backup starts only after completion, stores a per-year receipt, and blocks duplicate clicks", async () => {
  let resolveBackup;
  let calls = 0;
  const backup = new Promise((resolve) => { resolveBackup = resolve; });
  const flow = deletionHarness({ createScoutYearBackup: () => { calls += 1; return backup; } });
  const first = flow.downloadScoutYearBackup(flow.year);
  const duplicate = flow.downloadScoutYearBackup(flow.year);
  assert.equal(calls, 1);
  assert.equal(flow.events.some((event) => Array.isArray(event) && event[0] === "click"), false);
  resolveBackup({
    receiptId: "receipt-a",
    downloadUrl: "https://signed.example/year-a.zip",
    expiresAt: "2099-01-01T00:00:00.000Z",
    manifest: { counts: { scouts: 12 }, files: [{ archivePath: "scouts.csv" }] }
  });
  await Promise.all([first, duplicate]);
  const click = flow.events.find((event) => Array.isArray(event) && event[0] === "click");
  assert.deepEqual(click, ["click", "https://signed.example/year-a.zip", "scouting-year-2024-2025-backup.zip"]);
  assert.ok(flow.events.includes("remove"), "temporary anchor must be removed");
  assert.equal(flow.state().scoutYearBackups[flow.year.id].receiptId, "receipt-a");
  assert.equal(flow.state().scoutYearBackups[flow.year.id].yearId, flow.year.id);
  assert.equal(flow.hasValidScoutYearReceipt(flow.year.id), true);
});

test("expired, failed, and stale backups never unlock deletion", async () => {
  const expired = deletionHarness({
    initialBackups: {
      "year-a": { yearId: "year-a", status: "ready", receiptId: "old", expiresAt: "2000-01-01T00:00:00.000Z" }
    }
  });
  assert.equal(expired.hasValidScoutYearReceipt("year-a"), false);
  expired.openScoutYearDelete(expired.year);
  assert.equal(expired.state().scoutYearDeleteRequest, null);

  const failed = deletionHarness({
    initialBackups: {
      "year-a": { yearId: "year-a", status: "ready", receiptId: "old", expiresAt: "2099-01-01T00:00:00.000Z" }
    },
    createScoutYearBackup: async () => { throw new Error("archive incomplete"); }
  });
  await failed.downloadScoutYearBackup(failed.year);
  assert.equal(failed.state().scoutYearBackups[failed.year.id].receiptId, undefined);
  assert.match(failed.state().scoutYearBackups[failed.year.id].error, /archive incomplete/);

  let resolveBackup;
  const stale = deletionHarness({
    createScoutYearBackup: () => new Promise((resolve) => { resolveBackup = resolve; })
  });
  const request = stale.downloadScoutYearBackup(stale.year);
  stale.invalidateScoutYearBackup(stale.year.id);
  resolveBackup({ receiptId: "stale", downloadUrl: "https://signed.example/stale.zip", expiresAt: "2099-01-01T00:00:00.000Z", manifest: {} });
  await request;
  assert.equal(stale.state().scoutYearBackups[stale.year.id]?.receiptId, undefined);
  assert.equal(stale.events.some((event) => Array.isArray(event) && event[0] === "click"), false);

  let resolveChangedYear;
  const changedYear = deletionHarness({
    createScoutYearBackup: () => new Promise((resolve) => { resolveChangedYear = resolve; })
  });
  const changedRequest = changedYear.downloadScoutYearBackup(changedYear.year);
  changedYear.replaceYears([{ ...changedYear.year, isActive: true, status: "active" }]);
  resolveChangedYear({ receiptId: "stale", downloadUrl: "https://signed.example/stale.zip", expiresAt: "2099-01-01T00:00:00.000Z", manifest: {} });
  await changedRequest;
  assert.equal(changedYear.state().scoutYearBackups[changedYear.year.id]?.receiptId, undefined);
  assert.equal(changedYear.events.some((event) => Array.isArray(event) && event[0] === "click"), false);
});

test("exact-label modal is accessible and cancellation never deletes", () => {
  assert.match(dashboard, /role="alertdialog"/);
  assert.match(dashboard, /aria-modal="true"/);
  assert.match(dashboard, /aria-labelledby="scout-year-delete-title"/);
  assert.match(dashboard, /htmlFor="scout-year-delete-label"/);
  assert.match(dashboard, /id="scout-year-delete-label"/);
  assert.match(dashboard, /scoutYearDeleteInputRef\.current\?\.focus\(\)/);
  assert.match(dashboard, /event\.key === "Escape"/);
  assert.match(dashboard, /event\.key !== "Tab"/);
  assert.match(dashboard, /querySelectorAll\("button:not\(\[disabled\]\), input:not\(\[disabled\]\)"\)/);
  assert.doesNotMatch(dashboard, /window\.(?:prompt|confirm)\([^)]*Delete scouting year/);

  const flow = deletionHarness({
    initialBackups: {
      "year-a": { yearId: "year-a", status: "ready", receiptId: "receipt-a", expiresAt: "2099-01-01T00:00:00.000Z" }
    }
  });
  flow.openScoutYearDelete(flow.year);
  assert.equal(flow.state().scoutYearDeleteRequest.label, flow.year.label);
  flow.cancelScoutYearDelete();
  assert.equal(flow.state().scoutYearDeleteRequest, null);
  assert.equal(flow.events.some((event) => Array.isArray(event) && event[0] === "delete"), false);
});

test("delete requires the case-sensitive label and current matching receipt", async () => {
  const flow = deletionHarness({
    initialBackups: {
      "year-a": { yearId: "year-a", status: "ready", receiptId: "receipt-a", expiresAt: "2099-01-01T00:00:00.000Z" }
    }
  });
  flow.openScoutYearDelete(flow.year);
  flow.setDeleteLabel("2024-2025 ");
  await flow.confirmScoutYearDelete();
  assert.equal(flow.events.some((event) => Array.isArray(event) && event[0] === "delete"), false);

  flow.setDeleteLabel(flow.year.label);
  flow.replaceBackups({
    "year-a": { yearId: "year-a", status: "ready", receiptId: "replacement", expiresAt: "2099-01-01T00:00:00.000Z" }
  });
  await flow.confirmScoutYearDelete();
  assert.equal(flow.events.some((event) => Array.isArray(event) && event[0] === "delete"), false, "modal receipt cannot cross-wire with a replacement backup");
});

test("successful deletion is duplicate-safe, reports pending cleanup, clears state, and refreshes once", async () => {
  let resolveDelete;
  let calls = 0;
  const flow = deletionHarness({
    initialBackups: {
      "year-a": { yearId: "year-a", status: "ready", receiptId: "receipt-a", expiresAt: "2099-01-01T00:00:00.000Z" }
    },
    deleteScoutYear: (payload) => {
      calls += 1;
      flow.events.push(["delete", payload]);
      return new Promise((resolve) => { resolveDelete = resolve; });
    }
  });
  flow.openScoutYearDelete(flow.year);
  flow.setDeleteLabel(flow.year.label);
  const first = flow.confirmScoutYearDelete();
  const duplicate = flow.confirmScoutYearDelete();
  assert.equal(calls, 1);
  resolveDelete({ deleted: true, storageCleanupPending: true });
  await Promise.all([first, duplicate]);
  assert.deepEqual(flow.events.find((event) => Array.isArray(event) && event[0] === "delete")[1], {
    scoutYearId: flow.year.id,
    receiptId: "receipt-a",
    expectedLabel: flow.year.label
  });
  assert.equal(flow.events.filter((event) => event === "refresh").length, 1);
  assert.match(flow.events.find((event) => Array.isArray(event) && event[0] === "message")[1], /database records were deleted.*storage cleanup is pending/i);
  assert.equal(flow.state().scoutYearBackups[flow.year.id], undefined);
  assert.equal(flow.state().scoutYearDeleteRequest, null);
});

test("deletion errors preserve the year receipt and expose the server message", async () => {
  const flow = deletionHarness({
    initialBackups: {
      "year-a": { yearId: "year-a", status: "ready", receiptId: "receipt-a", expiresAt: "2099-01-01T00:00:00.000Z" }
    },
    deleteScoutYear: async () => { throw new Error("Snapshot changed; download a fresh backup."); }
  });
  flow.openScoutYearDelete(flow.year);
  flow.setDeleteLabel(flow.year.label);
  await flow.confirmScoutYearDelete();
  assert.equal(flow.state().scoutYearBackups[flow.year.id].receiptId, "receipt-a");
  assert.equal(flow.events.filter((event) => event === "refresh").length, 0);
  assert.match(flow.events.find((event) => Array.isArray(event) && event[0] === "message")[1], /Snapshot changed; download a fresh backup\./);
});

test("deleting the selected registration year clears pending import state and selects a remaining year", async () => {
  const flow = deletionHarness({
    initialBackups: {
      "year-a": { yearId: "year-a", status: "ready", receiptId: "receipt-a", expiresAt: "2099-01-01T00:00:00.000Z" }
    }
  });
  flow.openScoutYearDelete(flow.year);
  flow.setDeleteLabel(flow.year.label);
  await flow.confirmScoutYearDelete();
  assert.equal(flow.state().registrationYearId, "year-b");
  assert.equal(flow.state().pendingRegistrationImport, null);
  assert.equal(flow.state().registrationFileValue, "");
  assert.ok(flow.state().registrationParseVersion > 0);
});

test("deleting the stored existing selection while creating a new year preserves the new-year preview", async () => {
  const newYearPreview = { targetIdentity: "new:2026-2027", scouts: [{ name: "New Year Scout" }] };
  const flow = deletionHarness({
    registrationTargetMode: "new",
    pendingRegistrationImport: newYearPreview,
    initialBackups: {
      "year-a": { yearId: "year-a", status: "ready", receiptId: "receipt-a", expiresAt: "2099-01-01T00:00:00.000Z" }
    }
  });
  flow.openScoutYearDelete(flow.year);
  flow.setDeleteLabel(flow.year.label);
  await flow.confirmScoutYearDelete();
  assert.equal(flow.state().registrationYearId, "year-b");
  assert.equal(flow.state().pendingRegistrationImport, newYearPreview);
  assert.equal(flow.state().registrationFileValue, "selected.csv");
  assert.equal(flow.state().registrationParseVersion, 0);
  assert.match(dashboard, /\}, \[registrationTargetIdentity\]\);/);
});

test("server deletion errors remain announced inside the open modal", () => {
  const modal = dashboard.match(/\{scoutYearDeleteRequest && \([\s\S]*?\n      \)\}/)?.[0] ?? "";
  assert.match(modal, /role="alert"/);
  assert.match(modal, /scoutYearBackups\[scoutYearDeleteRequest\.yearId\]\?\.error/);
  assert.match(modal, /scout-year-delete-error/);
  assert.match(styles, /\.scout-year-delete-error/);
});

test("modal retains focus when deletion disables every control", () => {
  const flow = deletionHarness();
  const event = { key: "Tab", shiftKey: false, preventDefault: () => flow.events.push("prevent-default") };
  flow.handleScoutYearDeleteModalKeyDown(event);
  assert.ok(flow.events.includes("prevent-default"));
  assert.ok(flow.events.includes("modal-focus"));
  assert.match(dashboard, /className="scout-year-delete-modal"[^>]*tabIndex=\{-1\}/);
});

test("failed deletion restores the confirmation input and traps reverse focus from the dialog container", async () => {
  const flow = deletionHarness({
    modalControlsEnabled: true,
    initialBackups: {
      "year-a": { yearId: "year-a", status: "ready", receiptId: "receipt-a", expiresAt: "2099-01-01T00:00:00.000Z" }
    },
    deleteScoutYear: async () => { throw new Error("Deletion failed"); }
  });
  flow.openScoutYearDelete(flow.year);
  flow.setDeleteLabel(flow.year.label);
  flow.focusModal();
  await flow.confirmScoutYearDelete();
  flow.focusScoutYearDeleteEnabledControl();
  assert.ok(flow.events.includes("input-focus"));
  assert.match(dashboard, /else if \(scoutYearDeleteRequest\) \{\s+focusScoutYearDeleteEnabledControl\(\);/);

  flow.focusModal();
  const fromContainer = { key: "Tab", shiftKey: true, preventDefault: () => flow.events.push("prevent-reverse") };
  flow.handleScoutYearDeleteModalKeyDown(fromContainer);
  assert.ok(flow.events.includes("prevent-reverse"));
  assert.ok(flow.events.includes("cancel-focus"));

  flow.focusOutside();
  const fromOutside = { key: "Tab", shiftKey: true, preventDefault: () => flow.events.push("prevent-outside") };
  flow.handleScoutYearDeleteModalKeyDown(fromOutside);
  assert.ok(flow.events.includes("prevent-outside"));
});

test("receipt expiry never overwrites an in-flight deleting state", () => {
  const flow = deletionHarness();
  const expired = flow.expireScoutYearReceipts({
    deleting: { yearId: "deleting", status: "deleting", receiptId: "receipt-delete", expiresAt: "2000-01-01T00:00:00.000Z" },
    ready: { yearId: "ready", status: "ready", receiptId: "receipt-ready", expiresAt: "2000-01-01T00:00:00.000Z" }
  }, Date.parse("2026-01-01T00:00:00.000Z"));
  assert.equal(expired.deleting.status, "deleting");
  assert.equal(expired.deleting.receiptId, "receipt-delete");
  assert.equal(expired.ready.status, "expired");
  assert.equal(expired.ready.receiptId, undefined);
});

test("unmount invalidates late backup and deletion continuations", async () => {
  assert.match(dashboard, /return cleanupScoutYearOperations/);

  let resolveBackup;
  const backupFlow = deletionHarness({
    createScoutYearBackup: () => new Promise((resolve) => { resolveBackup = resolve; })
  });
  const backupRequest = backupFlow.downloadScoutYearBackup(backupFlow.year);
  backupFlow.cleanupScoutYearOperations();
  resolveBackup({ receiptId: "late", downloadUrl: "https://signed.example/late.zip", expiresAt: "2099-01-01T00:00:00.000Z", manifest: {} });
  await backupRequest;
  assert.equal(backupFlow.events.some((event) => Array.isArray(event) && event[0] === "click"), false);
  assert.equal(backupFlow.state().scoutYearBackups[backupFlow.year.id]?.receiptId, undefined);

  let resolveDelete;
  const deleteFlow = deletionHarness({
    initialBackups: {
      "year-a": { yearId: "year-a", status: "ready", receiptId: "receipt-a", expiresAt: "2099-01-01T00:00:00.000Z" }
    },
    deleteScoutYear: () => new Promise((resolve) => { resolveDelete = resolve; })
  });
  deleteFlow.openScoutYearDelete(deleteFlow.year);
  deleteFlow.setDeleteLabel(deleteFlow.year.label);
  const deleteRequest = deleteFlow.confirmScoutYearDelete();
  deleteFlow.cleanupScoutYearOperations();
  resolveDelete({ deleted: true, storageCleanupPending: false });
  await deleteRequest;
  assert.equal(deleteFlow.events.filter((event) => event === "refresh").length, 0);
  assert.equal(deleteFlow.state().scoutYearDeleteRequest?.yearId, deleteFlow.year.id);
});

test("scoped controls have responsive and dark-mode styles without broad important overrides", () => {
  for (const selector of [".scout-year-danger-zone", ".scout-year-backup-status", ".scout-year-delete-action", ".scout-year-delete-modal"]) {
    assert.match(styles, new RegExp(selector.replace(".", "\\.")));
  }
  assert.match(styles, /@media \(max-width: 768px\)[\s\S]*?\.scout-year-danger-zone/);
  assert.match(styles, /dashboard-theme-dark[\s\S]*?\.scout-year-danger-zone/);
  const taskStyles = styles.slice(styles.indexOf(".scout-year-danger-zone"));
  assert.doesNotMatch(taskStyles, /!important/);
});
