import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Users, Search, CheckCircle2, XCircle, MapPin, Globe, Award, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { useB2BAuth } from "@/lib/use-b2b-auth";
import { B2BNav } from "@/components/b2b-nav";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const PASS_BAR = 60;

type Candidate = {
  inviteId: number; campaignId: number; token: string;
  candidateEmail: string | null; candidateName: string | null;
  candidateIp: string | null; candidateLocation: string | null;
  completedAt: string | null; campaignTitle: string; campaignRole: string;
  overallScore: number | null; communicationScore: number | null; grammarScore: number | null;
  confidenceScore: number | null; technicalScore: number | null; durationSeconds: number | null;
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-semibold text-secondary w-7 text-right">{value}</span>
      </div>
    </div>
  );
}

export default function B2BCandidates() {
  const { company, isLoading } = useB2BAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filterVerdict, setFilterVerdict] = useState<"all" | "selected" | "not_selected">("all");

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/b2b/candidates`, { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as { candidates: Candidate[] };
        setCandidates(data.candidates);
      }
    } catch {
      toast({ title: "Could not load candidates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isLoading && !company) navigate("/b2b/login");
  }, [isLoading, company, navigate]);

  useEffect(() => {
    if (company) void fetchCandidates();
  }, [company, fetchCandidates]);

  const filtered = useMemo(() => {
    let list = candidates;
    if (filterVerdict === "selected") list = list.filter((c) => (c.overallScore ?? 0) >= PASS_BAR);
    if (filterVerdict === "not_selected") list = list.filter((c) => c.overallScore !== null && c.overallScore < PASS_BAR);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((c) =>
      (c.candidateName ?? "").toLowerCase().includes(q) ||
      (c.candidateEmail ?? "").toLowerCase().includes(q) ||
      c.campaignRole.toLowerCase().includes(q) ||
      (c.candidateLocation ?? "").toLowerCase().includes(q) ||
      (c.candidateIp ?? "").includes(q)
    );
    return list;
  }, [candidates, filterVerdict, query]);

  const selected = useMemo(() => candidates.filter((c) => (c.overallScore ?? 0) >= PASS_BAR).length, [candidates]);

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (!company) return null;

  return (
    <div className="container mx-auto px-4 max-w-4xl py-8">
      <PageMeta title="Candidates · B2B · EduBharat" description="Completed interview candidates" />
      <B2BNav />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-bold text-secondary">Candidates</h1>
          <span className="bg-muted text-secondary text-xs font-bold px-2 py-0.5 rounded-full">{candidates.length} completed</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
            <CheckCircle2 className="w-3.5 h-3.5" />{selected} selected
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchCandidates()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, email, role or IP…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(["all", "selected", "not_selected"] as const).map((v) => (
            <button key={v}
              onClick={() => setFilterVerdict(v)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${filterVerdict === v ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-secondary"}`}
            >
              {v === "all" ? "All" : v === "selected" ? "✅ Selected" : "❌ Not Selected"}
            </button>
          ))}
        </div>
      </div>

      {loading && candidates.length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {candidates.length === 0 ? "No completed interviews yet." : "No candidates match your filters."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const open = expanded === c.inviteId;
            const verdict = c.overallScore !== null ? (c.overallScore >= PASS_BAR ? "Selected" : "Not Selected") : null;
            return (
              <Card key={c.inviteId} className="overflow-hidden">
                <button
                  onClick={() => setExpanded(open ? null : c.inviteId)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-secondary truncate">{c.candidateName || c.candidateEmail || `Invite #${c.inviteId}`}</span>
                      {c.candidateName && c.candidateEmail && <span className="text-xs text-muted-foreground">{c.candidateEmail}</span>}
                      {verdict === "Selected" && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          <CheckCircle2 className="w-3 h-3" />Selected
                        </span>
                      )}
                      {verdict === "Not Selected" && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                          <XCircle className="w-3 h-3" />Not Selected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="font-medium text-secondary">{c.campaignRole}</span>
                      <span className="text-xs">{c.campaignTitle}</span>
                      {c.overallScore !== null && <span className="flex items-center gap-1"><Award className="w-3 h-3 text-amber-500" />{c.overallScore}/100</span>}
                      {c.candidateLocation && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.candidateLocation}</span>}
                      <span>{fmt(c.completedAt)}</span>
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" />Tracking
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {[["IP Address", c.candidateIp ?? "Not recorded"], ["Location", c.candidateLocation ?? "Not recorded"], ["Completed", fmt(c.completedAt)],
                          ["Duration", c.durationSeconds ? `${Math.round(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s` : "—"]].map(([label, value]) => (
                          <div key={label}>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                            <p className="text-sm text-secondary">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Score breakdown</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-card border border-border rounded-lg p-3">
                        <ScoreBar label="Overall" value={c.overallScore} />
                        <ScoreBar label="Communication" value={c.communicationScore} />
                        <ScoreBar label="Grammar" value={c.grammarScore} />
                        <ScoreBar label="Confidence" value={c.confidenceScore} />
                        <ScoreBar label="Technical" value={c.technicalScore} />
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
