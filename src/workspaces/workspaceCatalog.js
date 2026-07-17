export const WORKSPACE_CATALOG = Object.freeze([
  Object.freeze({
    key: "scouting",
    label: "Scouting",
    basePath: "/dashboard/scouting",
    accessPermissions: Object.freeze(["scouting.workspace.access", "dashboard.access"]),
    legacyRoles: Object.freeze(["admin", "chief", "coordinator"])
  }),
  Object.freeze({
    key: "finance",
    label: "Finance",
    basePath: "/dashboard/finance",
    accessPermissions: Object.freeze(["finance.workspace.access"]),
    legacyRoles: Object.freeze(["admin", "finance_viewer", "finance_contributor", "finance_approver"])
  }),
  Object.freeze({
    key: "storage",
    label: "Storage",
    basePath: "/dashboard/storage",
    accessPermissions: Object.freeze(["storage.workspace.access"]),
    legacyRoles: Object.freeze(["admin", "storage_assistant", "storage_manager"])
  }),
  Object.freeze({
    key: "media",
    label: "Media",
    basePath: "/dashboard/media",
    accessPermissions: Object.freeze(["media.workspace.access"]),
    legacyRoles: Object.freeze(["admin", "media_contributor", "media_manager"])
  }),
  Object.freeze({
    key: "admin",
    label: "Administration",
    basePath: "/dashboard/admin",
    accessPermissions: Object.freeze(["admin.workspace.access"]),
    legacyRoles: Object.freeze(["admin"])
  })
]);

export const WORKSPACES_BY_KEY = Object.freeze(Object.fromEntries(
  WORKSPACE_CATALOG.map((workspace) => [workspace.key, workspace])
));

export function getWorkspaceDefinition(workspaceKey) {
  if (typeof workspaceKey !== "string") return null;
  return WORKSPACES_BY_KEY[workspaceKey.trim().toLowerCase()] ?? null;
}
