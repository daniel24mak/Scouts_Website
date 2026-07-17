import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWorkspaceSectionPath,
  getWorkspaceSectionFromPath
} from "../../src/workspaces/workspaceRouting.js";

test("workspace overview uses the canonical workspace root", () => {
  assert.equal(buildWorkspaceSectionPath("scouting", "overview"), "/dashboard/scouting");
});

test("workspace sections use stable nested URLs", () => {
  assert.equal(buildWorkspaceSectionPath("finance", "transactions"), "/dashboard/finance/transactions");
  assert.equal(buildWorkspaceSectionPath("scouting", "scoutAttendance"), "/dashboard/scouting/scoutAttendance");
});

test("unsafe workspace and section identifiers fail closed", () => {
  assert.equal(buildWorkspaceSectionPath("finance/../admin", "users"), null);
  assert.equal(buildWorkspaceSectionPath("finance", "../admin"), null);
});

test("the section is read only from the selected workspace path", () => {
  assert.equal(getWorkspaceSectionFromPath("/dashboard/storage/inventory", "storage"), "inventory");
  assert.equal(getWorkspaceSectionFromPath("/dashboard/admin/users", "finance"), null);
});

test("workspace roots resolve to overview", () => {
  assert.equal(getWorkspaceSectionFromPath("/dashboard/scouting", "scouting"), "overview");
  assert.equal(getWorkspaceSectionFromPath("/dashboard/scouting/", "scouting"), "overview");
});
