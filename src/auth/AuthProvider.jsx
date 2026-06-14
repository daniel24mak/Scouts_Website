import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { demoUsers } from "../data/users.js";
import { getCurrentAuthUser, signInWithPassword, signOut } from "../services/authService.js";
import { isSupabaseConfigured } from "../services/supabaseClient.js";
import { getProfileById } from "../services/userService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState(demoUsers);
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured);

  const refreshUsers = useCallback(async (knownUser = null) => {
    if (!isSupabaseConfigured) {
      setUsers(demoUsers);
      return demoUsers;
    }

    const currentUser = knownUser ?? (await getCurrentAuthUser().catch(() => null));
    const currentProfile = currentUser ? await getProfileById(currentUser.id).catch(() => null) : null;
    const nextUsers = currentProfile ? [currentProfile] : [];
    setUsers(nextUsers);
    return nextUsers;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthState() {
      const currentUser = await getCurrentAuthUser().catch(() => null);

      if (cancelled) {
        return;
      }

      setUser(currentUser);

      if (currentUser || !isSupabaseConfigured) {
        const nextUsers = await refreshUsers(currentUser);
        if (!cancelled) {
          setUsers(nextUsers);
        }
      }

      if (!cancelled) {
        setIsAuthLoading(false);
      }
    }

    loadAuthState();

    return () => {
      cancelled = true;
    };
  }, [refreshUsers]);

  const loginWithPassword = useCallback(async (email, password) => {
    const nextUser = await signInWithPassword(email, password);
    setUser(nextUser);
    await refreshUsers(nextUser);
    return nextUser;
  }, [refreshUsers]);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    if (isSupabaseConfigured) {
      setUsers([]);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      users,
      isAuthLoading,
      loginWithPassword,
      login: (userId) =>
        setUser(
          users.find(
            (demoUser) => demoUser.id === userId && (demoUser.accountStatus ?? "active") === "active"
          ) ?? null
        ),
      logout,
      refreshUsers
    }),
    [isAuthLoading, loginWithPassword, logout, refreshUsers, user, users]
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

