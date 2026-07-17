import assert from "node:assert/strict";
import test from "node:test";
import {
  STORAGE_NAVIGATION,
  STORAGE_SECTION_TABS,
  getVisibleStorageNavigation,
  normalizeStorageOverview
} from "../../src/features/storage/storageModel.js";

test("storage navigation is grouped around user workflows and permission filtered", () => {
  assert.deepEqual(STORAGE_NAVIGATION.map((item) => item.key), [
    "overview", "aiAssistant", "inventory", "requests", "loans", "locations-movements",
    "procurement", "maintenance", "audits", "reports", "settings"
  ]);
  assert.deepEqual(getVisibleStorageNavigation(["storage.inventory.view"]).map((item) => item.key), ["overview", "aiAssistant", "inventory", "locations-movements"]);
  assert.deepEqual(STORAGE_SECTION_TABS.inventory.map((tab) => tab.key), ["items", "assets", "kits", "categories"]);
  assert.deepEqual(STORAGE_SECTION_TABS["locations-movements"].map((tab) => tab.key), ["locations", "movements"]);
  assert.deepEqual(STORAGE_SECTION_TABS.procurement.map((tab) => tab.key), ["restocking", "suppliers", "deliveries"]);
});

test("storage overview normalizes numeric values and missing collections", () => {
  assert.deepEqual(normalizeStorageOverview({ itemCount: "12", lowStockCount: "3" }), {
    itemCount: 12,
    assetCount: 0,
    availableUnits: 0,
    issuedUnits: 0,
    lowStockCount: 3,
    unsafeAssetCount: 0,
    openRequestCount: 0,
    overdueLoanCount: 0,
    recentMovements: [],
    actionItems: []
  });
});
