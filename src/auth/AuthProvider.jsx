import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { demoUsers } from "../data/users.js";
import { getCurrentAuthUser, signInWithPassword, signOut } from "../services/authService.js";
import { isSupabaseConfigured } from "../services/supabaseClient.js";
import { getProfileById } from "../services/userService.js";

const AuthContext = createContext(null);
const AUTH_DEBUG = true;

function logAuthStep(step, details = {}) {
  if (AUTH_DEBUG) {
    console.debug(`[auth] ${step}`, details);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState(demoUsers);
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured);
  const [isProfileLoading, setIsProfileLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState(null);

  const refreshUsers = useCallback(async (knownUser = null) => {
    logAuthStep("profile fetch start", { knownUserId: knownUser?.id ?? null });

    if (!isSupabaseConfigured) {
      setUsers(demoUsers);
      setIsProfileLoading(false);
      logAuthStep("profile fetch skipped demo mode");
      return demoUsers;
    }

    setIsProfileLoading(true);

    try {
      const currentUser = knownUser ?? (await getCurrentAuthUser().catch((error) => {
        logAuthStep("profile fetch current user failed", { message: error.message });
        return null;
      }));
      const currentProfile = currentUser ? await getProfileById(currentUser.id).catch((error) => {
        logAuthStep("profile fetch failed", { userId: currentUser.id, message: error.message });
        return null;
      }) : null;
      const nextUsers = currentProfile ? [currentProfile] : currentUser ? [currentUser] : [];

      setUsers(nextUsers);
      logAuthStep("profile fetch complete", { userId: currentUser?.id ?? null, hasProfile: Boolean(currentProfile) });
      return nextUsers;
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthState() {
      setAuthError(null);
      logAuthStep("getSession start", { supabaseConfigured: isSupabaseConfigured });

      try {
        const currentUser = await getCurrentAuthUser().catch((error) => {
          logAuthStep("getSession failed", { message: error.message });
          return null;
        });

        if (cancelled) return;

        logAuthStep("getSession complete", { userId: currentUser?.id ?? null, role: currentUser?.role ?? null });
        setUser(currentUser);

        if (currentUser || !isSupabaseConfigured) {
          await refreshUsers(currentUser);
        } else {
          setUsers([]);
          setIsProfileLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[auth] auth bootstrap crashed", error);
          setAuthError(error);
          setUser(null);
          setUsers([]);
          setIsProfileLoading(false);
        }
      } finally {
        if (!cancelled) {
          setIsAuthLoading(false);
          logAuthStep("auth bootstrap finished");
        }
      }
    }

    loadAuthState();

    const handleStorage = (event) => {
      if (event.key === "scouts-supabase-session") {
        logAuthStep("storage auth change detected");
        loadAuthState();
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshUsers]);

  const loginWithPassword = useCallback(async (email, password) => {
    setAuthError(null);
    setIsAuthLoading(true);
    setIsProfileLoading(true);
    logAuthStep("login start", { email });

    try {
      const signedInUser = await signInWithPassword(email, password);
      logAuthStep("login token received", { userId: signedInUser?.id ?? null });

      const confirmedUser = await getCurrentAuthUser().catch((error) => {
        logAuthStep("login session confirmation failed", { message: error.message });
        return null;
      });
      const nextUser = confirmedUser ?? signedInUser;

      setUser(nextUser);
      await refreshUsers(nextUser);
      logAuthStep("login complete", { userId: nextUser?.id ?? null, role: nextUser?.role ?? null });
      return nextUser;
    } catch (error) {
      console.error("[auth] login failed", error);
      setAuthError(error);
      setUser(null);
      throw error;
    } finally {
      setIsAuthLoading(false);
      setIsProfileLoading(false);
    }
  }, [refreshUsers]);

  const login = useCallback((userId) => {
    const nextUser = users.find(
      (demoUser) => demoUser.id === userId && (demoUser.accountStatus ?? "active") === "active"
    ) ?? null;
    logAuthStep("demo login", { userId: nextUser?.id ?? null, role: nextUser?.role ?? null });
    setUser(nextUser);
  }, [users]);

  const logout = useCallback(async () => {
    logAuthStep("logout start", { userId: user?.id ?? null });
    await signOut();
    setUser(null);
    if (isSupabaseConfigured) {
      setUsers([]);
    }
    logAuthStep("logout complete");
  }, [user?.id]);

  const value = useMemo(
    () => ({
      user,
      users,
      isAuthLoading,
      isProfileLoading,
      authError,
      loginWithPassword,
      login,
      logout,
      refreshUsers
    }),
    [authError, isAuthLoading, isProfileLoading, login, loginWithPassword, logout, refreshUsers, user, users]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}