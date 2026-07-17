import { callSupabaseRpc } from "./supabaseClient.js";
import { asArray } from "../utils/collections.js";

export async function getScoutingStorageSelfService() {
  const payload = await callSupabaseRpc("get_scouting_storage_self_service");
  return {
    items: asArray(payload?.items),
    requests: asArray(payload?.requests),
    loans: asArray(payload?.loans)
  };
}

export function submitScoutingStorageRequest(request) {
  return callSupabaseRpc("submit_scouting_storage_request", {
    target_item_id: request.itemId,
    requested_quantity: Number(request.quantity),
    request_title: request.title,
    request_purpose: request.purpose,
    requested_from: request.neededFrom ? `${request.neededFrom}T08:00:00+04:00` : null,
    requested_until: request.neededUntil ? `${request.neededUntil}T18:00:00+04:00` : null
  });
}

export async function getScoutingGroupBudgetSummaries() {
  return asArray(await callSupabaseRpc("get_scouting_group_budget_summary"));
}
