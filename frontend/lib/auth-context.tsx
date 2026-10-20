"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, type UserOut } from "./api-client";

interface AuthContextValue {
  token: string | null;
  user: UserOut | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = "investiq_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // On first load, restore session from localStorage and verify it's still valid.
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    api
      .me(stored)
      .then((u) => {
        setToken(stored);
        setUser(u);
      })
      .catch(() => {
        // Stored token is expired/invalid — clear it rather than silently failing later.
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const result = await api.login(email, password);
    localStorage.setItem(TOKEN_STORAGE_KEY, result.access_token);
    setToken(result.access_token);
    setUser(result.user);
    router.push("/dashboard");
  }

  async function signup(email: string, password: string, displayName?: string) {
    const result = await api.signup(email, password, displayName);
    localStorage.setItem(TOKEN_STORAGE_KEY, result.access_token);
    setToken(result.access_token);
    setUser(result.user);
    router.push("/dashboard");
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    router.push("/sign-in");
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
