import { hasEffectivePermission, normalizeEffectiveAccess } from "../services/accessControlResolver.js";
import { WORKSPACE_CATALOG, getWorkspaceDefinition } from "./workspaceCatalog.js";

const SYSTEM_ADMIN_ROLE = "system_administrator";

function getLegacyRole(user) {
  const role = user?.role ?? user?.roleKey ?? user?.role_key;
  return typeof role === "string" ? role.trim().toLowerCase() : "";
}

function isLegacyAccountActive(user) {
  const status = user?.accountStatus ?? user?.account_status ?? "active";
  return status === "active";
}

function toPermissionScope(permission) {
  if (permission.scopeType === "global") return null;
  return { type: permission.scopeType, id: permission.scopeId ?? null };
}

function hasAnyPermission(access, permissionKeys) {
  return permissionKeys.some((permissionKey) => (
    access.permissions
      .filter((permission) => permission.key === permissionKey)
      .some((permission) => hasEffectivePermission(access, permissionKey, toPermissionScope(permission)))
  ));
}

function hasNormalizedWorkspaceAccess(workspace, effectiveAccess) {
  const access = normalizeEffectiveAccess(effectiveAccess);
  if (access.accountStatus !== "active") return false;

  if (hasAnyPermission(access, workspace.accessPermissions)) return true;

  const hasSystemAdministratorRole = access.roles.some((role) => (
    (role.key ?? role.roleKey ?? role.role_key) === SYSTEM_ADMIN_ROLE
  ));
  if (!hasSystemAdministratorRole) return false;

  return !access.restrictions.some((restriction) => (
    restriction.effect === "deny"
    && workspace.accessPermissions.includes(restriction.key)
  ));
}

function hasLegacyWorkspaceAccess(workspace, user) {
  return isLegacyAccountActive(user) && workspace.legacyRoles.includes(getLegacyRole(user));
}

export function isWorkspaceRouteAllowed({ workspaceKey, user = null, effectiveAccess } = {}) {
  const workspace = getWorkspaceDefinition(workspaceKey);
  if (!workspace) return false;

  const hasNormalizedSnapshot = effectiveAccess !== null && effectiveAccess !== undefined;
  return hasNormalizedSnapshot
    ? hasNormalizedWorkspaceAccess(workspace, effectiveAccess)
    : hasLegacyWorkspaceAccess(workspace, user);
}

export function getAvailableWorkspaces({ user = null, effectiveAccess } = {}) {
  return WORKSPACE_CATALOG.filter((workspace) => isWorkspaceRouteAllowed({
    workspaceKey: workspace.key,
    user,
    effectiveAccess
  }));
}

function normalizeWorkspaceKey(value) {
  return getWorkspaceDefinition(value)?.key ?? null;
}

function isSafeWorkspacePath(path, workspace) {
  if (typeof path !== "string") return false;
  return path === workspace.basePath || path.startsWith(`${workspace.basePath}/`);
}

export function resolveWorkspaceDestination({
  user = null,
  effectiveAccess,
  requestedWorkspace = null,
  lastWorkspace = null,
  preferredWorkspace = null,
  primaryWorkspace = null,
  lastRoutes = {},
  startAtOverview = false
} = {}) {
  const available = getAvailableWorkspaces({ user, effectiveAccess });
  if (!available.length) return null;

  const allowedKeys = new Set(available.map(({ key }) => key));
  if (startAtOverview) {
    const requestedKey = normalizeWorkspaceKey(requestedWorkspace);
    const workspaceKey = requestedKey && allowedKeys.has(requestedKey)
      ? requestedKey
      : allowedKeys.has("admin")
        ? "admin"
        : available[0].key;
    const workspace = getWorkspaceDefinition(workspaceKey);

    return { workspaceKey, path: workspace.basePath };
  }

  const candidates = [requestedWorkspace, lastWorkspace, preferredWorkspace, primaryWorkspace]
    .map(normalizeWorkspaceKey)
    .filter(Boolean);
  const workspaceKey = candidates.find((candidate) => allowedKeys.has(candidate)) ?? available[0].key;
  const workspace = getWorkspaceDefinition(workspaceKey);
  const savedPath = lastRoutes && typeof lastRoutes === "object" ? lastRoutes[workspaceKey] : null;

  return {
    workspaceKey,
    path: isSafeWorkspacePath(savedPath, workspace) ? savedPath : workspace.basePath
  };
}
