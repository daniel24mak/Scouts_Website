const asArray = (value) => Array.isArray(value) ? value : [];
const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

export function normalizePeopleAccessInvitation(draft = {}) {
  const groups = asArray(draft.groups)
    .filter((item) => item?.groupId)
    .map((item, index) => ({
      ...item,
      position: item.position || "chief",
      isPrimary: Boolean(item.isPrimary || index === 0)
    }));
  const teams = asArray(draft.teams)
    .filter((item) => item?.teamId)
    .map((item) => ({ ...item, position: item.position || "member" }));
  const roles = asArray(draft.roles)
    .filter((item) => item?.roleId)
    .map((item) => ({
      ...item,
      scopeType: item.scopeType || "global",
      scopeId: ["global", "own_records"].includes(item.scopeType || "global") ? null : item.scopeId || null,
      expiresAt: item.expiresAt || null,
      reason: String(item.reason || draft.reason || "Initial dashboard access").trim()
    }));

  return {
    ...draft,
    name: String(draft.name || "").trim(),
    email: String(draft.email || "").trim().toLocaleLowerCase(),
    groups,
    teams,
    roles,
    assignedGroupIds: groups.map((item) => item.groupId)
  };
}

function normalizeAssignment(row = {}, kind) {
  const key = firstDefined(row.key, row[`${kind}_key`], row.role_key, row.team_key, row.position_key, "");
  const name = firstDefined(row.name, row[`${kind}_name`], row.role_name, row.team_name, row.position_name, key);
  return {
    ...row,
    id: firstDefined(row.id, row.assignment_id, row.membership_id, null),
    key,
    name,
    scopeType: firstDefined(row.scopeType, row.scope_type, "global"),
    scopeId: firstDefined(row.scopeId, row.scope_id, null),
    startsAt: firstDefined(row.startsAt, row.starts_at, null),
    expiresAt: firstDefined(row.expiresAt, row.expires_at, null),
    status: firstDefined(row.status, row.assignment_status, row.membership_status, "active")
  };
}

export function normalizePeopleAccessUser(row = {}) {
  const roles = asArray(firstDefined(row.roles, row.role_assignments)).map((item) => normalizeAssignment(item, "role"));
  const teams = asArray(firstDefined(row.teams, row.team_memberships)).map((item) => normalizeAssignment(item, "team"));
  const groups = asArray(firstDefined(row.groups, row.group_assignments)).map((item) => normalizeAssignment(item, "group"));
  return {
    ...row,
    id: row.id ?? row.user_id ?? null,
    name: firstDefined(row.name, row.full_name, "Unnamed user"),
    email: row.email ?? "",
    profilePictureUrl: firstDefined(row.profilePictureUrl, row.profile_picture_url, null),
    accountStatus: firstDefined(row.accountStatus, row.account_status, "unknown"),
    invitationStatus: firstDefined(row.invitationStatus, row.invitation_status, "unknown"),
    scoutingPosition: firstDefined(row.scoutingPosition, row.scouting_position, row.chief_level, null),
    primaryGroup: firstDefined(row.primaryGroup, row.primary_group, groups.find((group) => group.is_primary)?.name, null),
    roles,
    teams,
    groups,
    warnings: asArray(firstDefined(row.warnings, row.access_warnings)),
    mfaStatus: firstDefined(row.mfaStatus, row.mfa_status, "unavailable"),
    lastActive: firstDefined(row.lastActive, row.last_active, row.last_sign_in_at, null),
    hasTemporaryAccess: Boolean(firstDefined(row.hasTemporaryAccess, row.has_temporary_access, false)),
    hasDirectOverrides: Boolean(firstDefined(row.hasDirectOverrides, row.has_direct_overrides, false)),
    hasMigrationDifferences: Boolean(firstDefined(row.hasMigrationDifferences, row.has_migration_differences, false)),
    legacyAccess: firstDefined(row.legacyAccess, row.legacy_access, {
      role: row.role ?? null,
      groupId: firstDefined(row.groupId, row.group_id, null),
      chiefLevel: firstDefined(row.chiefLevel, row.chief_level, null)
    })
  };
}

function normalizeCatalogItem(row = {}, kind) {
  return {
    ...row,
    id: firstDefined(row.id, row[`${kind}_id`], row.key, null),
    key: firstDefined(row.key, row[`${kind}_key`], row.id, ""),
    name: firstDefined(row.name, row[`${kind}_name`], row.key, "Unnamed"),
    description: row.description ?? "",
    isActive: Boolean(firstDefined(row.isActive, row.is_active, true)),
    isSystem: Boolean(firstDefined(row.isSystem, row.is_system, row.is_protected, false)),
    riskLevel: firstDefined(row.riskLevel, row.risk_level, "standard"),
    requiresMfa: Boolean(firstDefined(row.requiresMfa, row.requires_mfa, false)),
    supportedScopes: asArray(firstDefined(row.supportedScopes, row.supported_scopes)),
    memberCount: Number(firstDefined(row.memberCount, row.member_count, row.user_count, 0)),
    permissionCount: Number(firstDefined(row.permissionCount, row.permission_count, 0))
  };
}

