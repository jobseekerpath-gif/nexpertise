import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Briefcase, Plus, ArrowRight, Users, CheckCircle2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { useB2BAuth } from "@/lib/use-b2b-auth";
import { B2BNav } from "@/components/b2b-nav";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Campaign = {
  id: number; title: string; role: string; experienceLevel: string;
  interviewType: string; durationMinutes: number; isActive: boolean;
  inviteCount: number; completedCount: number; createdAt: string;
};

function fmt(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
}

export default function B2BCampaigns() {
  const { company, isLoading } = useB2BAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/b2b/campaigns`, { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as { campaigns: Campaign[] };
        setCampaigns(data.campaigns);
      }
    } catch {
      toast({ title: "Could not load campaigns", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isLoading && !company) navigate("/b2b/login");
  }, [isLoading, company, navigate]);

  useEffect(() => {
    if (company) void fetchCampaigns();
  }, [company, fetchCampaigns]);

  const filtered = campaigns.filter((c) => {
    const q = query.trim().toLowerCase();
    return !q || c.title.toLowerCase().includes(q) || c.role.toLowerCase().includes(q);
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (!company) return null;

  return (
    <div className="container mx-auto px-4 max-w-4xl py-8">
      <PageMeta title="Campaigns · B2B · EduBharat" description="Manage your interview campaigns" />
      <B2BNav />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-bold text-secondary">Campaigns</h1>
          <span className="bg-muted text-secondary text-xs font-bold px-2 py-0.5 rounded-full">{campaigns.length}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchCampaigns()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Button size="sm" onClick={() => navigate("/b2b/campaign/new")} className="font-semibold">
            <Plus className="w-4 h-4 mr-1.5" />New Campaign
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by title or role…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>

      {loading && campaigns.length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-secondary font-semibold mb-2">No campaigns yet</p>
            <Button onClick={() => navigate("/b2b/campaign/new")} className="font-bold mt-2">
              <Plus className="w-4 h-4 mr-1.5" />Create first campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/b2b/campaign/${c.id}`)}>
              <CardContent className="px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-secondary">{c.title}</span>
                      <span className="text-xs text-muted-foreground">{c.role}</span>
                      <span className="text-xs bg-muted text-secondary px-1.5 py-0.5 rounded">{c.durationMinutes}m</span>
                      <span className="text-xs bg-muted text-secondary px-1.5 py-0.5 rounded">{c.experienceLevel}</span>
                      {!c.isActive && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Inactive</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.inviteCount} invited</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" />{c.completedCount} done</span>
                      <span>Created {fmt(c.createdAt)}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
