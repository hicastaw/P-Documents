import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { apiJson, apiJsonAuth } from "./api";

export type AuthUser = {
  id: string;
  email: string;
  display_name: string;
  role: string;
};

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: AuthUser };

type AuthContextValue = {
  authState: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });

  // On mount: check if token exists and fetch /auth/me
  useEffect(() => {
    const token = typeof window !== "undefined"
      ? localStorage.getItem("pdocs_access_token")
      : null;

    if (!token) {
      setAuthState({ status: "unauthenticated" });
      return;
    }

    apiJsonAuth<{ user: AuthUser }>("/auth/me")
      .then(({ user }) => setAuthState({ status: "authenticated", user }))
      .catch(() => {
        localStorage.removeItem("pdocs_access_token");
        setAuthState({ status: "unauthenticated" });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const json = await apiJson<{ accessToken: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    localStorage.setItem("pdocs_access_token", json.accessToken);
    setAuthState({ status: "authenticated", user: json.user });
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      await apiJson("/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          displayName,
        }),
      });
      // Auto login after register
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(async () => {
    try {
      await apiJsonAuth("/auth/logout", { method: "POST" });
    } catch {
      // ignore server error — still clear local state
    }
    localStorage.removeItem("pdocs_access_token");
    setAuthState({ status: "unauthenticated" });
  }, []);

  return (
    <AuthContext.Provider value={{ authState, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
