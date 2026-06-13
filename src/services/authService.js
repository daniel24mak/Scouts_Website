import {
  callSupabaseAuth,
  clearSupabaseSession,
  getStoredSupabaseSession,
  isSupabaseConfigured,
  storeSupabaseSession
} from "./supabaseClient.js";
import { getProfileById } from "./userService.js";

function authUserToProfile(authUser, profile) {
  if (!authUser) {
    return null;
  }

  return {
    id: authUser.id,
    name:
      profile?.name ??
      authUser.user_metadata?.full_name ??
      authUser.email?.split("@")[0] ??
      "Internal user",
    email: profile?.email ?? authUser.email ?? "",
    role: profile?.role ?? authUser.user_metadata?.role ?? "chief",
    groupId: profile?.groupId ?? authUser.user_metadata?.group_id ?? null,
    chiefLevel: profile?.chiefLevel ?? authUser.user_metadata?.chief_level ?? "chief",
    accountStatus: profile?.accountStatus ?? "active",
    permissions: profile?.permissions ?? {
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
    const profile = await getProfileById(authUser.id).catch(() => null);
    return authUserToProfile(authUser, profile);
  } catch {
    clearSupabaseSession();
    return null;
  }
}

export async function signInWithPassword(email, password) {
  const response = await callSupabaseAuth("token?grant_type=password", { email, password });
  storeSupabaseSession(response);
  const profile = await getProfileById(response.user.id).catch(() => null);
  return authUserToProfile(response.user, profile);
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
