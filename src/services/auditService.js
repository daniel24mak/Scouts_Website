import { getCurrentSupabaseUserId, getSupabaseRows, insertSupabaseRow, isSupabaseConfigured } from "./supabaseClient.js";

function normalizeWorkspaceAuditLog(row = {}) {
  return {
    id: row.id,
    actorId: row.actor_id ?? null,
    action: row.action ?? "workspace.activity",
    module: row.module ?? row.metadata?.module ?? null,
    resourceType: row.resource_type ?? row.entity_type ?? "record",
    resourceId: row.resource_id ?? row.entity_id ?? null,
    outcome: row.outcome ?? "success",
    reason: row.reason ?? null,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: row.created_at ?? null
  };
}

export async function getWorkspaceAuditLogs(workspaceKey, limit = 250) {
  if (!["finance", "storage"].includes(workspaceKey)) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 250, 1), 500);
  const query = `select=*&module=eq.${encodeURIComponent(workspaceKey)}&order=created_at.desc&limit=${safeLimit}`;
  const rows = await getSupabaseRows("audit_logs", query);
  return rows.map(normalizeWorkspaceAuditLog);
}

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
