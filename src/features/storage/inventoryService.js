import { callSupabaseRpc, getCurrentSupabaseUserId, getSupabaseRows, insertSupabaseRow } from "../../services/supabaseClient.js";
import { normalizeStorageOverview } from "./storageModel.js";

const movementSelect = "select=id,reference_number,item_id,asset_id,movement_type,status,quantity,from_location_id,to_location_id,notes,created_at&order=created_at.desc";

export async function getStorageOverview() {
  const [items, assets, movements] = await Promise.all([
    getSupabaseRows("storage_inventory_summary", "select=id,sku,name,item_kind,unit_name,reorder_level,safety_status,available_quantity,below_reorder_level,is_active&is_active=eq.true&order=name.asc"),
    getSupabaseRows("storage_assets", "select=id,item_id,asset_tag,status,condition,retired_at&retired_at=is.null&order=asset_tag.asc"),
    getSupabaseRows("storage_stock_movements", `${movementSelect}&limit=8`)
  ]);
  return normalizeStorageOverview({ itemCount: items.length, assetCount: assets.length,
    availableUnits: items.reduce((total, item) => total + Number(item.available_quantity || 0), 0),
    issuedUnits: assets.filter((asset) => asset.status === "issued").length,
    lowStockCount: items.filter((item) => item.below_reorder_level).length,
    unsafeAssetCount: assets.filter((asset) => ["damaged", "unsafe"].includes(asset.condition)).length,
    recentMovements: movements });
}

async function getStorageLeafData(section) {
  if (section === "inventory") {
    const [items, summaries] = await Promise.all([
      getSupabaseRows("storage_inventory_items", "select=id,sku,name,description,item_kind,category_id,unit_name,reorder_level,safety_status,is_active&order=name.asc"),
      getSupabaseRows("storage_inventory_summary", "select=id,available_quantity,below_reorder_level")
    ]);
    const summaryById = new Map(summaries.map((summary) => [summary.id, summary]));
    return items.map((item) => ({ ...item, ...(summaryById.get(item.id) ?? {}) }));
  }
  if (section === "assets") return getSupabaseRows("storage_assets", "select=id,item_id,asset_tag,serial_number,status,condition,warranty_expires_on,notes,retired_at&order=asset_tag.asc");
  if (section === "kits") return getSupabaseRows("storage_kits", "select=id,code,name,description,is_active&order=name.asc");
  if (section === "categories") return getSupabaseRows("storage_categories", "select=id,name,description,is_active,parent_id&order=name.asc");
  if (section === "locations") return getSupabaseRows("storage_locations", "select=id,code,name,description,location_type,parent_id,is_restricted,is_active&order=name.asc");
  if (section === "movements") return getSupabaseRows("storage_stock_movements", `${movementSelect}&limit=150`);
  const workflows = {
    requests: ["storage_requests", "select=*&order=updated_at.desc&limit=100"],
    loans: ["storage_loans", "select=*&order=updated_at.desc&limit=100"],
    restocking: ["storage_requests", "select=*&status=in.(approved,partially_reserved)&order=updated_at.desc&limit=100"],
    suppliers: ["storage_suppliers", "select=*&order=updated_at.desc&limit=100"],
    deliveries: ["storage_deliveries", "select=*&order=updated_at.desc&limit=100"],
    maintenance: ["storage_maintenance", "select=*&order=updated_at.desc&limit=100"],
    audits: ["storage_audits", "select=*&order=updated_at.desc&limit=100"]
  };
  if (workflows[section]) return getSupabaseRows(...workflows[section]);
  if (section === "reports") return getSupabaseRows("storage_stock_movements", `${movementSelect}&limit=200`);
  return [];
}

export async function getStorageSectionData(section) {
  if (section === "inventory") {
    const [items, assets, kits, categories] = await Promise.all([getStorageLeafData("inventory"), getStorageLeafData("assets"), getStorageLeafData("kits"), getStorageLeafData("categories")]);
    return { items, assets, kits, categories };
  }
  if (section === "locations-movements") {
    const [locations, movements] = await Promise.all([getStorageLeafData("locations"), getStorageLeafData("movements")]);
    return { locations, movements };
  }
  if (section === "procurement") {
    const [restocking, suppliers, deliveries] = await Promise.all([getStorageLeafData("restocking"), getStorageLeafData("suppliers"), getStorageLeafData("deliveries")]);
    return { restocking, suppliers, deliveries };
  }
  return getStorageLeafData(section);
}

export function createStorageWorkflowRecord(section, form) {
  const userId = getCurrentSupabaseUserId();
  if (!userId) throw new Error("A signed-in Storage user is required.");
  if (section === "requests") return insertSupabaseRow("storage_requests", { title: form.title.trim(), needed_from: `${form.date}T08:00:00+04:00`, requested_by: userId });
  if (section === "maintenance") throw new Error("Select an asset from the Assets section before reporting maintenance.");
  if (section === "audits") return insertSupabaseRow("storage_audits", { title: form.title.trim(), created_by: userId });
  if (section === "suppliers") return insertSupabaseRow("storage_suppliers", { name: form.title.trim(), created_by: userId });
  throw new Error("This record requires its detailed Storage workflow.");
}

export function recordStorageMovement(payload) {
  return callSupabaseRpc("record_storage_movement", {
    target_item_id: payload.itemId, target_asset_id: payload.assetId ?? null,
    requested_movement_type: payload.movementType, requested_quantity: payload.quantity,
    requested_from_location_id: payload.fromLocationId ?? null, requested_to_location_id: payload.toLocationId ?? null,
    requested_condition_after: payload.conditionAfter ?? null,
    requested_source_type: payload.sourceType ?? null, requested_source_id: payload.sourceId ?? null,
    requested_borrower_id: payload.borrowerId ?? null,
    requested_notes: payload.notes ?? "", requested_idempotency_key: payload.idempotencyKey ?? crypto.randomUUID()
  });
}

export function manageStorageRecord(entity, action, id, payload = {}) {
  return callSupabaseRpc("manage_storage_record", {
    target_entity: entity,
    requested_action: action,
    target_id: id,
    payload
  });
}
