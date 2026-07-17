import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authClient } from "./auth-client";

export type AppRole = "paciente" | "medico" | "recepcionista" | "admin";

type SessionData = NonNullable<Awaited<ReturnType<typeof authClient.getSession>>["data"]>;
export type AuthUser = SessionData["user"];
export type AuthSession = SessionData["session"];

interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSession = async () => {
    try {
      const { data } = await authClient.getSession();
      if (data) {
        setUser(data.user);
        setSession(data.session);
        setRoles([data.user.role as AppRole]);
      } else {
        setUser(null);
        setSession(null);
        setRoles([]);
      }
    } catch (error) {
      console.error("[Auth] Failed to load session:", error);
      setUser(null);
      setSession(null);
      setRoles([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSession();
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    roles,
    loading,
    signOut: async () => {
      await authClient.signOut();
      setUser(null);
      setSession(null);
      setRoles([]);
    },
    hasRole: (role) => roles.includes(role),
    refreshUser: loadSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
