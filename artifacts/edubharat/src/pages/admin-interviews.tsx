import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Loader2, BriefcaseIcon, ChevronDown, ChevronRight, Search,
  MapPin, Globe, RefreshCw, Clock, Award, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/lib/use-auth";
import { AdminNav } from "@/components/admin-nav";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/** Overall score ≥ 60 = Selected (mirrors Interview Ace verdict logic). */
const PASS_BAR = 60;

type InterviewRow = {
  id: number;
  role: string;
  experienceLevel: string;
  interviewType: string | null;
  overallScore: number | null;
  communicationScore: number | null;
  grammarScore: number | null;
  confidenceScore: number | null;
  technicalScore: number | null;
  feedbackJson: string | null;
  durationSeconds: number | null;
  completedAt: string | null;
  createdAt: string;
  // joined user columns
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  userLocation: string | null;
  signupLocation: string | null;
  lastLoginLocation: string | null;
  signupIp: string | null;
  lastLoginIp: string | null;
  preferredCity: string | null;
  education: string | null;
  degree: string | null;
  branch: string | null;
  university: string | null;
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

function durFmt(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value === null || value === undefined) return null;
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="min-w-0">
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-secondary break-words">{value}</p>
    </div>
  );
}

/** Derive human-readable competency list from feedbackJson. */
function parseCompetencies(raw: string | null): Array<{ name: string; score: number }> {
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const result: Array<{ name: string; score: number }> = [];
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "number") {
        result.push({ name: key, score: val });
      } else if (val && typeof val === "object" && "score" in val && typeof (val as { score: unknown }).score === "number") {
        result.push({ name: key, score: (val as { score: number }).score });
      }
    }
    return result;
  } catch { return []; }
}

/** Unique candidates list for the dropdown filter. */
function buildCandidateOptions(rows: InterviewRow[]) {
  const seen = new Set<number | null>();
  const opts: Array<{ id: number | null; label: string }> = [{ id: null, label: "All Candidates" }];
  for (const r of rows) {
    if (!seen.has(r.userId)) {
      seen.add(r.userId);
      const label = r.userName
        ? `${r.userName} (${r.userEmail ?? "—"})`
        : (r.userEmail ?? `User #${r.userId}`);
      opts.push({ id: r.userId, label });
    }
  }
  return opts;
}

