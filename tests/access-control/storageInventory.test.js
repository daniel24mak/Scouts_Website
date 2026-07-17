import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../../database/supabase-storage-core.sql", import.meta.url), "utf8");

test("storage core models items, assets, kits, locations, and movements separately", () => {
  for (const table of [
    "storage_categories", "storage_locations", "storage_inventory_items", "storage_assets",
    "storage_kits", "storage_kit_components", "storage_stock_movements"
  ]) assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`, "i"));
  assert.match(sql, /item_kind[\s\S]*'consumable'[\s\S]*'bulk'[\s\S]*'asset'/i);
});

test("availability is movement derived rather than directly editable", () => {
  assert.match(sql, /VIEW public\.storage_location_balances/i);
  assert.match(sql, /SUM\(CASE[\s\S]*movement_type/i);
  assert.doesNotMatch(sql, /storage_inventory_items[\s\S]{0,1400}current_quantity/i);
  assert.match(sql, /FUNCTION public\.record_storage_movement\(/i);
});

test("movement RPC checks permissions, locks records, and prevents unavailable stock", () => {
  const start = sql.search(/FUNCTION public\.record_storage_movement\(/i);
  assert.ok(start >= 0);
  const body = sql.slice(start, start + 12000);
  assert.match(body, /SECURITY DEFINER/i);
  assert.match(body, /has_permission\('storage\.movements\.create'\)/i);
  assert.match(body, /FOR UPDATE/i);
  assert.match(body, /Insufficient available stock/i);
  assert.match(body, /safety_status[\s\S]*blocked/i);
  assert.match(body, /storage\.movement\.recorded/i);
});

test("asset identifiers remain globally unique after retirement", () => {
  assert.match(sql, /asset_tag text NOT NULL UNIQUE/i);
  assert.match(sql, /serial_number text UNIQUE/i);
  assert.match(sql, /identifier_value text NOT NULL UNIQUE/i);
  assert.match(sql, /status[\s\S]*'retired'/i);
});

test("storage reads are permission scoped and direct mutation is not granted", () => {
  assert.match(sql, /ALTER TABLE public\.storage_stock_movements ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /has_permission\('storage\.inventory\.view'\)/i);
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*public\.storage_stock_movements[\s\S]*FROM anon/i);
  assert.doesNotMatch(sql, /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\s+ON\s+(?:TABLE\s+)?public\.storage_stock_movements\s+TO authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.record_storage_movement/i);
});
