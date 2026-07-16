import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePeopleAccessInvitation,
  filterPeopleAccessUsers,
  normalizePeopleAccessWorkspace,
  normalizeUserAccessDetails
} from "../../src/features/people-access/peopleAccessModel.js";
import { createPeopleAccessService } from "../../src/services/peopleAccessService.js";

test("workspace normalization keeps normalized assignments separate from legacy compatibility", () => {
  const workspace = normalizePeopleAccessWorkspace({
    users: [{
      id: "user-1",
      full_name: "Chief Daniel",
      account_status: "active",
      role_assignments: [{ role_key: "finance_viewer", role_name: "Finance Viewer" }],
      team_memberships: [{ team_key: "finance", team_name: "Finance Team" }],
      legacy_access: { role: "chief", can_publish: true }
    }],
    summary: { active_users: 1, direct_overrides: 2 }
  });

  assert.equal(workspace.users[0].name, "Chief Daniel");
  assert.equal(workspace.users[0].roles[0].key, "finance_viewer");
  assert.equal(workspace.users[0].teams[0].name, "Finance Team");
  assert.deepEqual(workspace.users[0].legacyAccess, { role: "chief", can_publish: true });
  assert.equal(workspace.summary.directOverrides, 2);
});

test("user filters combine and search roles, teams, groups, names, and email", () => {
  const users = normalizePeopleAccessWorkspace({ users: [
    { id: "1", full_name: "Daniel", email: "daniel@example.com", account_status: "active", role_assignments: [{ role_key: "finance_viewer" }], team_memberships: [{ team_key: "finance" }] },
    { id: "2", full_name: "Clara", email: "clara@example.com", account_status: "disabled", role_assignments: [{ role_key: "storage_manager" }], team_memberships: [{ team_key: "storage" }] }
  ] }).users;

  assert.deepEqual(filterPeopleAccessUsers(users, { search: "finance", status: "active" }).map(({ id }) => id), ["1"]);
  assert.deepEqual(filterPeopleAccessUsers(users, { role: "storage_manager", team: "storage" }).map(({ id }) => id), ["2"]);
});

test("missing security telemetry is represented as unavailable rather than invented", () => {
  const details = normalizeUserAccessDetails({ user: { id: "user-1", full_name: "Daniel" } });
  assert.equal(details.security.mfaStatus, "unavailable");
  assert.equal(details.security.lastSignIn, null);
  assert.equal(details.security.activeSessions, null);
});

test("legacy account assignments remain visible until normalized backfill is complete", () => {
  const details = normalizeUserAccessDetails({
    user: { id: "user-1", full_name: "Daniel", role: "chief", group_id: "louveteaux", chief_level: "head" },
    role_assignments: [],
    group_assignments: []
  });

  assert.equal(details.roleAssignments[0].name, "Legacy Chief");
  assert.equal(details.roleAssignments[0].status, "legacy");
  assert.equal(details.groupAssignments[0].group_id, "louveteaux");
  assert.equal(details.groupAssignments[0].position, "head");
});

test("invitation normalization preserves multiple assignments and the cropped avatar", () => {
  const avatar = { name: "avatar.webp" };
  const invitation = normalizePeopleAccessInvitation({
    name: "  Chief Daniel  ",
    email: "  DANIEL@example.com ",
    profilePictureFile: avatar,
    groups: [
      { groupId: "louveteaux", position: "head_chief", isPrimary: true },
      { groupId: "pioneer", position: "coordinator" }
    ],
    teams: [
      { teamId: "finance", position: "member" },
      { teamId: "storage", position: "manager" }
    ],
    roles: [
      { roleId: "finance_viewer", scopeType: "global", scopeId: "ignored" },
      { roleId: "storage_manager", scopeType: "team", scopeId: "storage" }
    ]
  });

  assert.equal(invitation.name, "Chief Daniel");
  assert.equal(invitation.email, "daniel@example.com");
  assert.equal(invitation.profilePictureFile, avatar);
  assert.deepEqual(invitation.assignedGroupIds, ["louveteaux", "pioneer"]);
  assert.equal(invitation.groups.length, 2);
  assert.equal(invitation.teams.length, 2);
  assert.equal(invitation.roles.length, 2);
  assert.equal(invitation.roles[0].scopeId, null);
  assert.equal(invitation.roles[1].scopeId, "storage");
});

test("service uses secure RPC contracts for reads and mutations", async () => {
  const calls = [];
  const service = createPeopleAccessService({
    callRpc: async (name, payload) => {
      calls.push([name, payload]);
      if (name === "get_people_access_workspace") return { users: [] };
      if (name === "get_user_access_details") return { user: { id: payload.target_user_id } };
      return { ok: true };
    }
  });

  await service.getWorkspace();
  await service.getUserDetails("user-1");
  await service.saveRoleAssignment({ userId: "user-1", roleId: "finance_viewer" });
  await service.revokeRoleAssignment("assignment-1", "Access review");

  assert.deepEqual(calls, [
    ["get_people_access_workspace", {}],
    ["get_user_access_details", { target_user_id: "user-1" }],
    ["save_user_role_assignment", { payload: { userId: "user-1", roleId: "finance_viewer" } }],
    ["revoke_user_role_assignment", { target_assignment_id: "assignment-1", reason: "Access review" }]
  ]);
});

test("service never performs normalized authorization writes through direct table helpers", () => {
  const source = createPeopleAccessService.toString();
  assert.doesNotMatch(source, /insertSupabase|updateSupabase|deleteSupabase|getSupabaseRows/);
  assert.doesNotMatch(source, /user_metadata|app_metadata/);
});