export default function AdminInterviews() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<number | null | "ALL">("ALL");
  const [expanded, setExpanded] = useState<number | null>(null);

  const isAdmin = user?.isAdmin === true;

  const fetchInterviews = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`${BASE}/api/admin/interviews`, { credentials: "include" });
      if (!res.ok) { toast({ title: "Failed to load interviews", variant: "destructive" }); return; }
      const data = (await res.json()) as { interviews: InterviewRow[] };
      setInterviews(data.interviews);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setFetching(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate("/");
  }, [isLoading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) void fetchInterviews();
  }, [isAdmin, fetchInterviews]);

  const candidateOptions = useMemo(() => buildCandidateOptions(interviews), [interviews]);

  const filtered = useMemo(() => {
    let list = interviews;
    // Filter by selected candidate from dropdown
    if (selectedCandidate !== "ALL") {
      list = list.filter((r) => r.userId === selectedCandidate);
    }
    // Text search
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        (r.userName ?? "").toLowerCase().includes(q) ||
        (r.userEmail ?? "").toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        (r.signupLocation ?? "").toLowerCase().includes(q) ||
        (r.lastLoginLocation ?? "").toLowerCase().includes(q) ||
        (r.signupIp ?? "").includes(q) ||
        (r.lastLoginIp ?? "").includes(q)
      );
    }
    return list;
  }, [interviews, selectedCandidate, query]);

  // Stats
  const totalCandidates = useMemo(() => new Set(interviews.map((r) => r.userId)).size, [interviews]);
  const totalSelected = useMemo(
    () => interviews.filter((r) => r.overallScore !== null && r.overallScore >= PASS_BAR).length,
    [interviews]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="container mx-auto px-4 max-w-4xl py-8">
      <PageMeta title="Interview Candidates · Admin · EduBharat" description="Interview candidates directory" />
      <AdminNav />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <BriefcaseIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-bold text-secondary">Interview Candidates</h1>
          <span className="bg-muted text-secondary text-xs font-bold px-2 py-0.5 rounded-full">
            {interviews.length} sessions
          </span>
          <span className="text-xs text-muted-foreground">{totalCandidates} unique candidates</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
            <CheckCircle2 className="w-3.5 h-3.5" /> {totalSelected} selected
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchInterviews()} disabled={fetching}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Candidate dropdown filter */}
      <div className="mb-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">
          Filter by Candidate
        </label>
        <select
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
          value={selectedCandidate === "ALL" ? "ALL" : String(selectedCandidate)}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedCandidate(v === "ALL" ? "ALL" : Number(v));
            setExpanded(null);
          }}
        >
          {candidateOptions.map((opt) => (
            <option key={String(opt.id)} value={opt.id === null ? "ALL" : String(opt.id)}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Text search */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, role, location or IP…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {fetching && interviews.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No interviews found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => {
            const open = expanded === row.id;
            const score = row.overallScore;
            const verdict =
              score === null
                ? null
                : score >= PASS_BAR
                ? "Selected"
                : "Not Selected";
            const location = row.lastLoginLocation || row.signupLocation || row.userLocation || row.preferredCity;
            const ip = row.lastLoginIp || row.signupIp;
            const competencies = parseCompetencies(row.feedbackJson);

            return (
              <Card key={row.id} className="overflow-hidden">
                {/* Row header */}
                <button
                  onClick={() => setExpanded(open ? null : row.id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/40 transition-colors"
                >
                  {open
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-secondary truncate">
                        {row.userName || row.userEmail || "Unknown candidate"}
                      </span>
                      {row.userEmail && row.userName && (
                        <span className="text-xs text-muted-foreground truncate">{row.userEmail}</span>
                      )}
                      {/* Verdict badge */}
                      {verdict === "Selected" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          <CheckCircle2 className="w-3 h-3" /> Selected
                        </span>
                      ) : verdict === "Not Selected" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                          <XCircle className="w-3 h-3" /> Not Selected
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Pending</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="font-medium text-secondary">{row.role}</span>
                      <span>{row.experienceLevel}</span>
                      {score !== null && (
                        <span className="inline-flex items-center gap-1">
                          <Award className="w-3 h-3 text-amber-500" />{score}/100
                        </span>
                      )}
                      {location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />{fmt(row.createdAt)}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {open && (
                  <div className="border-t border-border bg-muted/20 max-h-[70vh] overflow-y-auto px-4 py-4 space-y-5">

                    {/* Candidate info */}
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Candidate</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Field label="Name" value={row.userName} />
                        <Field label="Email" value={row.userEmail} />
                        <Field label="User ID" value={row.userId} />
                        <Field label="Education" value={row.education} />
                        <Field label="Degree" value={row.degree} />
                        <Field label="Branch" value={row.branch} />
                        <Field label="University" value={row.university} />
                        <Field label="Preferred city" value={row.preferredCity} />
                        <Field label="Profile location" value={row.userLocation} />
                      </div>
                    </section>

                    {/* Sign-in origin / IP */}
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" /> Sign-in origin &amp; IP
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Signup IP" value={row.signupIp ?? "Not recorded"} />
                        <Field label="Signup location" value={row.signupLocation ?? "Not recorded"} />
                        <Field label="Last login IP" value={row.lastLoginIp ?? "Not recorded"} />
                        <Field label="Last login location" value={row.lastLoginLocation ?? "Not recorded"} />
                      </div>
                    </section>

                    {/* Interview result */}
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Interview result</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                        <Field label="Role applied" value={row.role} />
                        <Field label="Experience level" value={row.experienceLevel} />
                        <Field label="Interview type" value={row.interviewType} />
                        <Field label="Duration" value={durFmt(row.durationSeconds)} />
                        <Field label="Completed" value={fmt(row.completedAt)} />
                        <Field
                          label="Verdict"
                          value={
                            verdict === "Selected" ? (
                              <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                              </span>
                            ) : verdict === "Not Selected" ? (
                              <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                <XCircle className="w-3.5 h-3.5" /> Not Selected
                              </span>
                            ) : "Pending"
                          }
                        />
                      </div>

                      {/* Score breakdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-card border border-border rounded-lg p-3">
                        <ScoreBar label="Overall score" value={row.overallScore} />
                        <ScoreBar label="Communication" value={row.communicationScore} />
                        <ScoreBar label="Grammar" value={row.grammarScore} />
                        <ScoreBar label="Confidence" value={row.confidenceScore} />
                        <ScoreBar label="Technical" value={row.technicalScore} />
                        {competencies.map((c) => (
                          <ScoreBar key={c.name} label={c.name} value={c.score} />
                        ))}
                      </div>
                    </section>
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
