import { normalizeProfile } from "./supabaseMappers.js";
import {
  getSupabaseRows,
  insertSupabaseRow,
  isSupabaseConfigured,
  patchSupabaseRows
} from "./supabaseClient.js";

const profileSelect = "select=id,full_name,email,role,chief_level,group_id,account_status,created_at,updated_at,last_login,can_publish,can_create_group_meetings,can_edit_scouts";
const legacyProfileSelect = "select=id,display_name,username,role_id,group_id,account_status,created_at,updated_at,last_login";

export async function getProfiles() {
  const rows = await getSupabaseRows(
    "user_profiles",
    `${profileSelect}&order=role.asc,full_name.asc`
  ).catch(() => getSupabaseRows("profiles", `${legacyProfileSelect}&order=role_id.asc,display_name.asc`));
  return rows.map(normalizeProfile);
}

export async function getProfileById(userId) {
  const rows = await getSupabaseRows(
    "user_profiles",
    `${profileSelect}&id=eq.${encodeURIComponent(userId)}&limit=1`
  ).catch(() =>
    getSupabaseRows("profiles", `${legacyProfileSelect}&id=eq.${encodeURIComponent(userId)}&limit=1`)
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
