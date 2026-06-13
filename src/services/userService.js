import { normalizeProfile } from "./supabaseMappers.js";
import {
  getSupabaseRows,
  insertSupabaseRow,
  isSupabaseConfigured,
  patchSupabaseRows
} from "./supabaseClient.js";

export async function getProfiles() {
  const rows = await getSupabaseRows(
    "user_profiles",
    "select=*&order=role.asc,full_name.asc"
  ).catch(() => getSupabaseRows("profiles", "select=*&order=role_id.asc,display_name.asc"));
  return rows.map(normalizeProfile);
}

export async function getProfileById(userId) {
  const rows = await getSupabaseRows(
    "user_profiles",
    `select=*&id=eq.${encodeURIComponent(userId)}&limit=1`
  ).catch(() =>
    getSupabaseRows("profiles", `select=*&id=eq.${encodeURIComponent(userId)}&limit=1`)
  );

  return rows[0] ? normalizeProfile(rows[0]) : null;
}

export function createProfile(profile) {
  if (!profile.id) {
    throw new Error("Missing Supabase Auth user ID for profile creation.");
  }

  return insertSupabaseRow("user_profiles", {
    id: profile.id,
    full_name: profile.name,
    email: profile.email,
    role: profile.role ?? "chief",
    chief_level: profile.chiefLevel ?? "chief",
    group_id: profile.groupId || null,
    account_status: profile.accountStatus ?? "active",
    can_publish: Boolean(profile.canPublish),
    can_create_group_meetings: Boolean(profile.canCreateGroupMeetings),
    can_edit_scouts: Boolean(profile.canEditScouts)
  });
}

export function updateProfile(userId, profile) {
  return patchSupabaseRows("user_profiles", `id=eq.${encodeURIComponent(userId)}`, {
    full_name: profile.name,
    email: profile.email,
    role: profile.role ?? "chief",
    chief_level: profile.chiefLevel ?? "chief",
    group_id: profile.groupId || null,
    account_status: profile.accountStatus ?? "active",
    can_publish: Boolean(profile.canPublish),
    can_create_group_meetings: Boolean(profile.canCreateGroupMeetings),
    can_edit_scouts: Boolean(profile.canEditScouts),
    updated_at: new Date().toISOString()
  });
}
