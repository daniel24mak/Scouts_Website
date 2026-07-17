import test from "node:test";
import assert from "node:assert/strict";
import { getSafeWorkspaceSection, getWorkspaceNavigationIds, isWorkspaceSectionAllowed } from "../../src/workspaces/workspaceNavigation.js";

test("Scouting exposes the focused service navigation only", () => {
  assert.deepEqual(getWorkspaceNavigationIds("scouting"), [
    "overview", "aiAssistant", "myGroup", "scoutAttendance", "myForms",
    "scoutingStorage", "calendar", "documents", "reports", "myWork", "notifications"
  ]);
  for (const hidden of ["chiefAttendance", "archives", "posts", "gallery", "usersPermissions"]) {
    assert.equal(isWorkspaceSectionAllowed("scouting", hidden), false);
  }
});

test("Administration and Media use focused workspace navigation", () => {
  assert.equal(isWorkspaceSectionAllowed("admin", "usersPermissions"), true);
  assert.equal(isWorkspaceSectionAllowed("admin", "archives"), true);
  assert.equal(isWorkspaceSectionAllowed("media", "posts"), true);
  assert.equal(isWorkspaceSectionAllowed("media", "usersPermissions"), false);
});

test("stale or edited workspace routes fall back to Overview", () => {
  assert.equal(getSafeWorkspaceSection("scouting", "finance"), "overview");
  assert.equal(getSafeWorkspaceSection("finance", "transactions"), "transactions");
});
