import { apiClient } from "@/lib/apiClient";

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
}

export interface AuthSession {
  token: string;
  access_token: string;
  user: AuthUser;
}

const AUTH_STORAGE_KEY = "workbuddy_auth_session";

type AuthListener = (event: "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED", session: AuthSession | null) => void;
const listeners = new Set<AuthListener>();

export const authService = {
  getSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.token && !parsed?.access_token) return null;
      const token = parsed.token || parsed.access_token;
      return {
        token,
        access_token: token,
        user: parsed.user || { id: "", email: "" },
      };
    } catch {
      return null;
    }
  },

  setSession(session: AuthSession | null) {
    if (session) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      listeners.forEach((fn) => fn("SIGNED_IN", session));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      listeners.forEach((fn) => fn("SIGNED_OUT", null));
    }
  },

  async login(email: string, password: string): Promise<AuthSession> {
    const res = await apiClient.post<{ token: string; user: AuthUser }>("/api/v1/auth/login", {
      email,
      password,
    });
    const session: AuthSession = {
      token: res.token,
      access_token: res.token,
      user: res.user,
    };
    this.setSession(session);
    return session;
  },

  async register(email: string, password: string): Promise<AuthSession> {
    const res = await apiClient.post<{ token: string; user: AuthUser }>("/api/v1/auth/register", {
      email,
      password,
    });
    const session: AuthSession = {
      token: res.token,
      access_token: res.token,
      user: res.user,
    };
    this.setSession(session);
    return session;
  },

  logout(): void {
    this.setSession(null);
  },

  onAuthStateChange(callback: AuthListener): { data: { subscription: { unsubscribe: () => void } }; unsubscribe: () => void } {
    listeners.add(callback);
    const unsubscribe = () => {
      listeners.delete(callback);
    };
    return {
      data: { subscription: { unsubscribe } },
      unsubscribe,
    };
  },
};
