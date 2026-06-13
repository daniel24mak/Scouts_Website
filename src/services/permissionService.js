import { getSupabaseRows } from "./supabaseClient.js";

export function getPermissionDefinitions() {
  return getSupabaseRows("permissions", "select=*&order=id.asc");
}
