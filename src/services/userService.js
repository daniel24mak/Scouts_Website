import { normalizeProfile } from "./supabaseMappers.js";
import {
  getSupabaseRows,
  invokeSupabaseFunction,
  insertSupabaseRow,
  isSupabaseConfigured,
  patchSupabaseRows,
  uploadSupabaseFile
} from "./supabaseClient.js";
import { IMAGE_CACHE_CONTROL, optimizedImagePath, optimizeImageForUpload } from "./imageOptimizationService.js";

const profileSelect = "select=id,full_name,email,role,chief_level,group_id,is_coordinator,coordinator_group_ids,account_status,profile_picture_url,pending_name,pending_profile_picture_url,profile_change_status,profile_change_comment,profile_change_submitted_at,must_change_password,created_at,updated_at,last_login,can_publish,can_create_group_meetings,can_edit_scouts,manage_form_templates,view_all_forms,post_forms";
const legacyProfileSelect = "select=id,display_name,username,role_id,group_id,account_status,created_at,updated_at,last_login";
const maxProfilePictureSize = 8 * 1024 * 1024;

function getAssignedGroupIds(profile) {
  return Array.from(new Set([
    ...(Array.isArray(profile.assignedGroupIds) ? profile.assignedGroupIds : []),
    profile.groupId,
    ...(Array.isArray(profile.coordinatorGroupIds) ? profile.coordinatorGroupIds : [])
  ].filter(Boolean)));
}

function getPrimaryGroupId(profile) {
  return getAssignedGroupIds(profile)[0] ?? null;
}
function isMissingProfileColumns(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("profile_picture_url") || message.includes("pending_name") || message.includes("profile_change") || message.includes("must_change_password") || message.includes("is_coordinator") || message.includes("coordinator_group_ids") || message.includes("manage_form_templates") || message.includes("view_all_forms") || message.includes("post_forms") || message.includes("pgrst204") || message.includes("42703");
}

function stripProfilePictureFields(row) {
  const {
    profile_picture_url,
    pending_name,
    pending_profile_picture_url,
    profile_change_status,
    profile_change_comment,
    profile_change_submitted_at,
    is_coordinator,
    coordinator_group_ids,
    manage_form_templates,
    view_all_forms,
    post_forms,
    ...rest
  } = row;
  return rest;
}

export async function uploadProfilePicture(file, userId = "new") {
  if (!(file instanceof File)) {
    return null;
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("Please upload an image file for the profile picture.");
  }

  if (file.size > maxProfilePictureSize) {
    throw new Error("Profile picture must be 8 MB or smaller.");
  }

  const optimized = await optimizeImageForUpload(file, "profile_picture");
  const path = optimizedImagePath(`profile-pictures/optimized/${userId || "new"}`, file);
  return uploadSupabaseFile(path, optimized.file, "profile-pictures", { cacheControl: IMAGE_CACHE_CONTROL, upsert: true });
}

export async function getProfiles() {
  const rows = await getSupabaseRows(
    "user_profiles",
    `${profileSelect}&order=role.asc,full_name.asc`
  ).catch((error) => {
    if (isMissingProfileColumns(error)) {
      return getSupabaseRows("user_profiles", `${profileSelect.replace(/,profile_picture_url.*?,created_at/, ",created_at")}&order=role.asc,full_name.asc`);
    }
    return getSupabaseRows("profiles", `${legacyProfileSelect}&order=role_id.asc,display_name.asc`);
  });
  return rows.map(normalizeProfile);
}

export async function getProfileById(userId) {
  const rows = await getSupabaseRows(
    "user_profiles",
    `${profileSelect}&id=eq.${encodeURIComponent(userId)}&limit=1`
  ).catch((error) => {
    if (isMissingProfileColumns(error)) {
      return getSupabaseRows("user_profiles", `${profileSelect.replace(/,profile_picture_url.*?,created_at/, ",created_at")}&id=eq.${encodeURIComponent(userId)}&limit=1`);
    }
    return getSupabaseRows("profiles", `${legacyProfileSelect}&id=eq.${encodeURIComponent(userId)}&limit=1`);
  });

  return rows[0] ? normalizeProfile(rows[0]) : null;
}

export async function createProfile(profile) {
  if (!profile.id) {
    throw new Error("Missing Supabase Auth user ID for profile creation.");
  }

  const profilePictureUrl = profile.profilePictureFile instanceof File
    ? await uploadProfilePicture(profile.profilePictureFile, profile.id)
    : profile.profilePictureUrl || null;

  const row = {
    id: profile.id,
    full_name: profile.name,
    email: profile.email,
    role: profile.role ?? "chief",
    chief_level: profile.role === "admin" && !getAssignedGroupIds(profile).length ? null : profile.chiefLevel ?? "chief",
    group_id: getPrimaryGroupId(profile),
    is_coordinator: getAssignedGroupIds(profile).length > 1,
    coordinator_group_ids: getAssignedGroupIds(profile),
    account_status: profile.accountStatus ?? "active",
    profile_picture_url: profilePictureUrl,
    can_publish: Boolean(profile.canPublish),
    can_create_group_meetings: Boolean(profile.canCreateGroupMeetings),
    can_edit_scouts: Boolean(profile.canEditScouts),
    manage_form_templates: Boolean(profile.manageFormTemplates),
    view_all_forms: Boolean(profile.viewAllForms),
    post_forms: Boolean(profile.postForms)
  };

  return insertSupabaseRow("user_profiles", row).catch((error) => {
    if (!isMissingProfileColumns(error)) throw error;
    return insertSupabaseRow("user_profiles", stripProfilePictureFields(row));
  });
}

