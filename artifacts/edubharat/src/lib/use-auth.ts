import { useState, useEffect, useCallback } from "react";

export type AuthUser = {
  id: number;
  email: string;
  name?: string | null;
  picture?: string | null;
  preferredLanguage?: string | null;
};

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
      const data = (await res.json()) as { user: AuthUser | null };
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const logout = useCallback(async () => {
    await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  const loginWithGoogle = useCallback((guestId?: string) => {
    const url = new URL(`${BASE}/api/auth/google`, window.location.href);
    if (guestId) url.searchParams.set("guestId", guestId);
    window.location.href = url.toString();
  }, []);

  const sendOtp = useCallback(async (email: string) => {
    const res = await fetch(`${BASE}/api/auth/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      credentials: "include",
    });
    return res.json() as Promise<{ success?: boolean; error?: string; dev?: string }>;
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string, guestId?: string) => {
    const res = await fetch(`${BASE}/api/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, ...(guestId ? { guestId } : {}) }),
      credentials: "include",
    });
    const data = (await res.json()) as { success?: boolean; user?: AuthUser; error?: string };
    if (data.success && data.user) {
      setUser(data.user);
    }
    return data;
  }, []);

  return { user, isLoading, logout, loginWithGoogle, sendOtp, verifyOtp, refetch: fetchMe };
}
