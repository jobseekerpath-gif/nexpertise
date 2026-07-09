import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  Loader2, Briefcase, Copy, Send, Globe, MapPin, CheckCircle2,
  XCircle, Clock, ArrowLeft, RefreshCw, Trash2, Award, Upload,
  FileSpreadsheet, X as XIcon,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { useB2BAuth } from "@/lib/use-b2b-auth";
import { B2BNav } from "@/components/b2b-nav";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const PASS_BAR = 60;

type Campaign = {
  id: number; title: string; role: string; experienceLevel: string;
  interviewType: string; coachId: string; durationMinutes: number; description: string | null;
};

type Invite = {
  id: number; token: string; candidateEmail: string | null; candidateName: string | null;
  status: string; candidateIp: string | null; candidateLocation: string | null;
  sentAt: string | null; startedAt: string | null; completedAt: string | null; createdAt: string;
  overallScore: number | null; communicationScore: number | null; grammarScore: number | null;
  confidenceScore: number | null; technicalScore: number | null; durationSeconds: number | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700",
  started: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  expired: "bg-red-100 text-red-600",
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

/** Parse an Excel/CSV file and return lines in "email" or "email,Name" format */
function parseSpreadsheet(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: file.name.endsWith(".csv") ? "string" : "array" });
        const ws = wb.Sheets[wb.SheetNames[0]!]!;
        // Convert to array-of-arrays (raw values)
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
        if (rows.length === 0) { resolve([]); return; }

        // Detect column indices from first row (header detection)
        const firstRow = rows[0]!.map((c) => String(c).toLowerCase().trim());
        let emailCol = firstRow.findIndex((h) => h.includes("email") || h === "e-mail");
        let nameCol  = firstRow.findIndex((h) => h.includes("name"));
        const hasHeader = emailCol !== -1 || nameCol !== -1;

        // Fall back: first col = email, second col = name (no header row)
        if (emailCol === -1) emailCol = 0;
        if (nameCol  === -1) nameCol  = emailCol === 0 ? 1 : 0;

        const dataRows = hasHeader ? rows.slice(1) : rows;
        const lines: string[] = [];
        for (const row of dataRows) {
          const email = String(row[emailCol] ?? "").trim();
          const name  = String(row[nameCol]  ?? "").trim();
          if (!email.includes("@")) continue;
          lines.push(name ? `${email},${name}` : email);
        }
        resolve(lines);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    if (file.name.endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

export default function B2BCampaign() {
  const { company, isLoading } = useB2BAuth();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Bulk invite form
  const [bulkText, setBulkText] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sending, setSending] = useState(false);

  // File upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const campaignId = params.id;

  const fetchCampaign = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/b2b/campaigns/${campaignId}`, { credentials: "include" });
      if (!res.ok) { toast({ title: "Campaign not found", variant: "destructive" }); navigate("/b2b/campaigns"); return; }
      const data = (await res.json()) as { campaign: Campaign; invites: Invite[] };
      setCampaign(data.campaign);
      setInvites(data.invites);
    } catch {
      toast({ title: "Could not load campaign", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [campaignId, toast, navigate]);

  useEffect(() => {
    if (!isLoading && !company) navigate("/b2b/login");
  }, [isLoading, company, navigate]);

  useEffect(() => {
    if (company && campaignId) void fetchCampaign();
  }, [company, campaignId, fetchCampaign]);

  const inviteLink = (token: string) => {
    const origin = window.location.origin;
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    return `${origin}${base}/b2b-interview/${token}`;
  };

  const copyLink = (token: string) => {
    void navigator.clipboard.writeText(inviteLink(token));
    toast({ title: "Link copied!" });
  };

  /** Handle Excel / CSV file selection */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setFileName(file.name);
    try {
      const lines = await parseSpreadsheet(file);
      if (lines.length === 0) {
        toast({ title: "No valid emails found in file", description: "Make sure the spreadsheet has an email column.", variant: "destructive" });
        setFileName(null);
      } else {
        // Append to existing text (deduplicate against what's already there)
        const existing = new Set(
          bulkText.split("\n").map((l) => l.split(",")[0]?.trim().toLowerCase()).filter(Boolean)
        );
        const fresh = lines.filter((l) => !existing.has(l.split(",")[0]?.trim().toLowerCase()));
        setBulkText((prev) => (prev.trim() ? prev.trimEnd() + "\n" + fresh.join("\n") : fresh.join("\n")));
        toast({ title: `${lines.length} email${lines.length !== 1 ? "s" : ""} imported`, description: fresh.length < lines.length ? `${lines.length - fresh.length} duplicate${lines.length - fresh.length !== 1 ? "s" : ""} skipped` : undefined });
      }
    } catch {
      toast({ title: "Could not parse file", description: "Please check the file format and try again.", variant: "destructive" });
      setFileName(null);
    } finally {
      setParsing(false);
      // Reset input so the same file can be re-selected
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearFile = () => {
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Parse bulk input: one entry per line, optionally "email,name" or just "email"
  const parsedCandidates = useMemo(() => {
    return bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [email, ...nameParts] = line.split(",");
        return { email: email?.trim() ?? "", name: nameParts.join(",").trim() || undefined };
      })
      .filter((c) => c.email.includes("@"));
  }, [bulkText]);

  const sendInvites = async () => {
    if (parsedCandidates.length === 0) {
      toast({ title: "Enter at least one email address", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${BASE}/api/b2b/campaigns/${campaignId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ candidates: parsedCandidates, sendEmail }),
      });
      const data = (await res.json()) as { invites?: Invite[]; sent?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to send invites");
      toast({
        title: `${data.invites?.length ?? 0} invite link${(data.invites?.length ?? 0) !== 1 ? "s" : ""} created${data.sent ? `, ${data.sent} emails sent` : ""}`,
      });
      setBulkText("");
      setFileName(null);
      void fetchCampaign();
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const deleteInvite = async (id: number) => {
    try {
      const res = await fetch(`${BASE}/api/b2b/invites/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      setInvites((prev) => prev.map((i) => i.id === id ? { ...i, status: "expired" } : i));
      toast({ title: "Invite cancelled" });
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
  };

  if (isLoading || loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (!company || !campaign) return null;

  const completedInvites = invites.filter((i) => i.status === "completed");
  const selected = completedInvites.filter((i) => (i.overallScore ?? 0) >= PASS_BAR).length;

  return (
    <div className="container mx-auto px-4 max-w-5xl py-8">
      <PageMeta title={`${campaign.title} · B2B · EduBharat`} description="Campaign detail" />
      <B2BNav />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => navigate("/b2b/campaigns")} className="text-muted-foreground hover:text-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-display font-bold text-secondary">{campaign.title}</h1>
            <span className="text-xs bg-muted text-secondary px-2 py-0.5 rounded">{campaign.role}</span>
            <span className="text-xs bg-muted text-secondary px-2 py-0.5 rounded">{campaign.durationMinutes}m</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {campaign.experienceLevel} · {campaign.interviewType}
            {campaign.description && ` · ${campaign.description}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchCampaign()}>
          <RefreshCw className="w-4 h-4 mr-1.5" />Refresh
        </Button>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-4 text-sm mb-6 flex-wrap">
        {[
          { label: "Total invites", value: invites.length },
          { label: "Completed", value: completedInvites.length, green: true },
          { label: "Selected", value: selected, green: true },
          { label: "Not selected", value: completedInvites.length - selected },
          { label: "Pending", value: invites.filter((i) => i.status === "pending" || i.status === "sent").length },
        ].map(({ label, value, green }) => (
          <div key={label} className="text-center">
            <p className={`text-xl font-bold ${green ? "text-green-600" : "text-secondary"}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Bulk invite panel */}
      <Card className="mb-6">
        <CardContent className="pt-5 pb-5 px-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-secondary flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />Send Interview Links
            </h3>

            {/* Excel / CSV upload */}
            <div className="flex items-center gap-2">
              {fileName && (
                <div className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg px-2.5 py-1.5 font-medium max-w-[180px]">
                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{fileName}</span>
                  <button onClick={clearFile} className="shrink-0 hover:text-green-900 ml-0.5">
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={parsing}
                className="text-xs font-semibold h-8 gap-1.5 border-dashed hover:border-primary hover:text-primary"
              >
                {parsing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Parsing…</>
                ) : (
                  <><Upload className="w-3.5 h-3.5" />Upload Excel / CSV</>
                )}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => void handleFileChange(e)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            One entry per line — <code className="bg-muted px-1 py-0.5 rounded">email@example.com</code> or <code className="bg-muted px-1 py-0.5 rounded">email,Name</code>
            &nbsp;·&nbsp;Or upload an Excel/CSV with <strong>Email</strong> and <strong>Name</strong> columns
          </p>

          <textarea
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-secondary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={5}
            placeholder={"ravi.kumar@gmail.com,Ravi Kumar\npriya.singh@outlook.com\n..."}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />

          <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="rounded"
                />
                <span className="text-secondary font-medium">Send email invitations</span>
              </label>
              {parsedCandidates.length > 0 && (
                <span className="text-xs text-muted-foreground">{parsedCandidates.length} candidate{parsedCandidates.length !== 1 ? "s" : ""} ready</span>
              )}
            </div>
            <Button onClick={() => void sendInvites()} disabled={sending || parsedCandidates.length === 0} className="font-semibold">
              {sending ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Sending…</> : <><Send className="w-4 h-4 mr-1.5" />Send {parsedCandidates.length || ""} Invites</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invite list */}
      <h3 className="text-sm font-bold text-secondary mb-3">All Invites ({invites.length})</h3>

      {invites.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No invites yet. Use the form above to send interview links.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {invites.map((inv) => {
            const open = expanded === inv.id;
            const verdict = inv.overallScore !== null
              ? inv.overallScore >= PASS_BAR ? "Selected" : "Not Selected"
              : null;

            return (
              <Card key={inv.id} className="overflow-hidden">
                <button
                  onClick={() => setExpanded(open ? null : inv.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-secondary text-sm truncate">
                        {inv.candidateName || inv.candidateEmail || `Invite #${inv.id}`}
                      </span>
                      {inv.candidateName && inv.candidateEmail && (
                        <span className="text-xs text-muted-foreground truncate">{inv.candidateEmail}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[inv.status] ?? "bg-muted"}`}>
                        {inv.status}
                      </span>
                      {verdict === "Selected" && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />Selected
                        </span>
                      )}
                      {verdict === "Not Selected" && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />Not Selected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {inv.overallScore !== null && (
                        <span className="flex items-center gap-1"><Award className="w-3 h-3 text-amber-500" />{inv.overallScore}/100</span>
                      )}
                      {inv.candidateLocation && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{inv.candidateLocation}</span>
                      )}
                      {inv.completedAt ? (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Completed {fmt(inv.completedAt)}</span>
                      ) : (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Created {fmt(inv.createdAt)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(inv.status === "pending" || inv.status === "sent") && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyLink(inv.token); }}
                          title="Copy invite link"
                          className="p-1.5 rounded text-muted-foreground hover:text-secondary hover:bg-muted transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); void deleteInvite(inv.id); }}
                          title="Cancel invite"
                          className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-muted transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {open && (
                  <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Interview Link</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded truncate text-secondary">
                          {inviteLink(inv.token)}
                        </code>
                        <button
                          onClick={() => copyLink(inv.token)}
                          className="shrink-0 p-1.5 rounded border border-border hover:bg-muted transition-colors"
                          title="Copy"
                        >
                          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <a
                          href={inviteLink(inv.token)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 p-1.5 rounded border border-border hover:bg-muted transition-colors"
                          title="Open"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" /> Candidate tracking
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        {[
                          ["IP Address", inv.candidateIp ?? "Not recorded"],
                          ["Location", inv.candidateLocation ?? "Not recorded"],
                          ["Sent", fmt(inv.sentAt)],
                          ["Started", fmt(inv.startedAt)],
                          ["Completed", fmt(inv.completedAt)],
                          ["Duration", inv.durationSeconds ? `${Math.round(inv.durationSeconds / 60)}m ${inv.durationSeconds % 60}s` : "—"],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                            <p className="text-sm text-secondary break-words">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {inv.status === "completed" && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Score breakdown</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-card border border-border rounded-lg p-3">
                          <ScoreBar label="Overall" value={inv.overallScore} />
                          <ScoreBar label="Communication" value={inv.communicationScore} />
                          <ScoreBar label="Grammar" value={inv.grammarScore} />
                          <ScoreBar label="Confidence" value={inv.confidenceScore} />
                          <ScoreBar label="Technical" value={inv.technicalScore} />
                        </div>
                      </div>
                    )}
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
