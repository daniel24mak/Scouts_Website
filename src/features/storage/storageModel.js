export const STORAGE_NAVIGATION = Object.freeze([
  { key: "overview", label: "Overview", permission: "storage.workspace.access" },
  { key: "inventory", label: "Inventory", permission: "storage.inventory.view" },
  { key: "assets", label: "Assets", permission: "storage.inventory.view" },
  { key: "kits", label: "Kits", permission: "storage.inventory.view" },
  { key: "requests", label: "Requests", permission: "storage.requests.view" },
  { key: "loans", label: "Loans & Returns", permission: "storage.loans.view" },
  { key: "locations", label: "Locations", permission: "storage.inventory.view" },
  { key: "movements", label: "Stock Movements", permission: "storage.inventory.view" },
  { key: "restocking", label: "Restocking", permission: "storage.restocking.view" },
  { key: "suppliers", label: "Suppliers & Deliveries", permission: "storage.suppliers.view" },
  { key: "maintenance", label: "Maintenance", permission: "storage.maintenance.view" },
  { key: "audits", label: "Stock Audits", permission: "storage.audits.view" },
  { key: "reports", label: "Reports", permission: "storage.reports.view" },
  { key: "settings", label: "Storage Settings", permission: "storage.settings.manage" }
]);

export function getVisibleStorageNavigation(permissionKeys = []) {
  const permissions = new Set(permissionKeys);
  return STORAGE_NAVIGATION.filter((item) => item.key === "overview" || permissions.has(item.permission));
}

export function normalizeStorageOverview(value = {}) {
  const number = (input) => Number.isFinite(Number(input)) ? Number(input) : 0;
  return {
    itemCount: number(value.itemCount), assetCount: number(value.assetCount),
    lowStockCount: number(value.lowStockCount), unsafeAssetCount: number(value.unsafeAssetCount),
    openRequestCount: number(value.openRequestCount), overdueLoanCount: number(value.overdueLoanCount),
    recentMovements: Array.isArray(value.recentMovements) ? value.recentMovements : [],
    actionItems: Array.isArray(value.actionItems) ? value.actionItems : []
  };
}

export function getStoragePermissionKeys(effectiveAccess) {
  return (effectiveAccess?.permissions ?? []).map((item) => item.key ?? item.permissionKey ?? item.permission_id).filter(Boolean);
}
