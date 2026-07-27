const COMMON_START = Object.freeze(["overview", "aiAssistant"]);
const COMMON_END = Object.freeze(["myWork", "notifications"]);

export const WORKSPACE_NAVIGATION = Object.freeze({
  scouting: Object.freeze([...COMMON_START, "myGroup", "registrationVerification", "scoutAttendance", "myForms", "scoutingStorage", "calendar", "documents", "reports", ...COMMON_END]),
  admin: Object.freeze([
    ...COMMON_START,
    "usersPermissions", "approvals", "manageForms",
    "websiteContent", "posts", "gallery", "calendar", "contactMessages",
    "scoutingStructure", "scouts", "upload", "rules",
    "documents", "reports", "system", "archives",
    ...COMMON_END
  ]),
  finance: Object.freeze([...COMMON_START, "transactions", "purchase-requests", "reimbursements", "collections", "accounts-funds", "budgets", "reconciliation-periods", "reports", "settings", ...COMMON_END]),
  storage: Object.freeze([...COMMON_START, "inventory", "requests", "loans", "locations-movements", "procurement", "maintenance", "audits", "reports", ...COMMON_END]),
  media: Object.freeze([...COMMON_START, "posts", "gallery", "calendar", ...COMMON_END])
});

const SECTION_ALIASES = Object.freeze({
  finance: Object.freeze({ accounts: "accounts-funds", funds: "accounts-funds", reconciliation: "reconciliation-periods", periods: "reconciliation-periods" }),
  storage: Object.freeze({ assets: "inventory", kits: "inventory", locations: "locations-movements", movements: "locations-movements", restocking: "procurement", suppliers: "procurement", deliveries: "procurement" })
});

export function getCanonicalWorkspaceSection(workspaceKey, sectionKey) {
  return SECTION_ALIASES[workspaceKey]?.[sectionKey] ?? sectionKey;
}

export function getWorkspaceNavigationIds(workspaceKey) {
  return WORKSPACE_NAVIGATION[workspaceKey] ?? WORKSPACE_NAVIGATION.scouting;
}

export function isWorkspaceSectionAllowed(workspaceKey, sectionKey) {
  return getWorkspaceNavigationIds(workspaceKey).includes(getCanonicalWorkspaceSection(workspaceKey, sectionKey));
}

export function getSafeWorkspaceSection(workspaceKey, sectionKey) {
  const canonical = getCanonicalWorkspaceSection(workspaceKey, sectionKey);
  return isWorkspaceSectionAllowed(workspaceKey, canonical) ? canonical : "overview";
}
