import { getCurrentSupabaseUserId, getSupabaseRows, patchSupabaseRows } from "./supabaseClient.js";

function normalizeNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.notification_type ?? "general",
    title: row.title ?? "Notification",
    message: row.message ?? "",
    entityType: row.entity_type ?? null,
    entityId: row.entity_id ?? null,
    targetSection: row.target_section ?? "overview",
    isRead: Boolean(row.is_read),
    readAt: row.read_at ?? null,
    createdAt: row.created_at ?? null
  };
}

export async function getNotifications() {
  const userId = getCurrentSupabaseUserId();
  if (!userId) return [];
  const rows = await getSupabaseRows("notifications", `select=*&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`);
  return rows.map(normalizeNotification);
}

export async function markNotificationRead(notificationId) {
  const rows = await patchSupabaseRows("notifications", `id=eq.${encodeURIComponent(notificationId)}`, { is_read: true, read_at: new Date().toISOString() });
  return rows.map(normalizeNotification);
}

export async function markAllNotificationsRead() {
  const userId = getCurrentSupabaseUserId();
  if (!userId) return [];
  const rows = await patchSupabaseRows("notifications", `user_id=eq.${encodeURIComponent(userId)}&is_read=eq.false`, { is_read: true, read_at: new Date().toISOString() });
  return rows.map(normalizeNotification);
}