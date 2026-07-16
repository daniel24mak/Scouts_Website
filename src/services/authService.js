import {
  callSupabaseAuth,
  clearSupabaseSession,
  getStoredSupabaseSession,
  isSupabaseConfigured,
  storeSupabaseSession
} from "./supabaseClient.js";
import { getProfileById } from "./userService.js";

const authCallbackStorageKey = "scouts-supabase-auth-callback";
let invitationCallbackPromise = null;

function authUserToProfile(authUser, profile) {
  if (!authUser || !profile) {
    return null;
  }

  return {
    id: authUser.id,
    name:
      profile.name ??
      authUser.email?.split("@")[0] ??
      "Internal user",
    email: profile.email ?? authUser.email ?? "",
    role: profile.role,
    groupId: profile.groupId ?? null,
    chiefLevel: profile.chiefLevel ?? null,
    accountStatus: profile.accountStatus ?? "missing",
    profilePictureUrl: profile?.profilePictureUrl ?? null,
    pendingName: profile?.pendingName ?? null,
    pendingProfilePictureUrl: profile?.pendingProfilePictureUrl ?? null,
    profileChangeStatus: profile?.profileChangeStatus ?? null,
    profileChangeComment: profile?.profileChangeComment ?? "",
    permissions: profile.permissions ?? {
      canPublish: false,
      canCreateGroupMeetings: false,
      canEditScouts: false
    }
  };
}

export async function getCurrentAuthUser() {
  if (!isSupabaseConfigured) {
    return null;
  }

  const session = getStoredSupabaseSession();
  if (!session?.access_token) {
    return null;
  }

  try {
    const authUser = await callSupabaseAuth("user", null, {
      method: "GET",
      accessToken: session.access_token
    });
    const profile = await getProfileById(authUser.id);
    const currentUser = authUserToProfile(authUser, profile);
    if (!currentUser || currentUser.accountStatus !== "active") {
      clearSupabaseSession();
      return null;
    }
    return currentUser;
  } catch {
    clearSupabaseSession();
    return null;
  }
}

export async function signInWithPassword(email, password) {
  const response = await callSupabaseAuth("token?grant_type=password", { email, password });
  storeSupabaseSession(response);

  try {
    const profile = await getProfileById(response.user.id);
    const currentUser = authUserToProfile(response.user, profile);
    if (!currentUser || currentUser.accountStatus !== "active") {
      throw new Error("This dashboard account is not active.");
    }
    return currentUser;
  } catch (error) {
    clearSupabaseSession();
    throw error;
  }
}

export async function updateCurrentUserPassword(newPassword) {
  const session = getStoredSupabaseSession();

  if (!session?.access_token) {
    throw new Error("You must be logged in to change your password.");
  }

  await callSupabaseAuth("user", { password: newPassword }, {
    method: "PUT",
    accessToken: session.access_token
  });
}

async function consumeStoredInvitationCallback() {
  const rawCallback = window.sessionStorage.getItem(authCallbackStorageKey);
  window.sessionStorage.removeItem(authCallbackStorageKey);

  if (!rawCallback) {
    throw new Error("This invitation link is missing or has already been used.");
  }

  const params = new URLSearchParams(rawCallback);
  if (params.get("error")) {
    const description = params.get("error_description")?.replaceAll("+", " ");
    throw new Error(description || "This invitation link is invalid or has expired.");
  }

  const accessToken = params.get("access_token");
  if (!accessToken) {
    throw new Error("This invitation link is invalid or has expired.");
  }

  const authUser = await callSupabaseAuth("user", null, {
    method: "GET",
    accessToken
  });
  storeSupabaseSession({
    access_token: accessToken,
    refresh_token: params.get("refresh_token") || null,
    expires_in: Number(params.get("expires_in") || 0),
    expires_at: Number(params.get("expires_at") || 0),
    token_type: params.get("token_type") || "bearer",
    user: authUser
  });

  return { type: params.get("type") || "invite", user: authUser };
}

export function consumeInvitationCallback() {
  if (!invitationCallbackPromise) {
    invitationCallbackPromise = consumeStoredInvitationCallback();
  }
  return invitationCallbackPromise;
}

export async function signOut() {
  const session = getStoredSupabaseSession();

  if (session?.access_token) {
    await callSupabaseAuth("logout", {}, { accessToken: session.access_token }).catch(() => null);
  }

  clearSupabaseSession();
}

export async function signUpInternalUser({ email, password, name, role, groupId, chiefLevel }) {
  const response = await callSupabaseAuth("signup", {
    email,
    password,
    data: {
      full_name: name,
      role,
      group_id: groupId,
      chief_level: chiefLevel
    }
  });

  return response.user;
}


