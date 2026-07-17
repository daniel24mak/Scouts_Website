import { normalizePeopleAccessWorkspace, normalizeUserAccessDetails } from "../features/people-access/peopleAccessModel.js";
import { callSupabaseRpc } from "./supabaseClient.js";

export function createPeopleAccessService({ callRpc = callSupabaseRpc } = {}) {
  const mutate = (name, payload) => callRpc(name, payload);
  return {
    getWorkspace: async () => normalizePeopleAccessWorkspace(await callRpc("get_people_access_workspace", {})),
    getUserDetails: async (userId) => normalizeUserAccessDetails(await callRpc("get_user_access_details", { target_user_id: userId })),
    saveRoleAssignment: (payload) => mutate("save_user_role_assignment", { payload }),
    revokeRoleAssignment: (assignmentId, reason) => mutate("revoke_user_role_assignment", { target_assignment_id: assignmentId, reason }),
    saveGroupAssignment: (payload) => mutate("save_user_group_assignment", { payload }),
    revokeGroupAssignment: (assignmentId, reason) => mutate("revoke_user_group_assignment", { target_assignment_id: assignmentId, reason }),
    revokeLegacyGroupAssignment: (userId, groupId, reason) => mutate("revoke_legacy_user_group_assignment", { target_user_id: userId, target_group_id: groupId, reason }),
    saveTeamMembership: (payload) => mutate("save_user_team_membership", { payload }),
    revokeTeamMembership: (membershipId, reason) => mutate("revoke_user_team_membership", { target_membership_id: membershipId, reason }),
    savePermissionOverride: (payload) => mutate("save_user_permission_override", { payload }),
    revokePermissionOverride: (overrideId, reason) => mutate("revoke_user_permission_override", { target_override_id: overrideId, reason }),
    saveRole: (payload) => mutate("save_access_role", { payload }),
    deleteRole: (roleId, reason) => mutate("delete_access_role", { target_role_id: roleId, reason }),
    saveTeam: (payload) => mutate("save_access_team", { payload }),
    disableTeam: (teamId, reason) => mutate("disable_access_team", { target_team_id: teamId, reason }),
    deleteTeam: (teamId, reason) => mutate("delete_access_team", { target_team_id: teamId, reason }),
    decideReview: (reviewId, decision, notes = "") => mutate("decide_access_review", { target_review_id: reviewId, decision, notes }),
    resolveMigrationDifference: (differenceId, resolution, notes = "") => mutate("resolve_authorization_difference", { target_difference_id: differenceId, resolution, notes })
  };
}

const service = createPeopleAccessService();
export const getPeopleAccessWorkspace = service.getWorkspace;
export const getUserAccessDetails = service.getUserDetails;
export const saveUserRoleAssignment = service.saveRoleAssignment;
export const revokeUserRoleAssignment = service.revokeRoleAssignment;
export const saveUserGroupAssignment = service.saveGroupAssignment;
export const revokeUserGroupAssignment = service.revokeGroupAssignment;
export const revokeLegacyUserGroupAssignment = service.revokeLegacyGroupAssignment;
export const saveUserTeamMembership = service.saveTeamMembership;
export const revokeUserTeamMembership = service.revokeTeamMembership;
export const saveUserPermissionOverride = service.savePermissionOverride;
export const revokeUserPermissionOverride = service.revokePermissionOverride;
export const saveAccessRole = service.saveRole;
export const deleteAccessRole = service.deleteRole;
export const saveAccessTeam = service.saveTeam;
export const disableAccessTeam = service.disableTeam;
export const deleteAccessTeam = service.deleteTeam;
export const decideAccessReview = service.decideReview;
export const resolveAuthorizationDifference = service.resolveMigrationDifference;
