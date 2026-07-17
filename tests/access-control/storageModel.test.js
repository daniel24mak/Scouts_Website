import assert from "node:assert/strict";
import test from "node:test";
import {
  STORAGE_NAVIGATION,
  getVisibleStorageNavigation,
  normalizeStorageOverview
} from "../../src/features/storage/storageModel.js";

test("storage navigation is granular and permission filtered", () => {
  assert.deepEqual(STORAGE_NAVIGATION.map((item) => item.key), [
    "overview", "inventory", "assets", "kits", "requests", "loans", "locations",
    "movements", "restocking", "suppliers", "maintenance", "audits", "reports", "settings"
  ]);
  assert.deepEqual(getVisibleStorageNavigation(["storage.inventory.view"]).map((item) => item.key), ["overview", "inventory", "assets", "kits", "locations", "movements"]);
});

test("storage overview normalizes numeric values and missing collections", () => {
  assert.deepEqual(normalizeStorageOverview({ itemCount: "12", lowStockCount: "3" }), {
    itemCount: 12,
    assetCount: 0,
    lowStockCount: 3,
    unsafeAssetCount: 0,
    openRequestCount: 0,
    overdueLoanCount: 0,
    recentMovements: [],
    actionItems: []
  });
});
