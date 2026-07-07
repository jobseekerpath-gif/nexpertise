import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, FileText, Save, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/lib/use-auth";
import { AdminNav } from "@/components/admin-nav";
import { CONTENT_REGISTRY, CONTENT_PAGES } from "@/lib/content-registry";
import { refreshContent } from "@/lib/use-content";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function AdminContent() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const isAdmin = user?.isAdmin === true;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/content`, { credentials: "include" });
      const data = res.ok ? ((await res.json()) as { content?: Record<string, string> }) : { content: {} };
      const ov = data.content ?? {};
      setOverrides(ov);
      // Seed drafts with override or default so each field shows current text.
      const seed: Record<string, string> = {};
      for (const e of CONTENT_REGISTRY) seed[e.key] = ov[e.key] ?? e.defaultValue;
      setDrafts(seed);
    } catch {
      toast({ title: "Failed to load content", variant: "destructive" });
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate("/");
  }, [isLoading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const save = useCallback(async (key: string, value: string) => {
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      const res = await fetch(`${BASE}/api/admin/content`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast({ title: "Save failed", description: d.error, variant: "destructive" });
        return;
      }
      setOverrides((o) => {
        const next = { ...o };
        if (value === "") delete next[key];
        else next[key] = value;
        return next;
      });
      await refreshContent();
      toast({ title: value === "" ? "Reset to default" : "Saved" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }, [toast]);

  if (isLoading || !loaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="container mx-auto px-4 max-w-4xl py-8">
      <PageMeta title="Content · Admin · EduBharat" description="Edit page text" />
      <AdminNav />

      <div className="flex items-center gap-3 mb-2">
        <FileText className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold text-secondary">Page content</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Edit the text shown on your public pages. Changes go live immediately. Leave a field and click
        <span className="font-semibold"> Reset </span> to restore the built-in default.
      </p>

      {CONTENT_PAGES.map((page) => {
        const entries = CONTENT_REGISTRY.filter((e) => e.page === page);
        return (
          <div key={page} className="mb-8">
            <h2 className="font-bold text-secondary mb-3">{page}</h2>
            <div className="space-y-4">
              {entries.map((e) => {
                const draft = drafts[e.key] ?? e.defaultValue;
                const isOverridden = overrides[e.key] !== undefined;
                const current = overrides[e.key] ?? e.defaultValue;
                const dirty = draft !== current;
                return (
                  <Card key={e.key}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-secondary">{e.label}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{e.key}</span>
                        </div>
                        {isOverridden ? (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Customised</span>
                        ) : (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Default</span>
                        )}
                      </div>

                      {e.multiline ? (
                        <Textarea
                          value={draft}
                          onChange={(ev) => setDrafts((d) => ({ ...d, [e.key]: ev.target.value }))}
                          rows={3}
                          className="text-sm"
                        />
                      ) : (
                        <Input
                          value={draft}
                          onChange={(ev) => setDrafts((d) => ({ ...d, [e.key]: ev.target.value }))}
                          className="text-sm"
                        />
                      )}

                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          className="font-semibold"
                          disabled={!dirty || saving[e.key]}
                          onClick={() => void save(e.key, draft)}
                        >
                          {saving[e.key] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1.5" />Save</>}
                        </Button>
                        {isOverridden && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="font-semibold"
                            disabled={saving[e.key]}
                            onClick={() => { setDrafts((d) => ({ ...d, [e.key]: e.defaultValue })); void save(e.key, ""); }}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset
                          </Button>
                        )}
                        {!dirty && !saving[e.key] && isOverridden && (
                          <span className="text-xs text-green-600 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />Live</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
