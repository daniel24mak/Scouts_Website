import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(new URL("../../src/pages/AdminDashboardPage.jsx", import.meta.url), "utf8");
const manager = readFileSync(new URL("../../src/features/attendance/AttendanceSheetsManager.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");

test("attendance sheets rely on the dashboard selector and render no internal group select", () => {
  assert.match(dashboard, /renderCoordinatorGroupSwitcher\("View attendance for group"\)/);
  assert.doesNotMatch(manager, /setSelectedGroupId|onChange=\{\(event\) => setSelectedGroupId/);
  assert.match(manager, /data\.groups\.find\(\(group\) => group\.id === user\?\.groupId\)/);
});

test("attendance table exposes compact session controls and sticky percentage cells", () => {
  for (const className of [
    "attendance-session-summary",
    "attendance-session-editor",
    "attendance-session-fields",
    "attendance-session-actions",
    "attendance-percentage-column"
  ]) {
    assert.match(manager, new RegExp(className));
  }
  assert.match(manager, /<details className="attendance-session-editor">/);
  assert.match(manager, /<summary>Edit session<\/summary>/);
  assert.match(manager, /No attendance records match/);
});

test("attendance layout keeps sticky cells opaque and the page stack compact", () => {
  assert.match(styles, /\.attendance-sheets-page\s*\{[^}]*gap:\s*12px/s);
  assert.match(styles, /tbody td\.attendance-sticky-column,[^{]+\{[^}]*background:\s*var\(--dashboard-surface\)\s*!important/s);
  assert.match(styles, /th\.attendance-sticky-column,[^{]+\{[^}]*background:\s*var\(--dashboard-surface-2\)\s*!important/s);
});