export function normalizePeopleAccessWorkspace(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const summary = source.summary ?? {};
  return {
    users: asArray(source.users).map(normalizePeopleAccessUser),
    roles: asArray(source.roles).map((row) => normalizeCatalogItem(row, "role")),
    teams: asArray(source.teams).map((row) => normalizeCatalogItem(row, "team")),
    permissions: asArray(source.permissions).map((row) => normalizeCatalogItem(row, "permission")),
    groups: asArray(source.groups).map((row) => normalizeCatalogItem(row, "group")),
    accessReviews: asArray(firstDefined(source.accessReviews, source.access_reviews)),
    migrationDifferences: asArray(firstDefined(source.migrationDifferences, source.migration_differences)),
    auditLogs: asArray(firstDefined(source.auditLogs, source.audit_logs)),
    summary: {
      activeUsers: Number(firstDefined(summary.activeUsers, summary.active_users, 0)),
      invitedUsers: Number(firstDefined(summary.invitedUsers, summary.invited_users, 0)),
      disabledUsers: Number(firstDefined(summary.disabledUsers, summary.disabled_users, 0)),
      usersWithoutMfa: firstDefined(summary.usersWithoutMfa, summary.users_without_mfa, null),
      highRiskAssignments: Number(firstDefined(summary.highRiskAssignments, summary.high_risk_assignments, 0)),
      expiringAccess: Number(firstDefined(summary.expiringAccess, summary.expiring_access, 0)),
      migrationDifferences: Number(firstDefined(summary.migrationDifferences, summary.migration_differences, 0)),
      directOverrides: Number(firstDefined(summary.directOverrides, summary.direct_overrides, 0))
    }
  };
}

export function normalizeUserAccessDetails(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const security = source.security ?? {};
  const user = normalizePeopleAccessUser(source.user ?? source.profile ?? source);
  const normalizedRoles = asArray(firstDefined(source.roleAssignments, source.role_assignments)).map((row) => normalizeAssignment(row, "role"));
  const normalizedGroups = asArray(firstDefined(source.groupAssignments, source.group_assignments)).map((row) => normalizeAssignment(row, "group"));
  const roleAssignments = normalizedRoles.length || !user.legacyAccess?.role ? normalizedRoles : [{
    id: "legacy-role",
    key: user.legacyAccess.role,
    name: `Legacy ${String(user.legacyAccess.role).replace(/\b\w/g, (letter) => letter.toUpperCase())}`,
    scopeType: user.legacyAccess.groupId ? "group" : "global",
    scopeId: user.legacyAccess.groupId ?? null,
    status: "legacy"
  }];
  const groupAssignments = normalizedGroups.length || !user.legacyAccess?.groupId ? normalizedGroups : [{
    id: "legacy-group",
    group_id: user.legacyAccess.groupId,
    name: user.primaryGroup || user.legacyAccess.groupId,
    position: user.legacyAccess.chiefLevel || user.scoutingPosition || "chief",
    isPrimary: true,
    status: "legacy"
  }];
  return {
    user,
    roleAssignments,
    groupAssignments,
    teamMemberships: asArray(firstDefined(source.teamMemberships, source.team_memberships)).map((row) => normalizeAssignment(row, "team")),
    permissionOverrides: asArray(firstDefined(source.permissionOverrides, source.permission_overrides)),
    effectiveAccess: source.effectiveAccess ?? source.effective_access ?? null,
    migrationDifferences: asArray(firstDefined(source.migrationDifferences, source.migration_differences)),
    activity: asArray(source.activity),
    security: {
      mfaStatus: firstDefined(security.mfaStatus, security.mfa_status, "unavailable"),
      mfaRequired: security.mfaRequired ?? security.mfa_required ?? null,
      assuranceLevel: security.assuranceLevel ?? security.assurance_level ?? null,
      lastSignIn: security.lastSignIn ?? security.last_sign_in ?? null,
      lastPasswordReset: security.lastPasswordReset ?? security.last_password_reset ?? null,
      activeSessions: security.activeSessions ?? security.active_sessions ?? null
    }
  };
}

export function filterPeopleAccessUsers(users, filters = {}) {
  const search = String(filters.search ?? "").trim().toLocaleLowerCase();
  return asArray(users).filter((user) => {
    if (filters.status && filters.status !== "all" && user.accountStatus !== filters.status) return false;
    if (filters.role && filters.role !== "all" && !user.roles.some((role) => role.key === filters.role || role.id === filters.role)) return false;
    if (filters.team && filters.team !== "all" && !user.teams.some((team) => team.key === filters.team || team.id === filters.team)) return false;
    if (filters.group && filters.group !== "all" && !user.groups.some((group) => group.key === filters.group || group.id === filters.group)) return false;
    if (filters.mfa === "missing" && !["missing", "not_enrolled"].includes(user.mfaStatus)) return false;
    if (filters.temporary === "yes" && !user.hasTemporaryAccess) return false;
    if (filters.overrides === "yes" && !user.hasDirectOverrides) return false;
    if (filters.migration === "yes" && !user.hasMigrationDifferences) return false;
    if (!search) return true;
    return [user.name, user.email, user.scoutingPosition, user.primaryGroup,
      ...user.roles.flatMap((role) => [role.name, role.key]),
      ...user.teams.flatMap((team) => [team.name, team.key]),
      ...user.groups.flatMap((group) => [group.name, group.key])]
      .filter(Boolean).join(" ").toLocaleLowerCase().includes(search);
  });
}
