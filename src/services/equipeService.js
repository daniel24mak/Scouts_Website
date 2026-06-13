import { logAuditEvent } from "./auditService.js";
import { normalizeEquipe } from "./supabaseMappers.js";
import {
  deleteSupabaseRows,
  getCurrentSupabaseUserId,
  getSupabaseRows,
  insertSupabaseRow,
  patchSupabaseRows,
  upsertSupabaseRows
} from "./supabaseClient.js";

export async function getEquipeData() {
  const [equipes, leaders] = await Promise.all([
    getSupabaseRows("equipes", "select=*&order=name.asc").catch(() => []),
    getSupabaseRows("equipe_leaders", "select=*&is_active=eq.true").catch(() => [])
  ]);

  return {
    equipes: equipes.map((equipe) => normalizeEquipe(equipe, leaders))
  };
}

export async function createEquipe(payload) {
  const currentUserId = getCurrentSupabaseUserId();
  const [created] = await insertSupabaseRow("equipes", {
    group_id: payload.groupId,
    name: payload.name,
    description: payload.description || null,
    created_by: currentUserId
  });

  await logAuditEvent("equipe_created", "Equipe", created?.id, {
    groupId: payload.groupId,
    name: payload.name
  });

  return created;
}

export async function updateEquipe(equipeId, payload) {
  const [updated] = await patchSupabaseRows("equipes", `id=eq.${encodeURIComponent(equipeId)}`, {
    name: payload.name,
    description: payload.description || null,
    updated_at: new Date().toISOString()
  });

  await saveEquipeLeadership(equipeId, payload);
  await logAuditEvent("equipe_updated", "Equipe", equipeId, { name: payload.name });

  return updated;
}

export async function archiveEquipe(equipeId) {
  const [updated] = await patchSupabaseRows("equipes", `id=eq.${encodeURIComponent(equipeId)}`, {
    is_active: false,
    archived_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  await patchSupabaseRows("scouts", `equipe_id=eq.${encodeURIComponent(equipeId)}`, {
    equipe_id: null
  });
  await logAuditEvent("equipe_archived", "Equipe", equipeId);

  return updated;
}

export async function assignScoutsToEquipe({ scoutIds, equipeId, groupId }) {
  const currentUserId = getCurrentSupabaseUserId();
  const uniqueScoutIds = [...new Set(scoutIds ?? [])].filter(Boolean);

  for (const scoutId of uniqueScoutIds) {
    await patchSupabaseRows("scouts", `id=eq.${encodeURIComponent(scoutId)}`, {
      equipe_id: equipeId || null,
      group_id: groupId
    });

    await insertSupabaseRow("scout_equipe_assignments", {
      scout_id: scoutId,
      equipe_id: equipeId || null,
      group_id: groupId,
      assigned_by: currentUserId,
      removed_at: equipeId ? null : new Date().toISOString(),
      is_active: Boolean(equipeId)
    }).catch(() => null);
  }

  await logAuditEvent(equipeId ? "scouts_assigned_to_equipe" : "scouts_removed_from_equipe", "Equipe", equipeId ?? groupId, {
    groupId,
    scoutIds: uniqueScoutIds
  });

  return { ok: true, count: uniqueScoutIds.length };
}

export async function saveEquipeLeadership(equipeId, payload) {
  const currentUserId = getCurrentSupabaseUserId();
  const rows = [
    ["leader", payload.leaderId],
    ["co_leader", payload.coLeaderId]
  ];

  for (const [role, chiefId] of rows) {
    await deleteSupabaseRows("equipe_leaders", `equipe_id=eq.${encodeURIComponent(equipeId)}&role=eq.${role}`);

    if (chiefId) {
      await upsertSupabaseRows(
        "equipe_leaders",
        [{
          equipe_id: equipeId,
          chief_id: chiefId,
          role,
          assigned_by: currentUserId,
          is_active: true
        }],
        "equipe_id,role"
      );
    }
  }

  await logAuditEvent("equipe_leadership_updated", "Equipe", equipeId, {
    leaderId: payload.leaderId,
    coLeaderId: payload.coLeaderId
  });
}
