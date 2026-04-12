import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as SecureStorage from "./secure-storage";
import { api, TOKEN_KEY, setAuthToken, clearAuthToken } from "./api";
import { startOAuthFlow, type OAuthProvider } from "./oauth";

// ── Types ────────���───────────────────────────────────────────────────

interface User {
  id: string;
  username: string | null;
  displayName: string | null;
  email: string;
  avatar: string | null;
  tier: "free" | "premium";
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithOAuth: (provider: OAuthProvider) => Promise<LoginResult>;
  signup: (data: SignupData) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface LoginResult {
  success: boolean;
  requires2fa?: boolean;
  pendingToken?: string;
  error?: string;
}

interface SignupData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  agreeToTos: string;
  referralCode?: string;
}

// ── Context ───────���──────────────────────────────────────────────────

/** Decode a base64url string (JWT uses base64url, not standard base64). */
function decodeBase64Url(str: string): string {
  // Convert base64url → base64: replace - with +, _ with /, add padding
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  return atob(padded);
}

/** Decode user info from a mobile JWT without verifying signature (client-side). */
function decodeUserFromJwt(token: string): User | null {
  try {
    const payload = JSON.parse(decodeBase64Url(token.split(".")[1]));
    return {
      id: payload.sub,
      username: payload.username ?? null,
      displayName: payload.displayName ?? null,
      email: payload.email,
      avatar: payload.avatar ?? null,
      tier: payload.tier ?? "free",
    };
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = await SecureStorage.getItem(TOKEN_KEY);
      if (!token) {
        setUser(null);
        return;
      }
      const data = await api.get<{ user: User }>("/api/auth/mobile/me");
      setUser(data.user);
    } catch {
      setUser(null);
      await clearAuthToken();
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const data = await api.post<{
        token?: string;
        user?: User;
        requires2fa?: boolean;
        pendingToken?: string;
      }>("/api/auth/mobile/login", { email, password });

      if (data.requires2fa) {
        return { success: false, requires2fa: true, pendingToken: data.pendingToken };
      }

      if (data.token && data.user) {
        await setAuthToken(data.token);
        setUser(data.user);
        return { success: true };
      }

      return { success: false, error: "Invalid response" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Login failed" };
    }
  }, []);

  const signup = useCallback(async (data: SignupData): Promise<LoginResult> => {
    try {
      const result = await api.post<{ token: string; user: User }>(
        "/api/auth/mobile/signup",
        data
      );
      await setAuthToken(result.token);
      setUser(result.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Signup failed" };
    }
  }, []);

  const loginWithOAuth = useCallback(async (provider: OAuthProvider): Promise<LoginResult> => {
    try {
      const result = await startOAuthFlow(provider);
      console.log("[auth] OAuth result:", result.success, result.error);
      if (result.success && result.token) {
        await setAuthToken(result.token);
        console.log("[auth] Token stored, decoding JWT...");
        // Debug: log the raw JWT payload
        try {
          const rawPayload = JSON.parse(decodeBase64Url(result.token.split(".")[1]));
          console.log("[auth] Raw JWT payload:", JSON.stringify(rawPayload));
        } catch (e) {
          console.error("[auth] Failed to decode JWT:", e);
        }
        // Decode user info directly from the JWT to avoid a cross-origin /me fetch
        const userFromToken = decodeUserFromJwt(result.token);
        console.log("[auth] Decoded user:", userFromToken?.id, userFromToken?.username);
        if (userFromToken) {
          setUser(userFromToken);
          console.log("[auth] User set, isAuthenticated will be true");
          return { success: true };
        }
        // Fallback: fetch from API
        try {
          const data = await api.get<{ user: User }>("/api/auth/mobile/me");
          setUser(data.user);
          return { success: true };
        } catch {
          // Even if /me fails, the token is stored — set minimal user
          setUser(userFromToken as any);
          return { success: true };
        }
      }
      return { success: false, error: result.error || "OAuth login failed" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "OAuth failed" };
    }
  }, []);

  const logout = useCallback(async () => {
    await clearAuthToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithOAuth,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
