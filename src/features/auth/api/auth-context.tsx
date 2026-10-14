import { createContext, useContext } from "react";
import type { AuthSession } from "./authService";

export interface AuthContextValue {
  session: AuthSession;
  userId: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = AuthContext.Provider;

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("Authenticated application content must be rendered inside AuthProvider.");
  }
  return auth;
}
