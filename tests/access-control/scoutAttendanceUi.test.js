import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manager = readFileSync(new URL("../../src/features/attendance/ScoutAttendanceManager.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");

test("scout attendance shows only operational attendance columns", () => {
  assert.doesNotMatch(manager, /<th>School Grade<\/th>/);
  assert.doesNotMatch(manager, /<th>Age<\/th>/);
  assert.doesNotMatch(manager, /<td>\{getSchoolGrade\(scout\)\}<\/td>/);
  assert.doesNotMatch(manager, /<td>\{scout\.age\}<\/td>/);
  assert.match(manager, /<th>Name<\/th>[\s\S]*<th>Attendance<\/th>[\s\S]*<th>Attendance %<\/th>/);
});

test("light dashboard sticky table cells use opaque theme surfaces", () => {
  assert.match(styles, /\.admin-cms-shell:not\(\.dashboard-theme-dark\) \.table-panel th\s*\{[^}]*background:\s*var\(--dashboard-surface-2\)\s*!important/s);
  assert.match(styles, /\.admin-cms-shell:not\(\.dashboard-theme-dark\) \.table-panel td:first-child\s*\{[^}]*background:\s*var\(--dashboard-surface\)\s*!important/s);
});
