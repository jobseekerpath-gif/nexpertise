import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useGeminiStream } from "@/lib/use-gemini-stream";
import { useHistory } from "@/lib/use-history";
import { useProgress } from "@/lib/use-progress";
import { useStudentProfile } from "@/lib/use-student-profile";
import {
  FileText, Loader2, Sparkles, CheckCircle2,
  Download, Bookmark, ChevronDown, ChevronUp, RefreshCw, Target,
  Zap, Shield, BookOpen, Briefcase, GraduationCap, User, Info,
  MessageCircle, Pencil,
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

const SAMPLE_RESUME = `Rahul Sharma
rahul.sharma@email.com | +91 9876543210 | Mumbai, Maharashtra
LinkedIn: linkedin.com/in/rahulsharma

OBJECTIVE
Seeking a challenging position as a Software Developer.

EDUCATION
B.Tech in Computer Science — Mumbai University (2022) — CGPA: 7.8/10

SKILLS
Java, Python, HTML, CSS, JavaScript, MySQL, Git

EXPERIENCE
Software Intern — TechStart Pvt Ltd (June 2022 – Dec 2022)
• Worked on backend development
• Fixed bugs and wrote code

PROJECT
Library Management System — Built using Java and MySQL

PERSONAL DETAILS
Date of Birth: 12 Jan 2000 | Father's Name: Mohan Sharma | Marital Status: Single`;

// ─── Section definitions ───────────────────────────────────────────────────────

type SectionDef = {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
};

const SECTIONS: SectionDef[] = [
  { id: "overall", title: "Overall Assessment", icon: Target, color: "text-primary" },
  { id: "contact", title: "Contact & Header", icon: User, color: "text-blue-600" },
  { id: "summary", title: "Professional Summary", icon: FileText, color: "text-purple-600" },
  { id: "skills", title: "Skills Section", icon: Zap, color: "text-orange-600" },
  { id: "experience", title: "Work Experience", icon: Briefcase, color: "text-green-600" },
  { id: "education", title: "Education", icon: GraduationCap, color: "text-teal-600" },
  { id: "ats", title: "ATS & Keywords", icon: Shield, color: "text-red-600" },
  { id: "india", title: "India-Specific Tips", icon: BookOpen, color: "text-amber-600" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse AI report into sections using positional string splitting.
 * Works by finding where each known heading appears in the text, then slicing.
 * Tolerates ## prefix and **bold** wrappers.
 */
function parseSections(text: string): Record<string, string> {
  if (!text) return {};
  // Normalise: strip markdown heading markers and bold wrappers for detection
  const normalised = text.replace(/#{1,3}\s*/g, "").replace(/\*{1,2}/g, "");
  const result: Record<string, string> = {};

  const positions: Array<{ id: string; start: number }> = [];
  for (const sec of SECTIONS) {
    const idx = normalised.toLowerCase().indexOf(sec.title.toLowerCase());
    if (idx !== -1) positions.push({ id: sec.id, start: idx });
  }
  positions.sort((a, b) => a.start - b.start);

  for (let i = 0; i < positions.length; i++) {
    const cur = positions[i]!;
    const next = positions[i + 1];
    const from = normalised.indexOf("\n", cur.start); // start after heading line
    const to = next ? next.start : normalised.length;
    if (from !== -1 && from < to) {
      result[cur.id] = normalised.slice(from, to).trim();
    }
  }
  return result;
}

/** Extract a resume score, anchored to a "Score:" label — avoids grabbing random percentages */
function extractScore(text: string): number | null {
  // Prefer "Score: XX" or "Score: XX/100" anchored patterns
  const anchored = text.match(/\bscore\s*[:\-]\s*(\d{1,3})\s*(?:\/\s*100)?/i);
  if (anchored) {
    const n = parseInt(anchored[1]!);
    return n >= 0 && n <= 100 ? n : null;
  }
  // Secondary: "XX/100" near the start of the section text only
  const bare = text.slice(0, 140).match(/\b(\d{1,3})\s*\/\s*100\b/);
  if (bare) {
    const n = parseInt(bare[1]!);
    return n >= 0 && n <= 100 ? n : null;
  }
  return null;
}

function scoreGrade(score: number): { label: string; color: string; bg: string } {
  if (score >= 85) return { label: "Excellent", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
  if (score >= 70) return { label: "Good", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" };
  if (score >= 55) return { label: "Average", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" };
  return { label: "Needs Work", color: "text-red-700", bg: "bg-red-50 border-red-200" };
}

// ─── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ sec, content, defaultOpen = false }: {
  sec: SectionDef; content: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const score = extractScore(content);
  const lines = content.split("\n").filter(l => l.trim());

  return (
    <Card className="border shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <sec.icon className={`w-4 h-4 shrink-0 ${sec.color}`} />
          <span className="font-semibold text-sm text-secondary">{sec.title}</span>
          {score !== null && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${scoreGrade(score).bg} ${scoreGrade(score).color}`}>
              {score}/100
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="border-t px-5 pb-5 pt-4 bg-muted/20 animate-in slide-in-from-top-1 space-y-2">
          {lines.map((line, i) => {
            const isPositive = /^[✅✔️+]|^strength|^good|^excellent/i.test(line.trim());
            const isWarning = /^[⚠️❌✗-]|^issue|^missing|^weak|^improve/i.test(line.trim());
            const isLabel = line.trim().endsWith(":");
            return (
              <p
                key={i}
                className={`text-sm leading-relaxed ${
                  isPositive ? "text-green-800" :
                  isWarning ? "text-red-800" :
                  isLabel ? "font-bold text-secondary" :
                  "text-secondary"
                }`}
              >
                {line}
              </p>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ResumeIntelligence() {
  const { save } = useHistory();
  const { track } = useProgress();
  const { profile: studentProfile } = useStudentProfile();
  const { text: streamText, isStreaming, stream, reset: resetStream } = useGeminiStream();

  const [resumeText, setResumeText] = useState("");
  const [targetRole, setTargetRole] = useState(
    () => TARGET_ROLES.find(r =>
      r.label.toLowerCase().includes((studentProfile.preferredRole ?? "").toLowerCase())
    )?.value ?? "fresher_general"
  );
  const [experienceLevel, setExperienceLevel] = useState(() => {
    const lvl = studentProfile.experienceLevel ?? "";
    if (/senior|6|7|8|9|10/i.test(lvl)) return "Senior (6-10 years)";
    if (/mid|3|4|5/i.test(lvl)) return "Mid-level (3-6 years)";
    if (/junior|1|2/i.test(lvl)) return "Junior (1-3 years)";
    return "Fresher (0 years)";
  });
  const [phase, setPhase] = useState<"input" | "analyzing" | "results">("input");
  const [reportText, setReportText] = useState("");
  const [savedToHistory, setSavedToHistory] = useState(false);

  const targetRoleMeta = TARGET_ROLES.find(r => r.value === targetRole)!;

  const parsed = useMemo(() => parseSections(reportText), [reportText]);
  const overallScore = useMemo(() => extractScore(parsed["overall"] ?? reportText), [parsed, reportText]);

  const analyze = useCallback(async () => {
    if (!resumeText.trim()) return;
    setPhase("analyzing");
    setSavedToHistory(false);
    resetStream();

    const role = targetRoleMeta.label;
    const full = await stream(
      `Analyze this resume for a ${role} role at ${experienceLevel} level. The candidate is in India.

RESUME:
${resumeText}

Write a detailed analysis with EXACTLY these 8 sections using these EXACT headings (no markdown, just plain text):

Overall Assessment:
Score: XX/100. Give 3-4 sentences on overall quality and first impression.

Contact & Header:
Score: XX/100. Review contact section: professional email, phone (+91), LinkedIn, location, portfolio.

Professional Summary:
Score: XX/100. Evaluate the objective/summary. Suggest a specific 2-3 line summary tailored to ${role}.

Skills Section:
Score: XX/100. List matched skills vs missing must-have skills for ${role}. Add 5 specific skills to include.

Work Experience:
Score: XX/100. Review work descriptions. Check: quantified achievements, action verbs, STAR format. Rewrite 2 bullets.

Education:
Score: XX/100. Review education: CGPA (8+ preferred in India), certifications, relevant coursework, projects.

ATS & Keywords:
Score: XX/100. List 10 ATS keywords for ${role} in India. Identify missing ones and where to add them.

India-Specific Tips:
Give 5 India-specific tips. Cover: remove DOB/father's name/marital status (illegal to ask), Naukri vs LinkedIn, one-page for freshers, font choice.

Be specific and actionable. Use checkmarks (✅) for positives and (❌) for issues.`,
      `You are India's top resume expert with 15 years of experience helping candidates at companies like TCS, Infosys, Flipkart, and startups. Be specific, direct, and India-aware.`
    );

    if (!full.trim()) {
      setPhase("input");
      return;
    }

    setReportText(full);
    track("Rozgar Samachar", `Resume analysis — ${role}`);
    setPhase("results");
  }, [resumeText, targetRole, experienceLevel, stream, resetStream, track, targetRoleMeta]);

  const handleSave = useCallback(() => {
    if (!reportText) return;
    save({
      tool: "Rozgar Samachar",
      title: `Resume Analysis — ${targetRoleMeta.label} (Score: ${overallScore ?? "?"}/100)`,
      content: `TARGET ROLE: ${targetRoleMeta.label}\nEXPERIENCE: ${experienceLevel}\nDATE: ${new Date().toLocaleDateString("en-IN")}\n\n${reportText}`,
    });
    setSavedToHistory(true);
  }, [reportText, save, targetRoleMeta, experienceLevel, overallScore]);

  const downloadReport = useCallback(() => {
    if (!reportText) return;
    const scoreStr = overallScore !== null ? `${overallScore}/100 — ${scoreGrade(overallScore).label}` : "N/A";
    const content = [
      "EDUBHARAT — RESUME INTELLIGENCE REPORT",
      `Target Role: ${targetRoleMeta.label}`,
      `Experience Level: ${experienceLevel}`,
      `Date: ${new Date().toLocaleDateString("en-IN")}`,
      `Overall Score: ${scoreStr}`,
      "",
      reportText,
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume-analysis-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [reportText, targetRoleMeta, experienceLevel, overallScore]);

  // ── Input / analyzing ────────────────────────────────────────────────────────
  if (phase !== "results") {
    return (
      <div className="min-h-full overflow-y-auto container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-display font-bold text-secondary mb-2">Resume Intelligence</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            AI-powered resume analysis for Indian job seekers — score, skill gaps, ATS tips, and section-by-section improvements.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Target Role</label>
            <Select value={targetRole} onValueChange={setTargetRole} disabled={phase === "analyzing"}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARGET_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Experience Level</label>
            <Select value={experienceLevel} onValueChange={setExperienceLevel} disabled={phase === "analyzing"}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPERIENCE_LEVELS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Paste Your Resume Here</label>
            <Button
              variant="ghost" size="sm" className="text-xs text-muted-foreground"
              onClick={() => setResumeText(SAMPLE_RESUME)}
              disabled={phase === "analyzing"}
            >
              <Sparkles className="w-3 h-3 mr-1" />Try sample resume
            </Button>
          </div>
          <Textarea
            placeholder={`Paste your complete resume text here — name, contact info, education, skills, experience, projects, and achievements.\n\nTip: Copy from Word / PDF / Google Docs and paste as plain text.`}
            className="min-h-[320px] text-sm leading-relaxed font-mono resize-none"
            value={resumeText}
            onChange={e => setResumeText(e.target.value)}
            disabled={phase === "analyzing"}
          />
          <p className="text-xs text-muted-foreground text-right">
            {resumeText.length} characters · ~{resumeText.split(/\s+/).filter(Boolean).length} words
          </p>
        </div>

        {phase === "analyzing" && streamText && (
          <Card className="border-primary/20 bg-primary/5 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />Analysing your resume…
              </div>
              <div className="text-sm text-secondary whitespace-pre-wrap leading-relaxed line-clamp-10">
                {streamText}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            className="w-full sm:w-auto h-12 px-8 font-bold text-base shadow-md shadow-primary/20"
            onClick={analyze}
            disabled={!resumeText.trim() || phase === "analyzing"}
          >
            {phase === "analyzing"
              ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Analysing…</>
              : <><Sparkles className="w-5 h-5 mr-2" />Analyse Resume</>}
          </Button>
          {resumeText && phase !== "analyzing" && (
            <Button variant="outline" onClick={() => setResumeText("")} className="text-sm">Clear</Button>
          )}
        </div>

        <Card className="mt-8 border bg-muted/30">
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">What you'll get</p>
            <div className="grid sm:grid-cols-2 gap-2 text-sm text-secondary">
              {[
                "📊 Overall resume score (0-100)",
                "🎯 Role-specific skill gap analysis",
                "🤖 ATS keyword optimisation for Naukri & LinkedIn",
                "✍️ Section-by-section rewrites & suggestions",
                "🇮🇳 India-specific tips (remove DOB, father's name etc.)",
                "📥 Downloadable report",
              ].map(tip => <div key={tip}>{tip}</div>)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────────
  const g = overallScore !== null ? scoreGrade(overallScore) : null;
  const hasParsed = Object.keys(parsed).length >= 3;

  return (
    <div className="min-h-full overflow-y-auto container mx-auto px-4 py-8 max-w-4xl space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-secondary">Resume Analysis Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {targetRoleMeta.label} · {experienceLevel} · {new Date().toLocaleDateString("en-IN")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setPhase("input"); resetStream(); setReportText(""); }}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />New Analysis
          </Button>
          <Button variant="outline" size="sm" onClick={downloadReport}>
            <Download className="w-3.5 h-3.5 mr-1.5" />Download
          </Button>
          <Button variant={savedToHistory ? "secondary" : "default"} size="sm" onClick={handleSave} disabled={savedToHistory}>
            {savedToHistory
              ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-primary" />Saved</>
              : <><Bookmark className="w-3.5 h-3.5 mr-1.5" />Save to History</>}
          </Button>
        </div>
      </div>

      {/* Score hero */}
      {overallScore !== null && g && (
        <Card className={`border-2 ${g.bg}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-center min-w-[80px]">
                <div className={`text-5xl font-display font-extrabold ${g.color}`}>{overallScore}</div>
                <div className={`text-xs font-bold uppercase tracking-wider ${g.color}`}>/100</div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className={`text-lg font-bold ${g.color} mb-2`}>{g.label} Resume</div>
                <Progress value={overallScore} className="h-3 bg-white/70" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Needs Work</span><span>Average</span><span>Good</span><span>Excellent</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-center">
                {(["contact", "skills", "experience", "ats"] as const).map(id => {
                  const s = extractScore(parsed[id] ?? "");
                  const label = SECTIONS.find(sec => sec.id === id)?.title.split(" ")[0] ?? id;
                  return (
                    <div key={id} className="bg-white/60 rounded-xl p-2">
                      <div className="font-bold text-secondary">{s ?? "—"}</div>
                      <div className="text-muted-foreground">{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick wins */}
      <Card className="border bg-amber-50 border-amber-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-bold text-amber-800">Quick Wins — implement these today</p>
          </div>
          <ul className="text-sm text-amber-900 space-y-1 list-disc list-inside">
            <li>Remove personal details: DOB, Father's name, Marital status — irrelevant and unprofessional</li>
            <li>Replace objective with a 2-line professional summary tailored to {targetRoleMeta.label}</li>
            <li>Add quantified achievements: "Reduced load time by 40%" not "Improved performance"</li>
            <li>Keep it 1 page (fresher) or 2 pages max (3+ years experience)</li>
            <li>Upload the same updated version to both Naukri.com and LinkedIn</li>
          </ul>
        </CardContent>
      </Card>

      {/* Section breakdown */}
      {hasParsed ? (
        <div className="space-y-3">
          {SECTIONS.map((sec, i) => {
            const content = parsed[sec.id];
            if (!content) return null;
            return <SectionCard key={sec.id} sec={sec} content={content} defaultOpen={i < 2} />;
          })}
        </div>
      ) : (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />Full Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-sm text-secondary whitespace-pre-wrap leading-relaxed">{reportText}</div>
          </CardContent>
        </Card>
      )}

      {/* CTA */}
      <Card className="border bg-primary/5 border-primary/20">
        <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 text-center sm:text-left">
            <p className="font-bold text-secondary">Ready to practise the interview?</p>
            <p className="text-sm text-muted-foreground">Use Interview Ace to rehearse for {targetRoleMeta.label} roles</p>
          </div>
          <Button asChild className="shrink-0 font-bold">
            <a href="/interview-ace">Go to Interview Ace →</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
