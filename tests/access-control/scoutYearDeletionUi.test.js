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

function deletionHarness(overrides = {}) {
  const sources = [
    "hasValidScoutYearReceipt",
    "invalidateScoutYearBackup",
    "triggerScoutYearBackupDownload",
    "downloadScoutYearBackup",
    "openScoutYearDelete",
    "cancelScoutYearDelete",
    "confirmScoutYearDelete"
  ].map(functionSource).join("\n");
  const events = [];
  const year = overrides.year ?? { id: "year-a", label: "2024-2025", status: "inactive", isActive: false };
  const secondYear = { id: "year-b", label: "2023-2024", status: "inactive", isActive: false };
  const scope = {
    initialBackups: overrides.initialBackups ?? {},
    initialRequest: null,
    initialLabel: "",
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
      }
    },
    Date,
    setSaveMessage(message) { events.push(["message", message]); }
  };
  const factory = new Function(...Object.keys(scope), `
    let scoutYearBackups = initialBackups;
    let scoutYearDeleteRequest = initialRequest;
    let scoutYearDeleteLabel = initialLabel;
    const scoutYearBackupBusyRef = { current: new Set() };
    const scoutYearBackupVersionRef = { current: {} };
    const scoutYearDeleteBusyRef = { current: false };
    const scoutYearsRef = { current: data.scoutYears };
    const scoutYearDeleteReturnFocusRef = { current: null };
    const setScoutYearBackups = (update) => { scoutYearBackups = typeof update === "function" ? update(scoutYearBackups) : update; };
    const setScoutYearDeleteRequest = (update) => { scoutYearDeleteRequest = typeof update === "function" ? update(scoutYearDeleteRequest) : update; };
    const setScoutYearDeleteLabel = (update) => { scoutYearDeleteLabel = typeof update === "function" ? update(scoutYearDeleteLabel) : update; };
    ${sources}
    return {
      hasValidScoutYearReceipt,
      invalidateScoutYearBackup,
      downloadScoutYearBackup,
      openScoutYearDelete,
      cancelScoutYearDelete,
      confirmScoutYearDelete,
      setDeleteLabel: setScoutYearDeleteLabel,
      replaceBackups: setScoutYearBackups,
      replaceYears: (years) => { scoutYearsRef.current = years; },
      state: () => ({ scoutYearBackups, scoutYearDeleteRequest, scoutYearDeleteLabel })
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

test("scoped controls have responsive and dark-mode styles without broad important overrides", () => {
  for (const selector of [".scout-year-danger-zone", ".scout-year-backup-status", ".scout-year-delete-action", ".scout-year-delete-modal"]) {
    assert.match(styles, new RegExp(selector.replace(".", "\\.")));
  }
  assert.match(styles, /@media \(max-width: 768px\)[\s\S]*?\.scout-year-danger-zone/);
  assert.match(styles, /dashboard-theme-dark[\s\S]*?\.scout-year-danger-zone/);
  const taskStyles = styles.slice(styles.indexOf(".scout-year-danger-zone"));
  assert.doesNotMatch(taskStyles, /!important/);
});
