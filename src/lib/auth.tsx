import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ROLE_PERMISSIONS, type Permission, type User } from "./types";
import {
  ensureSeed,
  getSessionUserId,
  getUsers,
  logAudit,
  setSessionUserId,
  subscribe,
} from "./store";

interface AuthValue {
  user: User | null;
  ready: boolean;
  login: (identifier: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  can: (p: Permission) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function permissionsOf(user: User): Permission[] {
  return Array.from(new Set([...ROLE_PERMISSIONS[user.role], ...(user.extraPermissions ?? [])]));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const sync = useCallback(() => {
    const id = getSessionUserId();
    const found = id ? (getUsers().find((u) => u.id === id) ?? null) : null;
    setUser(found && found.active ? found : null);
  }, []);

  useEffect(() => {
    ensureSeed();
    sync();
    setReady(true);
    return subscribe(sync);
  }, [sync]);

  const login: AuthValue["login"] = useCallback((identifier, password) => {
    const id = identifier.trim().toLowerCase();
    const found = getUsers().find(
      (u) => u.username.toLowerCase() === id || (u.email ?? "").toLowerCase() === id,
    );
    if (!found || found.password !== password) {
      return { ok: false, error: "بيانات الدخول غير صحيحة" };
    }
    if (!found.active) return { ok: false, error: "الحساب موقوف، راجع مدير النظام" };
    setSessionUserId(found.id);
    logAudit(found, "تسجيل دخول", found.username);
    setUser(found);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    if (user) logAudit(user, "تسجيل خروج", user.username);
    setSessionUserId(null);
    setUser(null);
  }, [user]);

  const can = useCallback((p: Permission) => (user ? permissionsOf(user).includes(p) : false), [user]);

  const value = useMemo(() => ({ user, ready, login, logout, can }), [user, ready, login, logout, can]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
