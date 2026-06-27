import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useHistory } from "@/lib/use-history";
import { useProgress } from "@/lib/use-progress";
import { useStudentProfile, type ResumeAnalysis } from "@/lib/use-student-profile";
import {
  FileText, Loader2, Sparkles, CheckCircle2, Upload,
  Download, Bookmark, RefreshCw, Target, Zap, Shield,
  BookOpen, Briefcase, GraduationCap, User, AlertCircle,
  ChevronDown, ChevronUp, X,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const TARGET_ROLES = [
  { value: "software_engineer", label: "Software Engineer / Developer" },
  { value: "data_analyst", label: "Data Analyst / Data Scientist" },
  { value: "hr_professional", label: "HR / People Operations" },
  { value: "sales_executive", label: "Sales Executive" },
  { value: "marketing_manager", label: "Marketing Manager" },
  { value: "finance_accountant", label: "Finance / Accountant / CA" },
  { value: "banking_bfsi", label: "Banking / BFSI" },
  { value: "operations_manager", label: "Operations Manager" },
  { value: "government_services", label: "Government / Civil Services" },
  { value: "fresher_general", label: "Fresher (Any Domain)" },
  { value: "product_manager", label: "Product Manager" },
  { value: "content_writer", label: "Content Writer / Editor" },
  { value: "customer_service", label: "Customer Service" },
  { value: "mechanical_engineer", label: "Mechanical / Civil Engineer" },
];

const EXPERIENCE_LEVELS = [
  "Fresher (0 years)",
  "Junior (1-3 years)",
  "Mid-level (3-6 years)",
  "Senior (6-10 years)",
  "Expert (10+ years)",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPT_TYPES = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreGrade(score: number): { label: string; color: string; bg: string } {
  if (score >= 85) return { label: "Excellent", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
  if (score >= 70) return { label: "Good", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" };
  if (score >= 55) return { label: "Average", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" };
  return { label: "Needs Work", color: "text-red-700", bg: "bg-red-50 border-red-200" };
}

function stringArrayProp(analysis: ResumeAnalysis, key: keyof ResumeAnalysis): string[] {
  const value = analysis[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function parseSSE(response: Response): AsyncGenerator<string> {
  return (async function* () {
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; error?: string };
          if (data.error) throw new Error(data.error);
          if (data.done) return;
          if (data.content) yield data.content;
        } catch (e) {
          if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
        }
      }
    }
  })();
}

// ─── Section card ──────────────────────────────────────────────────────────────

type SectionDef = { id: keyof ResumeAnalysis; title: string; icon: React.ElementType; color: string };

const SECTIONS: SectionDef[] = [
  { id: "skills", title: "Skills", icon: Zap, color: "text-orange-600" },
  { id: "education", title: "Education", icon: GraduationCap, color: "text-teal-600" },
  { id: "atsGaps", title: "ATS Gaps", icon: Shield, color: "text-red-600" },
  { id: "formattingIssues", title: "Formatting Issues", icon: BookOpen, color: "text-amber-600" },
  { id: "suggestions", title: "Suggestions", icon: Target, color: "text-blue-600" },
];

function SectionCard({ sec, items }: { sec: SectionDef; items: string[] }) {
  const [open, setOpen] = useState(true);
  if (!items || items.length === 0) return null;
  return (
    <Card className="border shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <sec.icon className={`w-4 h-4 ${sec.color}`} />
          <span className="font-semibold text-sm text-secondary">{sec.title}</span>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t px-5 pb-4 pt-3 bg-muted/20 space-y-2">
          {items.map((item, i) => (
            <p key={i} className="text-sm text-secondary leading-relaxed flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>{item}</span>
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ResumeIntelligence() {
  const { save } = useHistory();
  const { track } = useProgress();
  const { profile, updateProfile, isLoading: profileLoading } = useStudentProfile();
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  const [targetRole, setTargetRole] = useState(
    () => TARGET_ROLES.find(r =>
      r.label.toLowerCase().includes((profile.preferredRole ?? "").toLowerCase())
    )?.value ?? "fresher_general"
  );
  const [experienceLevel, setExperienceLevel] = useState(() => {
    const lvl = profile.experienceLevel ?? "";
    if (/senior|6|7|8|9|10/i.test(lvl)) return "Senior (6-10 years)";
    if (/mid|3|4|5/i.test(lvl)) return "Mid-level (3-6 years)";
    if (/junior|1|2/i.test(lvl)) return "Junior (1-3 years)";
    return "Fresher (0 years)";
  });
  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState(profile.resumeFileName || "");
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(profile.resumeAnalysis);
  const [hasResume, setHasResume] = useState(!!profile.resumeFileName || !!profile.resumeAnalysis);

  const [isUploading, setIsUploading] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedToHistory, setSavedToHistory] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const targetRoleMeta = TARGET_ROLES.find(r => r.value === targetRole)!;

  // Fetch current resume from server on mount
  useEffect(() => {
    fetch(`${base}/api/resume/current`, { credentials: "include" })
      .then(r => r.json())
      .then((data: {
        hasResume: boolean;
        fileName?: string;
        resumeText?: string;
        analysis?: ResumeAnalysis;
        experienceSummary?: string;
      }) => {
        if (data.hasResume) {
          setFileName(data.fileName || "");
          setResumeText(data.resumeText || "");
          setAnalysis(data.analysis || null);
          setHasResume(true);
        }
      })
      .catch(() => { /* ignore */ });
  }, [base]);

  const overallScore = analysis?.overallScore ?? 0;
  const g = scoreGrade(overallScore);

  const handleFileChange = useCallback(async (file: File) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError("File is too large. Maximum size is 5 MB.");
      return;
    }
    setError(null);
    setIsUploading(true);
    setIsAnalysing(false);
    setStreamText("");
    setAnalysis(null);
    setSavedToHistory(false);

    const form = new FormData();
    form.append("resume", file);

    try {
      const res = await fetch(`${base}/api/resume/upload`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json() as { success?: boolean; error?: string; wordCount?: number; charCount?: number };
      if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");
      setFileName(file.name);
      setHasResume(true);
      // We don't have the text yet; analysis will fetch it server-side
      setResumeText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, [base]);

  const analyse = useCallback(async () => {
    if (!hasResume && !resumeText.trim()) return;
    setIsAnalysing(true);
    setStreamText("");
    setError(null);
    setSavedToHistory(false);
    abortRef.current = new AbortController();

    try {
      // If user pasted text without uploading a file, save it first
      if (!hasResume && resumeText.trim()) {
        const saveRes = await fetch(`${base}/api/resume/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: resumeText.trim() }),
          credentials: "include",
        });
        if (!saveRes.ok) throw new Error("Failed to save resume text");
        setHasResume(true);
      }

      const res = await fetch(`${base}/api/resume/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole: targetRoleMeta.label, experienceLevel }),
        credentials: "include",
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error("Analysis request failed");

      let fullText = "";
      for await (const chunk of parseSSE(res)) {
        fullText += chunk;
        setStreamText(fullText);
      }

      // Try to parse final JSON from the accumulated text
      const cleaned = fullText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed: ResumeAnalysis = JSON.parse(cleaned);
      setAnalysis(parsed);
      track("Rozgar Samachar", `Resume analysis — ${targetRoleMeta.label}`, parsed.overallScore);

      // Sync to local profile state if server sync succeeded
      await updateProfile({
        resumeAnalysis: parsed,
        experienceSummary: parsed.experienceSummary,
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Analysis failed");
      }
    } finally {
      setIsAnalysing(false);
    }
  }, [hasResume, base, targetRoleMeta, experienceLevel, track, updateProfile]);

  const handleSave = useCallback(() => {
    if (!analysis) return;
    save({
      tool: "Rozgar Samachar",
      title: `Resume Analysis — ${targetRoleMeta.label} (${analysis.overallScore ?? "?"}/100)`,
      content: JSON.stringify(analysis, null, 2),
    });
    setSavedToHistory(true);
  }, [analysis, save, targetRoleMeta]);

  const downloadReport = useCallback(() => {
    if (!analysis) return;
    const content = [
      "EDUBHARAT — RESUME INTELLIGENCE REPORT",
      `Target Role: ${targetRoleMeta.label}`,
      `Experience Level: ${experienceLevel}`,
      `Date: ${new Date().toLocaleDateString("en-IN")}`,
      `Overall Score: ${analysis.overallScore ?? "N/A"}/100`,
      "",
      JSON.stringify(analysis, null, 2),
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume-analysis-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [analysis, targetRoleMeta, experienceLevel]);

  // ── Upload / analyse input view ───────────────────────────────────────────────
  return (
    <div className="min-h-full overflow-y-auto container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-display font-bold text-secondary mb-2">Resume Intelligence</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Upload your resume (PDF or DOCX) and get an AI-powered score, skill gaps, ATS tips, and improvement suggestions.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Target Role</label>
          <Select value={targetRole} onValueChange={setTargetRole} disabled={isAnalysing}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TARGET_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold">Experience Level</label>
          <Select value={experienceLevel} onValueChange={setExperienceLevel} disabled={isAnalysing}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPERIENCE_LEVELS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Upload zone */}
      <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors">
        <CardContent className="p-6">
          <label className="flex flex-col items-center justify-center cursor-pointer gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              {isUploading ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <Upload className="w-6 h-6 text-primary" />}
            </div>
            <div className="text-center">
              <p className="font-semibold text-secondary">{isUploading ? "Uploading…" : "Click or drop your resume here"}</p>
              <p className="text-xs text-muted-foreground mt-1">PDF or DOCX, up to 5 MB</p>
            </div>
            <input
              type="file"
              accept={ACCEPT_TYPES}
              className="hidden"
              disabled={isUploading || isAnalysing}
              onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            />
          </label>
        </CardContent>
      </Card>

      {/* Text input — always available, file upload or paste */}
      <div className="space-y-3">
        {fileName && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl text-sm">
            <FileText className="w-4 h-4 text-primary" />
            <span className="font-medium text-secondary">{fileName}</span>
            {hasResume && <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />}
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Or paste resume text directly</label>
          <Textarea
            placeholder="Paste your resume text here if you don't have a file..."
            className="min-h-[160px] text-sm font-mono"
            value={resumeText}
            onChange={e => setResumeText(e.target.value)}
            disabled={isAnalysing}
          />
          <p className="text-xs text-muted-foreground text-right">{resumeText.split(/\s+/).filter(Boolean).length} words</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={() => setError(null)}><X className="w-3 h-3" /></Button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          className="font-bold"
          onClick={analyse}
          disabled={(!hasResume && !resumeText.trim()) || isAnalysing || isUploading}
        >
          {isAnalysing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analysing…</> : <><Sparkles className="w-4 h-4 mr-2" />Analyse Resume</>}
        </Button>
        {analysis && (
          <>
            <Button variant="outline" onClick={downloadReport}><Download className="w-4 h-4 mr-2" />Download</Button>
            <Button variant={savedToHistory ? "secondary" : "outline"} onClick={handleSave} disabled={savedToHistory}>
              {savedToHistory ? <><CheckCircle2 className="w-4 h-4 mr-2" />Saved</> : <><Bookmark className="w-4 h-4 mr-2" />Save</>}
            </Button>
          </>
        )}
      </div>

      {/* Streaming preview */}
      {isAnalysing && streamText && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-primary mb-2">Analysing your resume…</p>
            <div className="text-sm text-secondary whitespace-pre-wrap leading-relaxed line-clamp-10">{streamText}</div>
          </CardContent>
        </Card>
      )}

      {/* Results scorecard */}
      {analysis && !isAnalysing && (
        <div className="space-y-6">
          <Card className={`border-2 ${g.bg}`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="text-center min-w-[100px]">
                  <div className={`text-6xl font-display font-extrabold ${g.color}`}>{overallScore}</div>
                  <div className={`text-xs font-bold uppercase tracking-wider ${g.color}`}>/100</div>
                </div>
                <div className="flex-1 min-w-[220px]">
                  <div className={`text-xl font-bold ${g.color} mb-2`}>{g.label} Resume</div>
                  <Progress value={overallScore} className="h-3 bg-white/70" />
                </div>
              </div>
            </CardContent>
          </Card>

          {analysis.experienceSummary && (
            <Card className="border bg-blue-50 border-blue-200">
              <CardContent className="p-4 flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-blue-800 mb-1">Experience Summary</p>
                  <p className="text-sm text-blue-900 leading-relaxed">{analysis.experienceSummary}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3">
            {SECTIONS.map(sec => {
              const items = stringArrayProp(analysis, sec.id);
              return items.length > 0 ? <SectionCard key={sec.id} sec={sec} items={items} /> : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
