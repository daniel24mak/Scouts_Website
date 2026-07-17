const COMMON_START = Object.freeze(["overview", "aiAssistant"]);
const COMMON_END = Object.freeze(["myWork", "notifications"]);

export const WORKSPACE_NAVIGATION = Object.freeze({
  scouting: Object.freeze([...COMMON_START, "myGroup", "scoutAttendance", "myForms", "scoutingStorage", "calendar", "documents", "reports", ...COMMON_END]),
  admin: Object.freeze([
    ...COMMON_START,
    "usersPermissions", "approvals", "manageForms",
    "websiteContent", "posts", "gallery", "calendar", "contactMessages",
    "scoutingStructure", "scouts", "upload", "rules",
    "documents", "reports", "system", "archives",
    ...COMMON_END
  ]),
  finance: Object.freeze([...COMMON_START, "transactions", "accounts", "funds", "budgets", "purchase-requests", "reimbursements", "collections", "reconciliation", "periods", "reports", "settings", ...COMMON_END]),
  storage: Object.freeze([...COMMON_START, "inventory", "assets", "kits", "requests", "loans", "locations", "movements", "restocking", "suppliers", "maintenance", "audits", "reports", "settings", ...COMMON_END]),
  media: Object.freeze([...COMMON_START, "posts", "gallery", "calendar", ...COMMON_END])
});

export function getWorkspaceNavigationIds(workspaceKey) {
  return WORKSPACE_NAVIGATION[workspaceKey] ?? WORKSPACE_NAVIGATION.scouting;
}

export function isWorkspaceSectionAllowed(workspaceKey, sectionKey) {
  return getWorkspaceNavigationIds(workspaceKey).includes(sectionKey);
}

export function getSafeWorkspaceSection(workspaceKey, sectionKey) {
  return isWorkspaceSectionAllowed(workspaceKey, sectionKey) ? sectionKey : "overview";
}
