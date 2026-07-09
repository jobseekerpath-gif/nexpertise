import { useCallback, useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export type B2BCompany = {
  id: number;
  name: string;
  email: string;
  credits: number;
  phone?: string | null;
  industry?: string | null;
  website?: string | null;
  createdAt?: string;
};

export function useB2BAuth() {
  const [company, setCompany] = useState<B2BCompany | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const check = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/b2b/auth/me`, { credentials: "include" });
      const data = (await res.json()) as { company: B2BCompany | null };
      setCompany(data.company);
    } catch {
      setCompany(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BASE}/api/b2b/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as { success?: boolean; company?: B2BCompany; error?: string };
    if (!res.ok || !data.success) throw new Error(data.error ?? "Login failed");
    setCompany(data.company ?? null);
    return data.company!;
  }, []);

  const register = useCallback(
    async (fields: { name: string; email: string; password: string; phone?: string; industry?: string; website?: string }) => {
      const res = await fetch(`${BASE}/api/b2b/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(fields),
      });
      const data = (await res.json()) as { success?: boolean; company?: B2BCompany; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Registration failed");
      setCompany(data.company ?? null);
      return data.company!;
    },
    [],
  );

  const logout = useCallback(async () => {
    await fetch(`${BASE}/api/b2b/auth/logout`, { method: "POST", credentials: "include" });
    setCompany(null);
  }, []);

  const refetch = check;

  return { company, isLoading, login, register, logout, refetch };
}