export async function updateProfile(userId, profile) {
  const profilePictureUrl = profile.profilePictureFile instanceof File
    ? await uploadProfilePicture(profile.profilePictureFile, userId)
    : profile.profilePictureUrl ?? null;

  const row = {
    full_name: profile.name,
    email: profile.email,
    role: profile.role ?? "chief",
    chief_level: profile.role === "admin" && !getAssignedGroupIds(profile).length ? null : profile.chiefLevel ?? "chief",
    group_id: getPrimaryGroupId(profile),
    is_coordinator: getAssignedGroupIds(profile).length > 1,
    coordinator_group_ids: getAssignedGroupIds(profile),
    account_status: profile.accountStatus ?? "active",
    profile_picture_url: profilePictureUrl,
    can_publish: Boolean(profile.canPublish),
    can_create_group_meetings: Boolean(profile.canCreateGroupMeetings),
    can_edit_scouts: Boolean(profile.canEditScouts),
    manage_form_templates: Boolean(profile.manageFormTemplates),
    view_all_forms: Boolean(profile.viewAllForms),
    post_forms: Boolean(profile.postForms),
    updated_at: new Date().toISOString()
  };

  return patchSupabaseRows("user_profiles", `id=eq.${encodeURIComponent(userId)}`, row).catch((error) => {
    if (!isMissingProfileColumns(error)) throw error;
    return patchSupabaseRows("user_profiles", `id=eq.${encodeURIComponent(userId)}`, stripProfilePictureFields(row));
  });
}

export async function createDashboardUser(profile) {
  if (!profile?.temporaryPassword) {
    throw new Error("Enter a temporary password for the new user.");
  }

  const profilePictureUrl = profile.profilePictureFile instanceof File
    ? await uploadProfilePicture(profile.profilePictureFile, `pending-${Date.now()}`)
    : profile.profilePictureUrl || null;

  return invokeSupabaseFunction("create-dashboard-user", {
    full_name: profile.name,
    email: profile.email,
    temporary_password: profile.temporaryPassword,
    role: profile.role ?? "chief",
    group_id: getPrimaryGroupId(profile),
    is_coordinator: getAssignedGroupIds(profile).length > 1,
    coordinator_group_ids: getAssignedGroupIds(profile),
    chief_level: profile.role === "admin" && !getAssignedGroupIds(profile).length ? null : profile.chiefLevel ?? "chief",
    account_status: profile.accountStatus ?? "active",
    profile_picture_url: profilePictureUrl,
    permissions: {
      can_publish: Boolean(profile.canPublish),
      can_create_group_meetings: Boolean(profile.canCreateGroupMeetings),
      can_edit_scouts: Boolean(profile.canEditScouts),
      manage_form_templates: Boolean(profile.manageFormTemplates),
      view_all_forms: Boolean(profile.viewAllForms),
      post_forms: Boolean(profile.postForms)
    }
  });
}

export function deleteDashboardUser(userId) {
  return invokeSupabaseFunction("delete-dashboard-user", {
    user_id: userId
  });
}

export function adminResetUserPassword(userId, temporaryPassword) {
  return invokeSupabaseFunction("admin-reset-user-password", {
    user_id: userId,
    temporary_password: temporaryPassword
  });
}

export async function submitProfileChangeRequest(user, { name, profilePictureFile }) {
  if (!user?.id) {
    throw new Error("You must be logged in to update your profile.");
  }

  const pendingProfilePictureUrl = profilePictureFile instanceof File
    ? await uploadProfilePicture(profilePictureFile, user.id)
    : undefined;

  const row = {
    pending_name: name?.trim() && name.trim() !== user.name ? name.trim() : null,
    pending_profile_picture_url: pendingProfilePictureUrl ?? null,
    profile_change_status: "pending",
    profile_change_comment: "",
    profile_change_submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (!row.pending_name && !row.pending_profile_picture_url) {
    throw new Error("Change your name or choose a new profile picture before submitting.");
  }

  return patchSupabaseRows("user_profiles", `id=eq.${encodeURIComponent(user.id)}`, row);
}

export async function reviewProfileChangeRequest(profile, status, comment = "") {
  if (!profile?.id) {
    throw new Error("Missing profile request.");
  }

  const approved = status === "approved";
  return patchSupabaseRows("user_profiles", `id=eq.${encodeURIComponent(profile.id)}`, {
    full_name: approved && profile.pendingName ? profile.pendingName : profile.name,
    profile_picture_url: approved && profile.pendingProfilePictureUrl ? profile.pendingProfilePictureUrl : profile.profilePictureUrl ?? null,
    pending_name: null,
    pending_profile_picture_url: null,
    profile_change_status: approved ? "approved" : "rejected",
    profile_change_comment: comment,
    updated_at: new Date().toISOString()
  });
}



