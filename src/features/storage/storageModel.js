export const STORAGE_NAVIGATION = Object.freeze([
  { key: "overview", label: "Overview", permission: "storage.workspace.access" },
  { key: "aiAssistant", label: "AI Assistant", permission: "storage.workspace.access" },
  { key: "inventory", label: "Inventory", group: "Catalog", permissions: ["storage.inventory.view"] },
  { key: "requests", label: "Requests", group: "Operations", permissions: ["storage.requests.view"] },
  { key: "loans", label: "Loans & Returns", group: "Operations", permissions: ["storage.loans.view"] },
  { key: "locations-movements", label: "Locations & Movements", group: "Operations", permissions: ["storage.inventory.view"] },
  { key: "procurement", label: "Procurement", group: "Supply & Care", permissions: ["storage.restocking.view", "storage.suppliers.view"] },
  { key: "maintenance", label: "Maintenance", group: "Supply & Care", permissions: ["storage.maintenance.view"] },
  { key: "audits", label: "Audits", group: "Supply & Care", permissions: ["storage.audits.view"] },
  { key: "reports", label: "Reports", group: "Insights", permissions: ["storage.reports.view"] },
  { key: "settings", label: "Storage Settings", permission: "storage.settings.manage" }
]);

export const STORAGE_SECTION_TABS = Object.freeze({
  inventory: Object.freeze([{ key: "items", label: "All Items" }, { key: "assets", label: "Assets" }, { key: "kits", label: "Kits" }, { key: "categories", label: "Categories" }]),
  "locations-movements": Object.freeze([{ key: "locations", label: "Locations" }, { key: "movements", label: "Movement History" }]),
  procurement: Object.freeze([{ key: "restocking", label: "Restocking" }, { key: "suppliers", label: "Suppliers" }, { key: "deliveries", label: "Deliveries" }])
});

export function getVisibleStorageNavigation(permissionKeys = []) {
  const permissions = new Set(permissionKeys);
  return STORAGE_NAVIGATION.filter((item) => ["overview", "aiAssistant"].includes(item.key) || permissions.has(item.permission) || item.permissions?.some((key) => permissions.has(key)));
}

export function normalizeStorageOverview(value = {}) {
  const number = (input) => Number.isFinite(Number(input)) ? Number(input) : 0;
  return {
    itemCount: number(value.itemCount), assetCount: number(value.assetCount),
    availableUnits: number(value.availableUnits), issuedUnits: number(value.issuedUnits),
    lowStockCount: number(value.lowStockCount), unsafeAssetCount: number(value.unsafeAssetCount),
    openRequestCount: number(value.openRequestCount), overdueLoanCount: number(value.overdueLoanCount),
    recentMovements: Array.isArray(value.recentMovements) ? value.recentMovements : [],
    actionItems: Array.isArray(value.actionItems) ? value.actionItems : []
  };
}

export function getStoragePermissionKeys(effectiveAccess) {
  return (effectiveAccess?.permissions ?? []).map((item) => item.key ?? item.permissionKey ?? item.permission_id).filter(Boolean);
}
