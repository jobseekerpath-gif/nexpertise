import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Loader2, Building2, Briefcase, Users, Coins, CheckCircle2, XCircle,
  Plus, RefreshCw, TrendingUp, Clock, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { useB2BAuth } from "@/lib/use-b2b-auth";
import { B2BNav } from "@/components/b2b-nav";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Stats = {
  totalInvites: number;
  completed: number;
  pending: number;
  selected: number;
  balance: number;
};

type Campaign = {
  id: number;
  title: string;
  role: string;
  experienceLevel: string;
  interviewType: string;
  durationMinutes: number;
  inviteCount: number;
  completedCount: number;
  createdAt: string;
};

function fmt(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
}

export default function B2BDashboard() {
  const { company, isLoading } = useB2BAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        fetch(`${BASE}/api/b2b/stats`, { credentials: "include" }),
        fetch(`${BASE}/api/b2b/campaigns`, { credentials: "include" }),
      ]);
      if (sRes.ok) setStats((await sRes.json()) as Stats);
      if (cRes.ok) {
        const data = (await cRes.json()) as { campaigns: Campaign[] };
        setCampaigns(data.campaigns.slice(0, 5));
      }
    } catch {
      toast({ title: "Could not load dashboard", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isLoading && !company) navigate("/b2b/login");
  }, [isLoading, company, navigate]);

  useEffect(() => {
    if (company) void fetchData();
  }, [company, fetchData]);

  if (isLoading || (!company && !loading)) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!company) return null;

  const selectionRate = stats && stats.completed > 0
    ? Math.round((stats.selected / stats.completed) * 100)
    : null;

  return (
    <div className="container mx-auto px-4 max-w-5xl py-8">
      <PageMeta title="B2B Dashboard · EduBharat" description="Recruiter portal dashboard" />
      <B2BNav />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-secondary">{company.name}</h1>
            <p className="text-xs text-muted-foreground">{company.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Button size="sm" onClick={() => navigate("/b2b/campaign/new")} className="font-semibold">
            <Plus className="w-4 h-4 mr-1.5" />New Campaign
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Credits", value: stats?.balance ?? "—", icon: Coins, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Completed", value: stats?.completed ?? "—", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "Pending", value: stats?.pending ?? "—", icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Selected", value: selectionRate !== null ? `${selectionRate}%` : (stats?.selected ?? "—"), icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${bg} mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Credits callout */}
      {stats && stats.balance < 10 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-sm font-semibold text-amber-800">
                {stats.balance === 0 ? "You're out of credits — interviews won't be charged to candidates but you'll need to top up." : `Only ${stats.balance} credits left. Each completed interview costs 2 credits.`}
              </p>
            </div>
            <Link href="/b2b/credits">
              <Button size="sm" className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold">Buy Credits</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Recent campaigns */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-secondary">Recent Campaigns</h2>
        <Link href="/b2b/campaigns" className="text-sm text-primary font-semibold hover:underline flex items-center gap-1">
          All campaigns <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading && campaigns.length === 0 ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-secondary font-semibold mb-2">No campaigns yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create a campaign to start sending interview links</p>
            <Button onClick={() => navigate("/b2b/campaign/new")} className="font-bold">
              <Plus className="w-4 h-4 mr-1.5" />Create first campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/b2b/campaign/${c.id}`)}>
              <CardContent className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-secondary truncate">{c.title}</span>
                      <span className="text-xs text-muted-foreground">{c.role}</span>
                      <span className="text-xs bg-muted text-secondary px-1.5 py-0.5 rounded">{c.durationMinutes}m</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.inviteCount} invited</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" />{c.completedCount} completed</span>
                      <span>{fmt(c.createdAt)}</span>
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
