import { getWorkspaceDefinition } from "./workspaceCatalog.js";

const SAFE_SEGMENT = /^[A-Za-z][A-Za-z0-9-]*$/;

export function buildWorkspaceSectionPath(workspaceKey, section = "overview") {
  const workspace = getWorkspaceDefinition(workspaceKey);
  if (!workspace || typeof section !== "string" || !SAFE_SEGMENT.test(section)) return null;
  return section === "overview" ? workspace.basePath : `${workspace.basePath}/${section}`;
}

export function getWorkspaceSectionFromPath(pathname, workspaceKey) {
  const workspace = getWorkspaceDefinition(workspaceKey);
  if (!workspace || typeof pathname !== "string") return null;
  if (pathname === workspace.basePath || pathname === `${workspace.basePath}/`) return "overview";
  if (!pathname.startsWith(`${workspace.basePath}/`)) return null;

  const remainder = pathname.slice(workspace.basePath.length + 1);
  return SAFE_SEGMENT.test(remainder) ? remainder : null;
}
