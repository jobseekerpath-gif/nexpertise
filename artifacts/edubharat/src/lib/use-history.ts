import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./use-auth";

export type HistoryItem = {
  id: string;
  tool: "English Guru" | "Interview Ace" | "Rozgar Samachar";
  title: string;
  content: string;
  savedAt: string;
};

const STORAGE_KEY = "edubharat_history";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function loadLocal(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch { return []; }
}

function saveLocal(items: HistoryItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 200))); } catch { /* ignore */ }
}

function apiItemToLocal(item: Record<string, unknown>): HistoryItem {
  return {
    id: String(item["id"] ?? ""),
    tool: (item["tool"] as HistoryItem["tool"]) ?? "English Guru",
    title: typeof item["title"] === "string" ? item["title"] : "",
    content: typeof item["content"] === "string" ? item["content"] : "",
    savedAt: typeof item["savedAt"] === "string" ? item["savedAt"] : new Date().toISOString(),
  };
}

export function useHistory() {
  const { user } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>(loadLocal);
  const syncedRef = useRef(false);

  // Fetch from server on login
  useEffect(() => {
    if (!user || syncedRef.current) return;
    syncedRef.current = true;

    fetch(`${BASE}/api/history/items?limit=200`, { credentials: "include" })
      .then(r => r.json())
      .then((data: { items?: Record<string, unknown>[] }) => {
        const serverItems = (data.items ?? []).map(apiItemToLocal);
        setItems(serverItems);
        saveLocal(serverItems);
      })
      .catch(() => { /* keep local */ });
  }, [user]);

  useEffect(() => { if (!user) { syncedRef.current = false; } }, [user]);

  const save = useCallback(async (item: Omit<HistoryItem, "id" | "savedAt">) => {
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newItem: HistoryItem = { ...item, id: tempId, savedAt: new Date().toISOString() };

    setItems(prev => {
      const updated = [newItem, ...prev];
      saveLocal(updated);
      return updated;
    });

    // Persist to server if logged in
    if (user) {
      try {
        const res = await fetch(`${BASE}/api/history/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tool: item.tool, title: item.title, content: item.content }),
        });
        const data = (await res.json()) as { item?: Record<string, unknown> };
        if (data.item) {
          const serverItem = apiItemToLocal(data.item);
          // Replace temp item with server item
          setItems(prev => {
            const updated = prev.map(i => i.id === tempId ? serverItem : i);
            saveLocal(updated);
            return updated;
          });
          return serverItem.id;
        }
      } catch { /* keep temp local */ }
    }

    return tempId;
  }, [user]);

  const remove = useCallback(async (id: string) => {
    setItems(prev => {
      const updated = prev.filter(i => i.id !== id);
      saveLocal(updated);
      return updated;
    });

    if (user && !id.startsWith("local-")) {
      try {
        await fetch(`${BASE}/api/history/items/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch { /* local already removed */ }
    }
  }, [user]);

  const clear = useCallback(async () => {
    setItems([]);
    localStorage.removeItem(STORAGE_KEY);

    if (user) {
      try {
        await fetch(`${BASE}/api/history/items`, { method: "DELETE", credentials: "include" });
      } catch { /* local already cleared */ }
    }
  }, [user]);

  return { items, save, remove, clear };
}

export function getHistoryCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items = raw ? (JSON.parse(raw) as HistoryItem[]) : [];
    return items.length;
  } catch { return 0; }
}
