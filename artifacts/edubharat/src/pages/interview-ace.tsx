import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useHistory } from "@/lib/use-history";
import { useGeminiStream } from "@/lib/use-gemini-stream";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { useSpeechSynthesis } from "@/lib/use-speech-synthesis";
import { useStudentProfile } from "@/lib/use-student-profile";
import { useAuth } from "@/lib/use-auth";
import { AnimatedAvatar } from "@/components/avatar";
import { INTERVIEW_COACHES } from "@/lib/tutors";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import {
  Loader2, Mic, MicOff, PlayCircle, ChevronRight, Download, Volume2,
  LogOut, CheckCircle2, ChevronDown, MessageCircle, Pencil, Flame, Brain,
  Star, Trophy, Clock, Timer, AlertCircle, Save,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────

const INTERVIEW_TYPES = [
  { value: "hr", label: "HR Interview", icon: "🤝" },
  { value: "software", label: "Software Developer", icon: "💻" },
  { value: "sales", label: "Sales Executive", icon: "📈" },
  { value: "marketing", label: "Marketing Manager", icon: "📣" },
  { value: "customer_service", label: "Customer Service", icon: "🎧" },
  { value: "banking", label: "Banking / BFSI", icon: "🏦" },
  { value: "insurance", label: "Insurance", icon: "🛡️" },
  { value: "operations", label: "Operations", icon: "⚙️" },
  { value: "data_analytics", label: "Data Analytics", icon: "📊" },
  { value: "finance", label: "Finance / CA", icon: "💰" },
  { value: "freshers", label: "Freshers / Campus", icon: "🎓" },
  { value: "government", label: "Government / SSC / UPSC", icon: "🏛️" },
];

const EXPERIENCE_LEVELS = ["Fresher", "1-2 years", "3-5 years", "5+ years"];
const DURATIONS = [
  { value: 15, label: "15 minutes", questions: "~4-5 questions" },
  { value: 30, label: "30 minutes", questions: "~8-10 questions" },
  { value: 45, label: "45 minutes", questions: "~12-15 questions" },
];

// ─── Types ─────────────────────────────────────────────────────────────────────

type SubScores = {
  communication?: number;
  grammar?: number;
  confidence?: number;
  technical?: number;
};

type QA = {
  question: string;
  answer?: string;
  feedback?: string;
  score?: number;
} & SubScores;

type Coach = typeof INTERVIEW_COACHES[number];

type InterviewReport = {
  overallScore: number;
  communicationScore: number;
  grammarScore: number;
  confidenceScore: number;
  technicalScore: number;
  roleFit: string;
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSubScore(text: string, key: string): number | undefined {
  const pattern = new RegExp(`\\b${key}\\b[^\\d]{0,10}(\\d{1,2})(?:\\s*\\/\\s*10)?`, "i");
  const m = text.match(pattern);
  if (!m) return undefined;
  const n = parseInt(m[1]!);
  return n >= 1 && n <= 10 ? n : undefined;
}

function avgOf(nums: (number | undefined)[]): number {
  const valid = nums.filter((n): n is number => n !== undefined);
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 0;
}

function grade(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: "Outstanding", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
  if (score >= 80) return { label: "Excellent", color: "text-green-700", bg: "bg-green-50 border-green-200" };
  if (score >= 70) return { label: "Good", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" };
  if (score >= 60) return { label: "Average", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" };
  if (score >= 50) return { label: "Below Average", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" };
  return { label: "Needs Work", color: "text-red-700", bg: "bg-red-50 border-red-200" };
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function parseReportJson(text: string): InterviewReport | null {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return {
      overallScore: Math.min(100, Math.max(0, Number(parsed["overallScore"]) || 0)),
      communicationScore: Math.min(100, Math.max(0, Number(parsed["communicationScore"]) || 0)),
      grammarScore: Math.min(100, Math.max(0, Number(parsed["grammarScore"]) || 0)),
      confidenceScore: Math.min(100, Math.max(0, Number(parsed["confidenceScore"]) || 0)),
      technicalScore: Math.min(100, Math.max(0, Number(parsed["technicalScore"]) || 0)),
      roleFit: String(parsed["roleFit"] || ""),
      strengths: Array.isArray(parsed["strengths"]) ? parsed["strengths"].map(String) : [],
      improvements: Array.isArray(parsed["improvements"]) ? parsed["improvements"].map(String) : [],
      nextSteps: Array.isArray(parsed["nextSteps"]) ? parsed["nextSteps"].map(String) : [],
    };
  } catch { return null; }
}

// ─── Small components ─────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const g = grade(score);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold border ${g.bg} ${g.color}`}>
      {score}%
    </span>
  );
}

function SkillBar({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className={`flex items-center gap-1.5 text-xs font-bold ${color}`}>
          <Icon className="w-3 h-3" />{label}
        </div>
        <span className={`text-xs font-bold ${color}`}>{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}

function AvatarBar({ coach, isSpeaking, isThinking, className = "" }: {
  coach: Coach; isSpeaking: boolean; isThinking: boolean; className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 bg-card rounded-xl border shadow-sm ${className}`}>
      <AnimatedAvatar
        name={coach.name}
        role={coach.role}
        isSpeaking={isSpeaking}
        isThinking={isThinking}
        gender={coach.gender}
        size="md"
        imageSrc={coach.imageSrc}
      />
      <div className="min-w-0">
        <p className="font-bold text-sm text-secondary">{coach.name}</p>
        <p className="text-xs text-muted-foreground">{coach.role}</p>
        {isThinking && <span className="text-xs text-primary animate-pulse">Thinking...</span>}
        {isSpeaking && !isThinking && <span className="text-xs text-primary animate-pulse">Speaking...</span>}
      </div>
    </div>
  );
}

function TimerDisplay({ elapsedSeconds, durationMinutes }: { elapsedSeconds: number; durationMinutes: number }) {
  const totalSeconds = durationMinutes * 60;
  const pct = Math.min(100, (elapsedSeconds / totalSeconds) * 100);
  const remaining = totalSeconds - elapsedSeconds;
  const isEnding = remaining <= 120;
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-1.5 text-sm font-bold ${isEnding ? "text-red-600" : "text-muted-foreground"}`}>
        <Timer className="w-4 h-4" />
        {formatTime(elapsedSeconds)} / {durationMinutes} min
      </div>
      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${isEnding ? "bg-red-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RingChart({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={radius} stroke="#e2e8f0" strokeWidth="6" fill="none" />
          <circle
            cx="40" cy="40" r={radius}
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            style={{ strokeDasharray: circumference, strokeDashoffset: offset, transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-secondary">{value}%</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function InterviewAce() {
  return (
    <>
      <PageMeta
        title="Interview Ace"
        description="Practice mock interviews with AI. Get voice feedback, detailed scores, and personalised improvement tips for Indian roles."
      />
      <InterviewAceContent />
    </>
  );
}

function InterviewAceContent() {
  const { save } = useHistory();
  const { text: streamText, isStreaming, stream, reset: resetStream } = useGeminiStream();
  const synth = useSpeechSynthesis();
  const speech = useSpeechRecognition("English");
  const { profile } = useStudentProfile();
  const { user } = useAuth();
  const { toast } = useToast();

  const mapExperience = (raw: string): string => {
    if (/5\+|senior|6|7|8|9|10/i.test(raw)) return "5+ years";
    if (/3|4|5\s*year/i.test(raw)) return "3-5 years";
    if (/1|2/i.test(raw)) return "1-2 years";
    return "Fresher";
  };

  const mapPreferredRoleToType = (role: string): string => {
    const r = role.toLowerCase();
    if (r.includes("software") || r.includes("developer") || r.includes("engineer") || r.includes("tech")) return "software";
    if (r.includes("sales")) return "sales";
    if (r.includes("market")) return "marketing";
    if (r.includes("customer") || r.includes("support")) return "customer_service";
    if (r.includes("bank") || r.includes("finance") || r.includes("bfsi")) return "banking";
    if (r.includes("data") || r.includes("analytic")) return "data_analytics";
    if (r.includes("insurance")) return "insurance";
    if (r.includes("operation")) return "operations";
    if (r.includes("government") || r.includes("ssc") || r.includes("upsc")) return "government";
    if (r.includes("fresher") || r.includes("campus")) return "freshers";
    return INTERVIEW_TYPES[0]!.value;
  };

  const [type, setType] = useState(() => mapPreferredRoleToType(profile.preferredRole));
  const [experience, setExperience] = useState(() => mapExperience(profile.experienceLevel));
  const [coach, setCoach] = useState<Coach>(() => {
    const preferred = profile.preferredInterviewer;
    return INTERVIEW_COACHES.find(c => c.id === preferred) ?? INTERVIEW_COACHES[0]!;
  });
  const [duration, setDuration] = useState(15);
  const [phase, setPhase] = useState<"setup" | "interview" | "report">("setup");
  const [questions, setQuestions] = useState<QA[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [autoListenEnabled, setAutoListenEnabled] = useState(true);
  const [sessionStart, setSessionStart] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const autoSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerRef = useRef("");

  const typeMeta = INTERVIEW_TYPES.find(t => t.value === type)!;
  const currentQ = questions[currentIdx];
  const answeredCount = questions.filter(q => q.feedback).length;

  useEffect(() => { answerRef.current = answer; }, [answer]);

  // Live timer during interview
  useEffect(() => {
    if (phase !== "interview") return;
    const id = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - sessionStart) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase, sessionStart]);

  // Auto-end when duration is up and current answer is processed
  useEffect(() => {
    if (phase !== "interview") return;
    const durationSeconds = duration * 60;
    if (elapsedSeconds >= durationSeconds && currentQ && !currentQ.feedback && !isStreaming && !isRecording) {
      // No active answer being processed; end the interview
      setPhase("report");
    }
  }, [elapsedSeconds, duration, phase, currentQ, isStreaming, isRecording]);

  const clearAutoSubmitTimer = useCallback(() => {
    if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current);
    autoSubmitRef.current = null;
  }, []);

  useEffect(() => {
    if (currentQ?.feedback || phase !== "interview" || isStreaming || synth.isSpeaking) {
      clearAutoSubmitTimer();
      if (isRecording) { setIsRecording(false); speech.stop(); }
    }
  }, [currentQ?.feedback, phase, isStreaming, synth.isSpeaking, isRecording, speech, clearAutoSubmitTimer]);

  useEffect(() => { return () => clearAutoSubmitTimer(); }, [clearAutoSubmitTimer]);

  const buildProfileSummary = useCallback(() => {
    return [
      `Name: ${profile.name || "Candidate"}`,
      `Education: ${profile.degree || "Not specified"}`,
      `Experience: ${experience}`,
      `Career goal: ${profile.careerGoal || typeMeta.label}`,
      `Preferred role: ${profile.preferredRole || typeMeta.label}`,
      `Industry: ${profile.industryPreference || "Not specified"}`,
      `Skills: ${(profile.skills || []).join(", ") || "Not specified"}`,
      `English level: ${profile.englishLevel || "Beginner"}`,
    ].join(" | ");
  }, [profile, experience, typeMeta]);

  const buildTranscript = useCallback((upToIndex: number) => {
    return questions
      .slice(0, upToIndex + 1)
      .map((q, i) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.answer ?? "(not answered)"}`)
      .join("\n\n");
  }, [questions]);

  const startSession = useCallback(async () => {
    resetStream();
    const full = await stream(
      `You are starting a ${duration}-minute mock interview for a ${typeMeta.label} role in India for a ${experience} candidate.

Candidate profile: ${buildProfileSummary()}

Generate ONLY the first opening question. Make it natural, warm, and specific to the role and candidate level. Do not include any intro, numbering, or explanation — just the question itself.`,
      `You are ${coach.name}, ${coach.role}. ${coach.style}. Conduct a realistic Indian hiring interview. Be warm but professional. Ask one question at a time. Do not add filler text.`,
      undefined,
      { maxTokens: 250 }
    );
    const question = full.replace(/^\s*["']?|["']?\s*$/g, "").trim();
    if (!question) return;
    setQuestions([{ question }]);
    setCurrentIdx(0);
    setAnswer("");
    setIsRecording(false);
    setAutoListenEnabled(true);
    setSessionStart(Date.now());
    setElapsedSeconds(0);
    setReport(null);
    setSaved(false);
    setPhase("interview");
    setTimeout(() => synth.speak(question, "English"), 300);
  }, [typeMeta, experience, duration, coach, stream, resetStream, synth, buildProfileSummary]);

  const toggleRecording = useCallback(() => {
    if (autoListenEnabled) {
      setAutoListenEnabled(false);
      clearAutoSubmitTimer();
      setIsRecording(false);
      speech.stop();
      return;
    }
    setAutoListenEnabled(true);
  }, [autoListenEnabled, clearAutoSubmitTimer, speech]);

  const submitCurrentAnswer = useCallback(async (userAnswer: string) => {
    if (!userAnswer || !currentQ) return;
    clearAutoSubmitTimer();
    setIsRecording(false);
    speech.stop();
    setAnswer("");
    const label = typeMeta.label;
    resetStream();

    const elapsedMin = Math.floor(elapsedSeconds / 60);
    const remainingMin = duration - elapsedMin;
    const shouldWrap = remainingMin <= 2;

    const feedback = await stream(
      `Interview context: ${label}, ${experience}, ${duration} minutes total. ${remainingMin} minutes remaining. ${shouldWrap ? "This is the final answer of the interview — provide feedback and then stop." : "Provide feedback and then ask exactly one natural follow-up question."}

Candidate profile: ${buildProfileSummary()}

Transcript so far:
${buildTranscript(currentIdx - 1)}

Current question: ${currentQ.question}
Candidate's answer: "${userAnswer}"

Return EXACTLY these sections (no extras, no markdown):
Reaction: one warm sentence acknowledging the answer.
Score: X/10 (overall answer quality)
Communication: X/10
Grammar: X/10
Confidence: X/10
Technical: X/10
Strengths: 2 short bullets
Improvements: 2 short bullets
Ideal Answer: 2-3 line model answer
${shouldWrap ? "Final: END" : "Next Question: one adaptive follow-up question based on this answer"}

Keep it human, realistic, and encouraging. Use Indian hiring context.`,
      `You are ${coach.name}, ${coach.role}. ${coach.style}. Give natural feedback and ask sharp, adaptive follow-up questions.`,
      undefined,
      { maxTokens: 700 }
    );

    const scoreMatch = feedback.match(/^score[:\s]+(\d+)/im) ?? feedback.match(/(\d+)\s*\/\s*10/i);
    const score = scoreMatch ? Math.min(10, Math.max(1, parseInt(scoreMatch[1]!))) : 6;
    const communication = parseSubScore(feedback, "Communication");
    const grammar = parseSubScore(feedback, "Grammar");
    const confidence = parseSubScore(feedback, "Confidence");
    const technical = parseSubScore(feedback, "Technical");

    const nextMatch = feedback.match(/Next Question:\s*(.+)/is);
    const nextQuestion = nextMatch ? nextMatch[1].trim() : undefined;
    const isFinal = /Final:\s*END/i.test(feedback) || shouldWrap || !nextQuestion;

    setQuestions(prev => prev.map((q, i) => i === currentIdx
      ? { ...q, answer: userAnswer, feedback, score, communication, grammar, confidence, technical }
      : q
    ));

    // Add next question if available and not final
    if (nextQuestion && !isFinal) {
      setQuestions(prev => [...prev, { question: nextQuestion }]);
    }

    const opening = feedback.split("\n")[0]?.replace(/^Reaction:\s*/i, "").trim() ?? feedback.slice(0, 140);
    void synth.speak(opening, "English");

    if (isFinal) {
      setTimeout(() => setPhase("report"), 800);
    }
  }, [currentQ, currentIdx, type, experience, duration, elapsedSeconds, coach, stream, resetStream, synth, typeMeta, buildProfileSummary, buildTranscript, clearAutoSubmitTimer, speech]);

  const submitAnswer = useCallback(() => {
    if (!answer.trim()) return;
    void submitCurrentAnswer(answer.trim());
  }, [answer, submitCurrentAnswer]);

  const nextQuestion = useCallback(() => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= questions.length) { setPhase("report"); return; }
    setCurrentIdx(nextIdx);
    setAnswer("");
    setIsRecording(false);
    clearAutoSubmitTimer();
    resetStream();
    setTimeout(() => synth.speak(questions[nextIdx]!.question, "English"), 300);
  }, [currentIdx, questions, resetStream, synth, clearAutoSubmitTimer]);

  const endEarly = useCallback(() => {
    clearAutoSubmitTimer();
    speech.stop();
    setIsRecording(false);
    setAutoListenEnabled(false);
    setPhase("report");
  }, [speech, clearAutoSubmitTimer]);

  useEffect(() => {
    if (phase !== "interview" || !autoListenEnabled || !speech.isSupported || !currentQ || currentQ.feedback || isStreaming || synth.isSpeaking || isRecording) return;
    setIsRecording(true);
    speech.startContinuous(text => {
      const chunk = text.trim();
      if (!chunk) return;
      setAnswer(prev => {
        const next = `${prev ? `${prev} ` : ""}${chunk}`.trim();
        answerRef.current = next;
        return next;
      });
      clearAutoSubmitTimer();
      autoSubmitRef.current = setTimeout(() => {
        const latest = answerRef.current.trim();
        if (latest) void submitCurrentAnswer(latest);
      }, 1500);
    });
    return () => { clearAutoSubmitTimer(); };
  }, [phase, currentQ, autoListenEnabled, speech, isStreaming, synth.isSpeaking, isRecording, submitCurrentAnswer, clearAutoSubmitTimer]);

  // Generate detailed report when entering report phase
  useEffect(() => {
    if (phase !== "report" || report || isGeneratingReport) return;
    const answered = questions.filter(q => q.feedback);
    if (answered.length === 0) return;
    setIsGeneratingReport(true);

    const generate = async () => {
      const transcript = answered
        .map((q, i) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.answer ?? ""}\nFeedback: ${q.feedback ?? ""}`)
        .join("\n\n");

      const reportText = await stream(
        `You are an expert interview evaluator. Review the full mock interview transcript and produce a detailed structured report.

Role: ${typeMeta.label}
Candidate experience: ${experience}
Duration: ${formatTime(elapsedSeconds)}
Transcript:
${transcript}

Return ONLY a valid JSON object with these exact keys:
{
  "overallScore": number 0-100,
  "communicationScore": number 0-100,
  "grammarScore": number 0-100,
  "confidenceScore": number 0-100,
  "technicalScore": number 0-100,
  "roleFit": "short sentence",
  "strengths": ["string", "string", "string"],
  "improvements": ["string", "string", "string"],
  "nextSteps": ["string", "string", "string"]
}

Be fair but honest. Use the full conversation to judge improvement and consistency.`,
        `You are a senior hiring manager and interview coach. Evaluate an Indian candidate fairly.`,
        undefined,
        { maxTokens: 1200 }
      );

      const parsed = parseReportJson(reportText) ?? {
        overallScore: Math.round(avgOf(answered.map(q => q.score)) * 10),
        communicationScore: avgOf(answered.map(q => q.communication)) * 10,
        grammarScore: avgOf(answered.map(q => q.grammar)) * 10,
        confidenceScore: avgOf(answered.map(q => q.confidence)) * 10,
        technicalScore: avgOf(answered.map(q => q.technical)) * 10,
        roleFit: "Promising candidate with room to grow.",
        strengths: ["Participated actively in the mock interview", "Provided structured answers", "Showed willingness to learn"],
        improvements: ["Add more specific examples", "Tighten language clarity", "Work on concise delivery"],
        nextSteps: ["Practice STAR method answers", "Record yourself and review", "Schedule another mock interview next week"],
      };

      setReport(parsed);
      setIsGeneratingReport(false);
      await saveSession(parsed, answered);
    };

    void generate();
  }, [phase, report, isGeneratingReport, questions, typeMeta, experience, elapsedSeconds, stream, coach]);

  const saveSession = useCallback(async (reportData: InterviewReport, answered: QA[]) => {
    if (saved) return;
    setIsSaving(true);
    const durationSeconds = elapsedSeconds;
    const payload = {
      role: profile.preferredRole || typeMeta.label,
      experienceLevel: experience,
      interviewType: typeMeta.label,
      questionsData: JSON.stringify(answered),
      overallScore: reportData.overallScore,
      durationSeconds,
      feedbackJson: JSON.stringify(reportData),
      communicationScore: reportData.communicationScore,
      grammarScore: reportData.grammarScore,
      confidenceScore: reportData.confidenceScore,
      technicalScore: reportData.technicalScore,
    };

    // Save to localStorage as fallback / offline
    try {
      const key = "edubharat_interview_sessions";
      const existing = JSON.parse(localStorage.getItem(key) || "[]") as Array<Record<string, unknown>>;
      existing.unshift({ ...payload, savedAt: new Date().toISOString(), local: true });
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
    } catch { /* ignore */ }

    if (user) {
      try {
        const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
        const res = await fetch(`${base}/api/sessions/interview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Server save failed");
        toast({ title: "Report saved", description: "Your interview report is synced to your account." });
      } catch {
        toast({ title: "Saved locally", description: "Report saved on this device. Sign in to sync across devices.", variant: "destructive" });
      }
    }
    setSaved(true);
    setIsSaving(false);
  }, [saved, elapsedSeconds, profile.preferredRole, typeMeta, experience, user, toast]);

  const downloadReport = useCallback(() => {
    const label = typeMeta.label;
    const answered = questions.filter(q => q.feedback);
    const durationMin = Math.round(elapsedSeconds / 60);
    const avgScore = avgOf(answered.map(q => q.score)) * 10;
    const lines = [
      `EDUBHARAT — INTERVIEW ACE REPORT`,
      `Coach: ${coach.name} (${coach.role})`,
      `Role: ${label} | Experience: ${experience} | Duration: ${durationMin} min`,
      `Date: ${new Date().toLocaleDateString("en-IN")}`,
      report ? `Overall Score: ${report.overallScore}% — ${grade(report.overallScore).label}` : `Overall Score: ${avgScore}% — ${grade(avgScore).label}`,
      ``,
      `SKILL BREAKDOWN`,
      report ? `Communication: ${report.communicationScore}%` : "Communication: N/A",
      report ? `Grammar: ${report.grammarScore}%` : "Grammar: N/A",
      report ? `Confidence: ${report.confidenceScore}%` : "Confidence: N/A",
      report ? `Technical: ${report.technicalScore}%` : "Technical: N/A",
      report ? `Role Fit: ${report.roleFit}` : "Role Fit: N/A",
      ``,
      `STRENGTHS`,
      ...(report ? report.strengths : []),
      ``,
      `AREAS TO IMPROVE`,
      ...(report ? report.improvements : []),
      ``,
      `NEXT STEPS`,
      ...(report ? report.nextSteps : []),
      ``,
      `QUESTION-BY-QUESTION`,
      ...answered.map((q, i) => [
        `Q${i + 1}: ${q.question}`,
        `Your Answer: ${q.answer ?? ""}`,
        `Score: ${q.score ?? "N/A"}/10`,
        ...(q.communication !== undefined ? [`  Communication: ${q.communication}/10 | Grammar: ${q.grammar}/10 | Confidence: ${q.confidence}/10 | Technical: ${q.technical}/10`] : []),
        `Feedback:\n${q.feedback ?? ""}`,
        "",
      ].join("\n")),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-${label.toLowerCase().replace(/ /g, "-")}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [questions, type, experience, elapsedSeconds, typeMeta, coach, report]);

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="min-h-full overflow-y-auto container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-bold text-secondary mb-2">Interview Ace</h1>
          <p className="text-muted-foreground">AI mock interviews with instant feedback · Voice-powered · India-focused</p>
        </div>

        {/* Coach selection */}
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Choose Your Interviewer
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {INTERVIEW_COACHES.map(c => (
              <button
                key={c.id}
                onClick={() => setCoach(c)}
                className={`text-left rounded-2xl border-2 p-4 transition-all hover:shadow-md ${
                  coach.id === c.id
                    ? "border-primary shadow-md bg-primary/5"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <AnimatedAvatar
                    name={c.name}
                    role={c.role}
                    isSpeaking={false}
                    gender={c.gender}
                    size="sm"
                    imageSrc={c.imageSrc}
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-secondary truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.role}</p>
                  </div>
                  {coach.id === c.id && <CheckCircle2 className="w-4 h-4 text-primary ml-auto shrink-0" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">{c.icon}</span>
                  <span className="text-xs font-semibold text-secondary">{c.specialty}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{c.style}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 p-4 rounded-2xl bg-muted/40 border text-sm text-secondary italic">
            "{coach.intro}"
          </div>
        </div>

        <Card className="max-w-lg mx-auto shadow-xl border-none">
          <CardHeader>
            <CardTitle>Configure Your Session</CardTitle>
            <CardDescription>Duration-based · Adaptive questions · Detailed AI report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Interview Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>{INTERVIEW_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Experience Level</label>
              <Select value={experience} onValueChange={setExperience}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>{EXPERIENCE_LEVELS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Interview Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {DURATIONS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setDuration(d.value)}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${
                      duration === d.value
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-bold text-secondary">
                      <Clock className="w-4 h-4" />
                      {d.label}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{d.questions}</p>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full h-12 font-bold text-base shadow-md shadow-primary/20" onClick={startSession} disabled={isStreaming}>
              {isStreaming
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Preparing session...</>
                : <><PlayCircle className="w-5 h-5 mr-2" />Begin with {coach.name}</>}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  if (phase === "report") {
    const answered = questions.filter(q => q.feedback);
    const avgScore = avgOf(answered.map(q => q.score)) * 10;
    const g = report ? grade(report.overallScore) : grade(avgScore);
    const displayScore = report ? report.overallScore : avgScore;
    const durationMin = Math.round(elapsedSeconds / 60);

    return (
      <div className="min-h-full overflow-y-auto container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Hero */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <AnimatedAvatar name={coach.name} role={coach.role} isSpeaking={false} gender={coach.gender} size="lg" imageSrc={coach.imageSrc} />
          </div>
          <h1 className="text-3xl font-display font-bold text-secondary mt-2 mb-3">Interview Complete!</h1>
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl border-2 ${g.bg}`}>
            <span className={`text-5xl font-extrabold ${g.color}`}>{displayScore}</span>
            <div className="text-left">
              <div className={`text-xs font-bold uppercase tracking-wider ${g.color}`}>Overall Score</div>
              <div className={`text-lg font-bold ${g.color}`}>{g.label}</div>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            {typeMeta.icon} {typeMeta.label} · {experience} · {answered.length} questions · {durationMin} min · with {coach.name}
          </p>
        </div>

        {isGeneratingReport && !report && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Generating your detailed interview report...</p>
          </div>
        )}

        {report && (
          <>
            {/* Skill rings */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  Skill Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 justify-items-center">
                  <RingChart value={report.overallScore} label="Overall" color="#f97316" />
                  <RingChart value={report.communicationScore} label="Communication" color="#3b82f6" />
                  <RingChart value={report.grammarScore} label="Grammar" color="#22c55e" />
                  <RingChart value={report.confidenceScore} label="Confidence" color="#f97316" />
                  <RingChart value={report.technicalScore} label="Technical" color="#a855f7" />
                </div>
                <p className="text-sm text-secondary mt-5 text-center">{report.roleFit}</p>
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="border shadow-sm">
                <CardHeader className="pb-2 pt-5 px-5">
                  <CardTitle className="text-base flex items-center gap-2 text-green-700">
                    <Star className="w-4 h-4" />Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <ul className="space-y-2">
                    {report.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />{s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card className="border shadow-sm">
                <CardHeader className="pb-2 pt-5 px-5">
                  <CardTitle className="text-base flex items-center gap-2 text-orange-700">
                    <AlertCircle className="w-4 h-4" />Improvement Areas
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <ul className="space-y-2">
                    {report.improvements.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                        <Pencil className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />{s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className="border shadow-sm">
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />Personalised Learning Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <ol className="space-y-2 list-decimal list-inside text-sm text-secondary">
                  {report.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </CardContent>
            </Card>
          </>
        )}

        {!report && !isGeneratingReport && (
          <Card className="border shadow-sm">
            <CardContent className="p-5 text-center">
              <p className="text-sm text-muted-foreground">Could not generate a detailed report. Per-question feedback is still available below.</p>
            </CardContent>
          </Card>
        )}

        {/* Per-question review */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Question-by-Question</h2>
          {answered.map((q, i) => <QuestionReview key={i} q={q} idx={i} coachName={coach.name} />)}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center flex-wrap pb-6">
          <Button variant="outline" onClick={downloadReport}>
            <Download className="w-4 h-4 mr-2" />Download Report
          </Button>
          <Button onClick={() => { setPhase("setup"); setQuestions([]); setReport(null); setSaved(false); }}>
            <PlayCircle className="w-4 h-4 mr-2" />New Session
          </Button>
          <Button
            variant={saved ? "secondary" : "default"}
            onClick={() => report && saveSession(report, answered)}
            disabled={isSaving || saved || !report}
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saved ? "Saved" : isSaving ? "Saving..." : "Save Report"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Interview ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full overflow-y-auto container mx-auto px-4 py-4 max-w-[1400px]">
      <div className="grid min-h-full lg:grid-cols-[260px_1fr] gap-5">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col items-center gap-4 min-h-0 overflow-hidden">
          <AnimatedAvatar
            name={coach.name}
            role={`${typeMeta.label} Interviewer`}
            isSpeaking={synth.isSpeaking}
            isThinking={isStreaming}
            gender={coach.gender}
            size="xl"
            imageSrc={coach.imageSrc}
          />
          <div className="w-full space-y-2 min-h-0 overflow-hidden flex flex-col">
            <TimerDisplay elapsedSeconds={elapsedSeconds} durationMinutes={duration} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span className="font-bold text-secondary">{answeredCount} answered</span>
            </div>
            <Progress value={Math.min(100, (elapsedSeconds / (duration * 60)) * 100)} className="h-2" />
            <div className="space-y-1 mt-2 overflow-y-auto pr-1">
              {questions.map((q, i) => (
                <div key={i} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg ${i === currentIdx ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"}`}>
                  <span className="truncate mr-2">Q{i + 1}</span>
                  {q.score !== undefined && <ScoreBadge score={q.score * 10} />}
                  {i === currentIdx && !q.feedback && <span className="text-primary text-[10px] animate-pulse">●</span>}
                </div>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground w-full" onClick={endEarly}>
            <LogOut className="w-3 h-3 mr-1" />End Interview
          </Button>
        </aside>

        {/* Main interview area */}
        <main className="min-w-0 min-h-0 flex flex-col">
          <AvatarBar coach={coach} isSpeaking={synth.isSpeaking} isThinking={isStreaming} className="lg:hidden mb-4" />

          <div className="flex items-center gap-3 mb-4 lg:hidden">
            <Progress value={Math.min(100, (elapsedSeconds / (duration * 60)) * 100)} className="h-1.5 flex-1" />
            <TimerDisplay elapsedSeconds={elapsedSeconds} durationMinutes={duration} />
            <Button variant="ghost" size="sm" className="text-xs shrink-0 min-h-9 px-2" onClick={endEarly}>
              <LogOut className="w-3 h-3 mr-1" />End
            </Button>
          </div>

          <Card className="shadow-lg border-none min-h-[72vh] overflow-hidden">
            <CardContent className="p-5 md:p-7 h-full min-h-0 flex flex-col">
              <div className="flex items-start gap-3 mb-6">
                <Button variant="ghost" size="icon" className="shrink-0 min-h-11 min-w-11 mt-0.5 text-muted-foreground hover:text-primary"
                  onClick={() => currentQ && synth.speak(currentQ.question, "English")}>
                  <Volume2 className="w-4 h-4" />
                </Button>
                <div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Question {currentIdx + 1}</span>
                  <h2 className="text-lg md:text-xl font-display font-bold text-secondary leading-snug mt-1">
                    {currentQ?.question}
                  </h2>
                </div>
              </div>

              {!currentQ?.feedback ? (
                <div className="space-y-4 flex-1 min-h-0 flex flex-col">
                  <Textarea
                    placeholder="Speak naturally — the mic starts automatically after each question. You can still type here."
                    className={`min-h-[180px] text-base transition-colors flex-1 ${isRecording ? "bg-red-50/50 border-red-300 focus-visible:ring-red-300" : "bg-muted/40 border-muted-foreground/20"}`}
                    value={isRecording && speech.interimTranscript ? answer + " " + speech.interimTranscript : answer}
                    onChange={e => !isRecording && setAnswer(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${isRecording ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {isRecording ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                      {speech.isSupported ? (isRecording ? "Mic on — speak freely" : "Mic paused") : "Microphone not supported"}
                    </div>
                    {speech.interimTranscript && (
                      <span className="text-xs text-muted-foreground italic flex-1 min-w-[220px] truncate">{speech.interimTranscript}</span>
                    )}
                    <Button variant="outline" size="sm" onClick={toggleRecording} disabled={!speech.isSupported}>
                      {autoListenEnabled ? "Pause mic" : "Resume mic"}
                    </Button>
                    <Button className="font-bold" disabled={!answer.trim() || isStreaming} onClick={submitAnswer}>
                      {isStreaming ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analysing...</> : "Submit Answer"}
                    </Button>
                  </div>
                  {isStreaming && streamText && (
                    <div className="p-4 bg-muted/50 rounded-xl text-sm text-secondary animate-in fade-in">
                      {streamText}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="p-4 bg-muted rounded-xl">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Answer</span>
                    <p className="text-sm text-secondary mt-1 leading-relaxed">{currentQ.answer}</p>
                  </div>
                  <div className="p-5 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="text-xs font-bold text-green-700 uppercase tracking-wider">{coach.name}'s Feedback</span>
                      {currentQ.score !== undefined && <ScoreBadge score={currentQ.score * 10} />}
                      {currentQ.communication !== undefined && (
                        <div className="flex gap-1.5 ml-auto flex-wrap">
                          {[
                            { label: "Comm", val: currentQ.communication, color: "bg-blue-100 text-blue-700" },
                            { label: "Gram", val: currentQ.grammar, color: "bg-green-100 text-green-700" },
                            { label: "Conf", val: currentQ.confidence, color: "bg-orange-100 text-orange-700" },
                            { label: "Tech", val: currentQ.technical, color: "bg-purple-100 text-purple-700" },
                          ].map(s => s.val !== undefined && (
                            <span key={s.label} className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${s.color}`}>
                              {s.label} {s.val}/10
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-green-950 whitespace-pre-wrap leading-relaxed">{currentQ.feedback}</div>
                  </div>
                  <div className="flex items-center justify-end pt-1">
                    <Button onClick={nextQuestion} className="font-bold">
                      {currentIdx < questions.length - 1
                        ? <><ChevronRight className="w-4 h-4 mr-1" />Next Question</>
                        : "View Full Report"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

// ─── Question review card ──────────────────────────────────────────────────────

function QuestionReview({ q, idx, coachName }: { q: QA; idx: number; coachName: string }) {
  const [open, setOpen] = useState(idx === 0);
  return (
    <Card className="border shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-bold text-muted-foreground shrink-0">Q{idx + 1}</span>
          <span className="text-sm font-semibold text-secondary line-clamp-1">{q.question}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {q.score !== undefined && <ScoreBadge score={q.score * 10} />}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-muted/20 animate-in slide-in-from-top-1">
          {q.communication !== undefined && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Communication", val: q.communication, icon: MessageCircle, color: "text-blue-600 bg-blue-50" },
                { label: "Grammar", val: q.grammar, icon: Pencil, color: "text-green-600 bg-green-50" },
                { label: "Confidence", val: q.confidence, icon: Flame, color: "text-orange-600 bg-orange-50" },
                { label: "Technical", val: q.technical, icon: Brain, color: "text-purple-600 bg-purple-50" },
              ].map(s => s.val !== undefined && (
                <div key={s.label} className={`rounded-xl p-2.5 ${s.color.split(" ")[1]}`}>
                  <div className={`text-[10px] font-bold ${s.color.split(" ")[0]} mb-0.5`}>{s.label}</div>
                  <div className={`text-lg font-display font-bold ${s.color.split(" ")[0]}`}>{s.val}/10</div>
                  <Progress value={s.val * 10} className="h-1 mt-1" />
                </div>
              ))}
            </div>
          )}
          <div className="rounded-xl bg-background border p-3">
            <p className="text-xs font-bold text-muted-foreground mb-1">Your Answer</p>
            <p className="text-sm text-secondary leading-relaxed">{q.answer}</p>
          </div>
          <div className="rounded-xl bg-green-50 border border-green-100 p-3">
            <p className="text-xs font-bold text-green-700 mb-1">{coachName}'s Feedback</p>
            <p className="text-sm text-green-950 whitespace-pre-wrap leading-relaxed">{q.feedback}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
