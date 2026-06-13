import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fallbackData, getBootstrap } from "../api/client.js";
import { getCurrentAuthUser, signInWithPassword, signOut } from "../services/authService.js";
import { isSupabaseConfigured } from "../services/supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState(fallbackData.users);
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured);

  const refreshUsers = useCallback(async () => {
    const data = await getBootstrap();
    setUsers(data.users);
    return data.users;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthState() {
      const [nextUsers, currentUser] = await Promise.all([
        refreshUsers(),
        getCurrentAuthUser().catch(() => null)
      ]);

      if (cancelled) {
        return;
      }

      setUser(currentUser);
      setUsers(nextUsers);
      setIsAuthLoading(false);
    }

    loadAuthState();

    return () => {
      cancelled = true;
    };
  }, [refreshUsers]);

  const loginWithPassword = useCallback(async (email, password) => {
    const nextUser = await signInWithPassword(email, password);
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
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
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
