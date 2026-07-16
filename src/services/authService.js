import {
  callSupabaseAuth,
  clearSupabaseSession,
  getStoredSupabaseSession,
  isSupabaseConfigured,
  storeSupabaseSession
} from "./supabaseClient.js";
import { normalizeTotpEnrollment } from "../utils/mfaQr.js";
import { getProfileById } from "./userService.js";

const authCallbackStorageKey = "scouts-supabase-auth-callback";
let invitationCallbackPromise = null;

function requireAuthSession() {
  const session = getStoredSupabaseSession();
  if (!session?.access_token) {
    throw new Error("You must be logged in to manage multi-factor authentication.");
  }
  return session;
}

function readJwtPayload(accessToken) {
  try {
    const encoded = accessToken?.split(".")[1];
    if (!encoded) return {};
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(window.atob(padded));
  } catch {
    return {};
  }
}

function normalizeMfaFactors(response) {
  const factors = Array.isArray(response)
    ? response
    : response?.all ?? response?.totp ?? response?.factors ?? [];
  return factors.filter((factor) => factor?.factor_type === "totp" || factor?.type === "totp");
}

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

export async function getMfaStatus() {
  const session = requireAuthSession();
  const authUser = await callSupabaseAuth("user", null, {
    method: "GET",
    accessToken: session.access_token
  });
  const factors = normalizeMfaFactors(authUser.factors ?? []);
  const claims = readJwtPayload(session.access_token);

  return {
    currentLevel: claims.aal ?? "aal1",
    factors,
    verifiedFactors: factors.filter((factor) => factor.status === "verified")
  };
}

export async function enrollTotpMfa() {
  const session = requireAuthSession();
  const response = await callSupabaseAuth("factors", {
    factor_type: "totp",
    friendly_name: "St. Mary's Scouts Dashboard"
  }, {
    accessToken: session.access_token
  });
  const enrollment = normalizeTotpEnrollment(response);
  if (!enrollment.id || (!enrollment.totp.qr_code && !enrollment.totp.secret)) {
    throw new Error("Supabase did not return an authenticator QR code or manual secret.");
  }
  return enrollment;
}

export async function challengeAndVerifyMfa(factorId, code) {
  const session = requireAuthSession();
  const cleanCode = String(code ?? "").replace(/\s/g, "");
  if (!factorId) throw new Error("Choose an authenticator factor first.");
  if (!/^\d{6}$/.test(cleanCode)) throw new Error("Enter the 6-digit code from your authenticator app.");

  const challenge = await callSupabaseAuth(`factors/${factorId}/challenge`, {}, {
    accessToken: session.access_token
  });
  const verified = await callSupabaseAuth(`factors/${factorId}/verify`, {
    challenge_id: challenge.id,
    code: cleanCode
  }, {
    accessToken: session.access_token
  });
  const upgradedSession = {
    ...session,
    ...verified,
    user: verified?.user ?? session.user
  };
  storeSupabaseSession(upgradedSession);
  return upgradedSession;
}

export async function removeMfaFactor(factorId) {
  const session = requireAuthSession();
  await callSupabaseAuth(`factors/${factorId}`, null, {
    method: "DELETE",
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


