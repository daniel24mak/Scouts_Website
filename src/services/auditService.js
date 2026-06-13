import { getCurrentSupabaseUserId, insertSupabaseRow, isSupabaseConfigured } from "./supabaseClient.js";

export async function logAuditEvent(action, entityType, entityId, metadata = {}) {
  if (!isSupabaseConfigured) {
    return null;
  }

  return insertSupabaseRow("audit_logs", {
    actor_id: getCurrentSupabaseUserId(),
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata
  }).catch(() => null);
}
