import { useState, useCallback } from "react";

export type HistoryItem = {
  id: string;
  tool: "English Guru" | "Interview Ace" | "Rozgar Samachar";
  title: string;
  content: string;
  savedAt: string;
};

const STORAGE_KEY = "edubharat_history";

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: HistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>(loadHistory);

  const save = useCallback((item: Omit<HistoryItem, "id" | "savedAt">) => {
    const newItem: HistoryItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      savedAt: new Date().toISOString(),
    };
    setItems((prev) => {
      const updated = [newItem, ...prev];
      saveToStorage(updated);
      return updated;
    });
    return newItem.id;
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { items, save, remove, clear };
}

export function getHistoryCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items = raw ? (JSON.parse(raw) as HistoryItem[]) : [];
    return items.length;
  } catch {
    return 0;
  }
}
