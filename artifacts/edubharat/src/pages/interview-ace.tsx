import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useHistory } from "@/lib/use-history";
import { useGeminiStream } from "@/lib/use-gemini-stream";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { useEdgeTTS } from "@/lib/use-edge-tts";
import { useStudentProfile } from "@/lib/use-student-profile";
import { useAuth } from "@/lib/use-auth";
import { useCredits, chargeInterview, interviewCreditCost } from "@/lib/use-credits";
import { useGuestTrial, guestInterviewsLeft, consumeGuestInterview } from "@/lib/guest-trial";
import { AnimatedAvatar } from "@/components/avatar";
import { INTERVIEW_COACHES } from "@/lib/tutors";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import {
  Loader2, Mic, MicOff, PlayCircle, ChevronRight, Download, Volume2,
  LogOut, CheckCircle2, ChevronDown, MessageCircle, Pencil, Flame, Brain,
  Star, Trophy, Clock, Timer, AlertCircle, Save, PhoneOff, VideoOff, Video,
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
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 25, label: "25 minutes" },
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
  questionScores?: Array<{
    score: number; communication: number; grammar: number;
    confidence: number; technical: number; feedback: string;
  }>;
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
      questionScores: Array.isArray(parsed["questionScores"])
        ? (parsed["questionScores"] as Record<string, unknown>[]).map(qs => ({
            score: Math.min(10, Math.max(1, Number(qs["score"]) || 5)),
            communication: Math.min(10, Math.max(1, Number(qs["communication"]) || 5)),
            grammar: Math.min(10, Math.max(1, Number(qs["grammar"]) || 5)),
            confidence: Math.min(10, Math.max(1, Number(qs["confidence"]) || 5)),
            technical: Math.min(10, Math.max(1, Number(qs["technical"]) || 5)),
            feedback: String(qs["feedback"] || ""),
          }))
        : undefined,
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
        subtitle={coach.role}
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
  const synth = useEdgeTTS();
  const speech = useSpeechRecognition("English");
  // Tracks whether the coach is currently speaking (TTS active). The auto-listen
  // effect checks this so it never restarts the mic while the coach is mid-speech,
  // fixing the "stops after 1 question" bug caused by the effect firing eagerly
  // between when the stream ends and when speakCoach actually starts TTS.
  const [coachSpeaking, setCoachSpeaking] = useState(false);
  // Safety timer: if TTS is aborted or the fetch hangs, onEnd never fires and
  // coachSpeaking gets stuck true permanently — the mic never starts. This ref
  // holds a fallback timer that force-clears the flag after a generous timeout.
  const coachSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * speakCoach — the ONLY way the interviewer should talk. It hard-pauses the
   * mic the instant the AI begins speaking (kills echo/self-repeat on phones
   * and laptop speakers) and releases it ~1.1s after the audio ends.
   * coachSpeaking stays true until TTS finishes, letting the auto-listen effect
   * know it should wait before restarting the mic.
   */
  const speakCoach = useCallback(
    (text: string, opts: { voiceGender?: "male" | "female"; pitch?: number; rate?: number }) => {
      speech.pause();
      // Clear any previous safety timer before starting fresh
      if (coachSafetyTimerRef.current) { clearTimeout(coachSafetyTimerRef.current); coachSafetyTimerRef.current = null; }
      setCoachSpeaking(true);
      // ~120 ms per character covers the slowest realistic reading pace; 12 s is
      // the minimum so even very short questions get enough buffer for fetch + buffer.
      const safetyMs = Math.max(text.length * 120 + 4_000, 12_000);
      coachSafetyTimerRef.current = setTimeout(() => {
        coachSafetyTimerRef.current = null;
        setCoachSpeaking(false);
      }, safetyMs);
      void synth.speak(text, "English", () => {
        if (coachSafetyTimerRef.current) { clearTimeout(coachSafetyTimerRef.current); coachSafetyTimerRef.current = null; }
        speech.blockFor(800);
        setCoachSpeaking(false);
      }, opts);
    },
    [speech, synth],
  );
  const { profile } = useStudentProfile();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { balance } = useCredits();
  const { interviewsLeft: guestInterviewsRemaining } = useGuestTrial();

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
  const questionsRef = useRef<QA[]>([]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
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
  // Webcam for video call mode
  const webcamRef = useRef<HTMLVideoElement>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const typeMeta = INTERVIEW_TYPES.find(t => t.value === type)!;
  const currentQ = questions[currentIdx];
  const answeredCount = questions.filter(q => q.answer).length;
  const interviewCost = interviewCreditCost(duration);

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
    if (elapsedSeconds >= durationSeconds && currentQ && !isStreaming && !isRecording) {
      // Time is up — end the interview
      setPhase("report");
    }
  }, [elapsedSeconds, duration, phase, currentQ, isStreaming, isRecording]);

  const clearAutoSubmitTimer = useCallback(() => {
    if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current);
    autoSubmitRef.current = null;
  }, []);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      webcamStreamRef.current = stream;
      // Attach to video element once it mounts (slight delay to allow React render)
      setTimeout(() => {
        if (webcamRef.current) webcamRef.current.srcObject = stream;
      }, 200);
      setCameraOn(true);
      setCameraError(false);
    } catch {
      setCameraError(true);
      setCameraOn(false);
    }
  }, []);

  const stopWebcam = useCallback(() => {
    webcamStreamRef.current?.getTracks().forEach(t => t.stop());
    webcamStreamRef.current = null;
    if (webcamRef.current) webcamRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  // Cleanup webcam on unmount
  useEffect(() => () => stopWebcam(), [stopWebcam]);

  useEffect(() => {
    if (phase !== "interview" || isStreaming || synth.isSpeaking) {
      clearAutoSubmitTimer();
      if (isRecording && (isStreaming || synth.isSpeaking)) { setIsRecording(false); speech.stop(); }
    }
  }, [phase, isStreaming, synth.isSpeaking, isRecording, speech, clearAutoSubmitTimer]);

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
    // Don't decide guest vs. paid until auth has resolved — otherwise a signed-in
    // user could slip onto the free path before /api/auth/me returns.
    if (authLoading) {
      toast({ title: "One moment…", description: "Checking your account — please try again in a second." });
      return;
    }
    // Guests get 2 free interviews (no signup); signed-in users spend credits.
    if (!user && guestInterviewsLeft() <= 0) {
      toast({ title: "Free interviews used up", description: "Sign in to get 99 free credits and keep practising.", variant: "destructive" });
      return;
    }
    resetStream();
    const candidateName = profile.name || "there";
    const firstName = candidateName.split(" ")[0];
    const full = await stream(
      `You are ${coach.name}, starting a ${typeMeta.label} interview with ${firstName}.

Say a warm 2-sentence greeting — introduce yourself briefly and put them at ease — then ask: "So, tell me about yourself."

STRICT rules:
- Maximum 3 sentences total. No long speeches.
- Plain spoken words ONLY. No asterisks, no *actions*, no #headers, no markdown, no quotes around your reply.
- Do NOT list rules, do NOT explain the process, do NOT say "there are no trick questions".
- Sound like a real person on a phone call, not a script.`,
      `You are ${coach.name}, ${coach.role}. Speak naturally and briefly. Never use markdown or action words.`,
      undefined,
      { maxTokens: 100 }
    );
    const opening = full.replace(/^\s*["']?|["']?\s*$/g, "").trim();
    if (!opening) return;
    // Now that a real interview is starting: guests consume a free trial slot,
    // signed-in users are charged credits.
    if (!user) {
      consumeGuestInterview();
    } else {
      const charge = await chargeInterview(duration);
      if (!charge.ok) {
        if (charge.status === 402) {
          toast({
            title: "Not enough credits",
            description: `This interview needs ${interviewCreditCost(duration)} credits — you have ${charge.balance ?? 0}. Top up to continue.`,
            variant: "destructive",
          });
        } else {
          toast({ title: "Couldn't start interview", description: charge.error ?? "Please try again.", variant: "destructive" });
        }
        return;
      }
    }
    // The opening combines greeting + first question — store as first QA entry
    setQuestions([{ question: opening }]);
    setCurrentIdx(0);
    setAnswer("");
    setIsRecording(false);
    setAutoListenEnabled(true);
    setSessionStart(Date.now());
    setElapsedSeconds(0);
    setReport(null);
    setSaved(false);
    setPhase("interview");
    // Camera does NOT start automatically — user must enable it via the button.
    // Set coachSpeaking BEFORE the delay so the auto-listen effect cannot fire
    // during the 300ms window between phase="interview" and speakCoach start.
    const pitchVariation = coach.gender === "male" ? 0.88 : 1.08;
    setCoachSpeaking(true);
    setTimeout(() => speakCoach(opening, { voiceGender: coach.gender, pitch: pitchVariation }), 300);
  }, [typeMeta, experience, duration, coach, stream, resetStream, speakCoach, buildProfileSummary, profile.name, user, authLoading, toast]);

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
    const recordedAnswer = userAnswer.trim();
    setAnswer("");
    resetStream();

    const elapsedMin = Math.floor(elapsedSeconds / 60);
    const remainingMin = duration - elapsedMin;
    const isFinalQuestion = remainingMin <= 2;

    // Record the answer without generating per-question feedback
    setQuestions(prev => prev.map((q, i) => i === currentIdx
      ? { ...q, answer: recordedAnswer }
      : q
    ));

    const firstName = (profile.name || "there").split(" ")[0];

    if (isFinalQuestion) {
      speakCoach(`Thank you, ${firstName}. It's been great speaking with you — that's all from my side. I'll put together your feedback report now.`, { voiceGender: coach.gender });
      setTimeout(() => setPhase("report"), 1500);
      return;
    }

    // Build recent interview history for context (last 3 answered questions)
    const recentAnswered = questionsRef.current
      .filter(q => q.answer)
      .slice(-3)
      .map((q, i) => `Q: ${q.question}\nA: ${q.answer}`)
      .join("\n\n");

    // Detect short/vague answers so we can probe instead of jumping to next topic
    const wordCount = recordedAnswer.split(/\s+/).filter(Boolean).length;
    const isShortAnswer = wordCount < 20;

    // Get a natural acknowledgment + next question — no scores, no analysis
    const response = await stream(
      `You are ${coach.name} conducting a live ${typeMeta.label} interview. ${remainingMin} minutes remaining.

Candidate: ${firstName} | ${buildProfileSummary()}

Interview conversation so far:
${recentAnswered || "(This is the first answer)"}

You just asked:
"${currentQ.question}"

${firstName} answered:
"${recordedAnswer}"

${isShortAnswer
  ? `Note: Their answer is quite brief (${wordCount} words). They may be nervous or unsure. Gently acknowledge what they said and invite them to share more before moving on.`
  : ""}

Your job:
1. React naturally to something SPECIFIC they actually said — not a generic "That's great." Mention a detail from their answer.
2. Then${isShortAnswer
  ? ` ask them to elaborate: use "Could you tell me a bit more about that?" or "Can you share a specific example of that?"`
  : remainingMin <= 3
    ? ` ask one warm closing question — their career goals, what they're looking for in a role, or if they have any questions for you`
    : ` either dig deeper into what they mentioned, or smoothly move to a new aspect relevant to ${typeMeta.label}`}

Rules — follow these exactly:
- Use ${firstName}'s name once in a while (not every time)
- React to their SPECIFIC words, not generically. If they mentioned a project, a company, a skill — reference it.
- Natural Indian professional speech: "That makes sense.", "I see.", "Interesting.", "Right, okay.", "That's helpful."
- NEVER use "Like, if you had to..." — it sounds robotic
- Ask questions naturally: "Walk me through...", "How did you handle...", "What's your take on...", "Can you give me an example of..."
- NEVER start the Next question with "Hello", "Hi", "Hey", "Tell me, Hello", or any greeting — jump straight into the question
- The Next line is ONLY the question itself — no name, no pleasantry, just the question
- Acknowledgment: 1–2 sentences max
- Ask exactly ONE question

Output exactly two lines, no extra text:
Ack: <your genuine reaction to their specific answer, 1–2 sentences>
Next: <your next question — start directly with the question, never with a greeting>`,
      `You are ${coach.name}, ${coach.role}. You are on a live voice interview call with ${firstName}. You are warm, perceptive, and genuinely curious — you listen carefully and respond to what the candidate actually says, not a generic script. You make candidates feel heard and comfortable.`,
      undefined,
      { maxTokens: 200 }
    );

    // Robust parsing — tolerates multiline Ack, minor model format drift, or
    // missing labels. Prevents premature session-end if the model skips "Next:".
    const ackMatch = response.match(/^Ack:\s*([\s\S]+?)(?=\nNext:|\n\nNext:|$)/im);
    const nextMatch = response.match(/^Next:\s*([\s\S]+?)$/im);
    let acknowledgment = ackMatch?.[1]?.trim().replace(/\n+/g, " ") ?? "That's helpful, thank you.";
    let nextQuestion = nextMatch?.[1]?.trim().replace(/\n+/g, " ");

    // Fallback: if structured parsing failed, split by paragraphs/lines so the
    // interview can continue rather than ending the session.
    if (!nextQuestion && response.trim()) {
      const lines = response.trim().split(/\n+/).map(l => l.replace(/^(Ack:|Next:)\s*/i, "").trim()).filter(Boolean);
      if (lines.length >= 2) {
        acknowledgment = lines.slice(0, -1).join(" ");
        nextQuestion = lines[lines.length - 1];
      } else if (lines.length === 1 && lines[0]!.includes("?")) {
        nextQuestion = lines[0];
        acknowledgment = "Right, okay.";
      }
    }

    // Strip any stray greeting prefix the model sneaks into the question.
    // Covers: "Hello, ..." / "Hi Priya, ..." / "Tell me, Hello — ..." / "Priya, Hello, ..."
    const stripGreeting = (q: string) => {
      let s = q;
      // "Tell me, Hello — ..." or "Tell me, Hi ..."
      s = s.replace(/^Tell\s+me[,\s]+(?:Hello|Hi|Hey)\b[\s,—–-]*/i, "");
      // "Name, Hello, ..." e.g. "Priya, Hello, ..."
      s = s.replace(/^[A-Z][a-z]+[,\s]+(?:Hello|Hi|Hey)\b[\s,—–-]*/i, "");
      // Plain "Hello, ..." / "Hi Priya, ..." / "Hey, ..."
      s = s.replace(/^(?:Hello|Hi|Hey)\b(?:\s+[A-Z][a-z]+)?[\s,—–-]+/i, "");
      // Strip any leftover leading punctuation/dashes after greeting removal
      s = s.replace(/^[\s—–\-:,]+/, "");
      return s.trim();
    };
    if (nextQuestion) nextQuestion = stripGreeting(nextQuestion);
    // Capitalise first letter if stripping lowercased it
    if (nextQuestion) nextQuestion = nextQuestion.charAt(0).toUpperCase() + nextQuestion.slice(1);

    // Safety: never let a parsing failure silently end the interview.
    // If the AI didn't return a parseable question, use a neutral probe.
    const FALLBACK_QUESTIONS = [
      "Could you tell me a bit more about that?",
      "Interesting — can you give me a specific example?",
      "Walk me through that in a bit more detail.",
      "What would you say was the biggest challenge there?",
    ];
    if (!nextQuestion) {
      nextQuestion = FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)];
      acknowledgment = "Right, okay.";
    }

    setQuestions(prev => [...prev, { question: nextQuestion! }]);
    setCurrentIdx(prev => prev + 1);
    setAnswer("");
    setIsRecording(false);
    const pitchVariation = coach.gender === "male" ? 0.88 + Math.random() * 0.06 : 1.06 + Math.random() * 0.06;
    speakCoach(`${acknowledgment} ${nextQuestion}`, { voiceGender: coach.gender, pitch: pitchVariation });
  }, [currentQ, currentIdx, experience, duration, elapsedSeconds, coach, stream, resetStream, synth, typeMeta, buildProfileSummary, buildTranscript, clearAutoSubmitTimer, speech, profile]);

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
    // Guard against the 300ms window before speakCoach fires
    setCoachSpeaking(true);
    setTimeout(() => speakCoach(questions[nextIdx]!.question, { voiceGender: coach.gender }), 300);
  }, [currentIdx, questions, resetStream, speakCoach, clearAutoSubmitTimer]);

  const endEarly = useCallback(() => {
    clearAutoSubmitTimer();
    speech.stop();
    synth.stop();
    stopWebcam();
    setIsRecording(false);
    setAutoListenEnabled(false);
    setPhase("report");
  }, [speech, synth, clearAutoSubmitTimer, stopWebcam]);

  useEffect(() => {
    // coachSpeaking guard: don't start mic while the AI coach is speaking — prevents
    // the mic from activating between when the stream ends and when TTS actually starts.
    if (phase !== "interview" || !autoListenEnabled || !speech.isSupported || !currentQ || isStreaming || synth.isSpeaking || isRecording || coachSpeaking) return;
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
      // 800ms silence → auto-submit: snappy, human-paced turn-taking while
      // still leaving room for short thinking pauses mid-answer.
      autoSubmitRef.current = setTimeout(() => {
        const latest = answerRef.current.trim();
        if (latest) void submitCurrentAnswer(latest);
      }, 800);
    });
    return () => { clearAutoSubmitTimer(); };
  }, [phase, currentQ, autoListenEnabled, speech, isStreaming, synth.isSpeaking, isRecording, coachSpeaking, submitCurrentAnswer, clearAutoSubmitTimer]);

  // Generate detailed report when entering report phase
  useEffect(() => {
    if (phase !== "report" || report || isGeneratingReport) return;
    const answered = questions.filter(q => q.answer);
    if (answered.length === 0) return;
    setIsGeneratingReport(true);

    const generate = async () => {
      const transcript = answered
        .map((q, i) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.answer ?? ""}`)
        .join("\n\n");

      const reportText = await stream(
        `You are an expert interview evaluator. Review this full mock interview and produce a detailed structured report.

Role: ${typeMeta.label}
Candidate: ${experience} experience
Duration: ${formatTime(elapsedSeconds)}
Profile: ${buildProfileSummary()}

Full interview transcript:
${transcript}

Return ONLY a valid JSON object with exactly these keys (no markdown, no extra text):
{
  "overallScore": 0-100,
  "communicationScore": 0-100,
  "grammarScore": 0-100,
  "confidenceScore": 0-100,
  "technicalScore": 0-100,
  "roleFit": "one honest sentence about this candidate for this role",
  "strengths": ["3 specific observed strengths"],
  "improvements": ["3 specific improvement areas"],
  "nextSteps": ["3 concrete actionable steps"],
  "questionScores": [
    {
      "score": 1-10,
      "communication": 1-10,
      "grammar": 1-10,
      "confidence": 1-10,
      "technical": 1-10,
      "feedback": "2-3 sentence natural feedback on this answer"
    }
  ]
}

Include one entry in questionScores for each question in order (${answered.length} entries total).
Be honest, specific, and encouraging. Use Indian hiring context.`,
        `You are a senior hiring manager and interview coach evaluating an Indian candidate. Give human, realistic, non-robotic feedback.`,
        undefined,
        { maxTokens: 3000 }
      );

      const parsed = parseReportJson(reportText) ?? {
        overallScore: 60,
        communicationScore: 60,
        grammarScore: 60,
        confidenceScore: 60,
        technicalScore: 60,
        roleFit: "Promising candidate with room to grow.",
        strengths: ["Participated actively in the mock interview", "Provided structured answers", "Showed willingness to learn"],
        improvements: ["Add more specific examples", "Tighten language clarity", "Work on concise delivery"],
        nextSteps: ["Practice STAR method answers", "Record yourself and review", "Schedule another mock interview next week"],
      };

      // If questionScores is missing (e.g. JSON was truncated), run a focused
      // follow-up call to get per-question feedback only.
      if (!parsed.questionScores || parsed.questionScores.length === 0) {
        const fbText = await stream(
          `You are an interview coach. For each answer below, give a 2-3 sentence honest, natural, specific feedback.

${answered.map((q, i) => `Q${i + 1}: ${q.question}\nAnswer: ${q.answer ?? ""}`).join("\n\n")}

Return ONLY a valid JSON array (no markdown) with one object per question in order:
[{"score":1-10,"communication":1-10,"grammar":1-10,"confidence":1-10,"technical":1-10,"feedback":"2-3 sentences"}]`,
          `You are a concise interview evaluator. Be honest, specific, and encouraging.`,
          undefined,
          { maxTokens: 1500 }
        );
        const cleaned = fbText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        try {
          const arr = JSON.parse(cleaned) as Array<Record<string, unknown>>;
          if (Array.isArray(arr)) {
            parsed.questionScores = arr.map(qs => ({
              score: Math.min(10, Math.max(1, Number(qs["score"]) || 5)),
              communication: Math.min(10, Math.max(1, Number(qs["communication"]) || 5)),
              grammar: Math.min(10, Math.max(1, Number(qs["grammar"]) || 5)),
              confidence: Math.min(10, Math.max(1, Number(qs["confidence"]) || 5)),
              technical: Math.min(10, Math.max(1, Number(qs["technical"]) || 5)),
              feedback: String(qs["feedback"] || ""),
            }));
          }
        } catch { /* keep without per-question scores */ }
      }

      // Populate per-question feedback from report questionScores
      let updatedAnswered = answered;
      if (parsed.questionScores && parsed.questionScores.length > 0) {
        updatedAnswered = answered.map((q, i) => {
          const qs = parsed.questionScores![i];
          if (!qs) return q;
          return { ...q, feedback: qs.feedback, score: qs.score, communication: qs.communication, grammar: qs.grammar, confidence: qs.confidence, technical: qs.technical };
        });
        // Use index-based mapping so text-match failures don't drop feedback
        setQuestions(prev => {
          let feedbackIdx = 0;
          return prev.map(q => {
            if (!q.answer) return q;
            const updated = updatedAnswered[feedbackIdx++];
            return updated ?? q;
          });
        });
      }

      setReport(parsed);
      setIsGeneratingReport(false);
      await saveSession(parsed, updatedAnswered);
    };

    void generate();
  }, [phase, report, isGeneratingReport, questions, typeMeta, experience, elapsedSeconds, stream, buildProfileSummary]);

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
    const answered = questions.filter(q => q.answer);
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
      <div className="min-h-full container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8 pt-6">
          <h1 className="text-4xl font-display font-bold text-secondary mb-2">Interview Ace</h1>
          <p className="text-muted-foreground">AI mock interviews with instant feedback · Voice-powered · India-focused</p>
        </div>

        {/* Coach selection */}
        <div className="mb-8">
          {/* ── SETTINGS BAR — directly above the interviewer grid ── */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-sm font-semibold text-secondary truncate">
              {profile.name || user?.name || "Guest"}
            </span>
            <span className="text-muted-foreground/40">•</span>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-7 text-xs w-[160px] rounded-full border-dashed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVIEW_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={experience} onValueChange={setExperience}>
              <SelectTrigger className="h-7 text-xs w-[120px] rounded-full border-dashed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPERIENCE_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(duration)} onValueChange={v => setDuration(Number(v))}>
              <SelectTrigger className="h-7 text-xs w-[120px] rounded-full border-dashed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
                    subtitle={c.role}
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
            <CardTitle>Ready to begin?</CardTitle>
            <CardDescription>
              {typeMeta.icon} {typeMeta.label} · {experience} · {duration} min with {coach.name}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col gap-2 items-stretch">
            <Button className="w-full h-12 font-bold text-base shadow-md shadow-primary/20" onClick={startSession} disabled={isStreaming}>
              {isStreaming
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Preparing session...</>
                : <><PlayCircle className="w-5 h-5 mr-2" />Begin with {coach.name}</>}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              {user ? (
                <>Uses <span className="font-semibold text-secondary">{interviewCost} credits</span> · Balance: <span className="font-semibold text-secondary">{balance ?? "…"}</span> · <Link href="/credits" className="text-primary font-semibold hover:underline">Top up</Link></>
              ) : guestInterviewsRemaining > 0 ? (
                <><span className="font-semibold text-green-700">{guestInterviewsRemaining} free {guestInterviewsRemaining === 1 ? "interview" : "interviews"}</span> left — no signup needed · <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link> for 99 free credits</>
              ) : (
                <>Free interviews used up · <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link> to get 99 free credits</>
              )}
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  if (phase === "report") {
    const answered = questions.filter(q => q.answer);
    const avgScore = avgOf(answered.map(q => q.score)) * 10;
    const g = report ? grade(report.overallScore) : grade(avgScore);
    const displayScore = report ? report.overallScore : avgScore;
    const durationMin = Math.round(elapsedSeconds / 60);

    return (
      <div className="min-h-full container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Hero */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <AnimatedAvatar name={coach.name} subtitle={coach.role} isSpeaking={false} gender={coach.gender} size="lg" imageSrc={coach.imageSrc} />
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
          {answered.map((q, i) => <QuestionReview key={i} q={q} idx={i} coachName={coach.name} hasReport={!!report} />)}
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

  // ── Interview — Video Call Mode ────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col z-[9999]" style={{ top: 56 }}>

      {/* ── Top HUD ──────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-bold">{coach.name}</span>
          <span className="text-white/50 text-xs">· {typeMeta.icon} {typeMeta.label} · {experience}</span>
        </div>
        <div className="flex items-center gap-2 text-white/80 text-sm font-bold">
          <Timer className="w-4 h-4" />
          <span className={elapsedSeconds >= duration * 60 - 120 ? "text-red-400" : ""}>
            {formatTime(elapsedSeconds)} / {duration}:00
          </span>
        </div>
      </div>

      {/* ── Progress bar under HUD ──────────────────────────────────────── */}
      <div className="absolute top-11 left-0 right-0 h-0.5 bg-white/10 z-10">
        <div
          className={`h-full transition-all ${elapsedSeconds >= duration * 60 - 120 ? "bg-red-500" : "bg-primary"}`}
          style={{ width: `${Math.min(100, (elapsedSeconds / (duration * 60)) * 100)}%` }}
        />
      </div>

      {/* ── Main video area ─────────────────────────────────────────────── */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">

        {/* AI avatar — large central "video" */}
        <div className="flex flex-col items-center gap-5">
          <div
            className="rounded-full transition-all duration-300"
            style={synth.isSpeaking ? { boxShadow: "0 0 0 12px rgba(249,115,22,0.15), 0 0 0 24px rgba(249,115,22,0.07)" } : {}}
          >
            <AnimatedAvatar
              name={coach.name}
              subtitle={coach.role}
              isSpeaking={synth.isSpeaking}
              isThinking={isStreaming}
              gender={coach.gender}
              size="xl"
              imageSrc={coach.imageSrc}
            />
          </div>

          {/* Voice visualiser bars */}
          {synth.isSpeaking && (
            <div className="flex items-end gap-1">
              {[10, 18, 24, 18, 14, 22, 10].map((h, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full bg-primary animate-pulse"
                  style={{ height: h, animationDelay: `${i * 0.12}s`, animationDuration: "0.6s" }}
                />
              ))}
            </div>
          )}
          {isStreaming && !synth.isSpeaking && (
            <p className="text-white/50 text-xs animate-pulse">{coach.name} is thinking…</p>
          )}
        </div>

        {/* Current question subtitle */}
        {currentQ && (
          <div className="absolute bottom-4 left-4 right-20 sm:right-4">
            <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-4 py-3 max-w-2xl mx-auto text-center">
              <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1">
                Question {currentIdx + 1} · {answeredCount} answered
              </p>
              <p className="text-white text-sm sm:text-base font-semibold leading-snug">{currentQ.question}</p>
              <button
                className="mt-2 text-primary/70 hover:text-primary text-xs flex items-center gap-1 mx-auto"
                onClick={() => speakCoach(currentQ.question, { voiceGender: coach.gender, pitch: coach.gender === "male" ? 0.88 : 1.08 })}
              >
                <Volume2 className="w-3 h-3" /> Repeat question
              </button>
            </div>
          </div>
        )}

        {/* User webcam — PiP corner */}
        <div className="absolute top-14 right-3 w-24 h-18 sm:w-32 sm:h-24 rounded-xl overflow-hidden border border-white/20 shadow-2xl bg-gray-800">
          {cameraOn ? (
            <video
              ref={webcamRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
              onLoadedMetadata={e => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-white/30">
              <VideoOff className="w-5 h-5" />
              <span className="text-[9px]">{cameraError ? "No camera" : "Camera off"}</span>
            </div>
          )}
          <div className="absolute bottom-1 right-1.5 text-[9px] text-white/50 font-bold">You</div>
        </div>

        {/* Camera permission toggle — always visible */}
        <button
          className="absolute top-14 right-3 w-24 sm:w-32 flex items-center justify-center"
          style={{ top: "calc(3.5rem + 76px + 4px)" }}
          onClick={cameraOn ? stopWebcam : () => void startWebcam()}
          title={cameraOn ? "Turn off camera" : "Enable camera (optional)"}
        >
          <span className="bg-black/70 text-white/80 text-[9px] px-2 py-0.5 rounded-full hover:bg-black/90 transition-colors">
            {cameraOn ? "📷 Off" : "📷 Enable"}
          </span>
        </button>
      </div>

      {/* ── Bottom answer + controls ─────────────────────────────────────── */}
      <div className="bg-gray-900 border-t border-white/10 px-4 pt-3 pb-4 space-y-3">
        <Textarea
          placeholder="Speak naturally — mic starts automatically. Or type here."
          className={`min-h-[90px] sm:min-h-[110px] text-sm resize-none bg-gray-800 border-gray-700 text-white placeholder:text-white/30 focus-visible:ring-primary ${
            isRecording ? "border-green-500/50" : ""
          }`}
          value={isRecording && speech.interimTranscript ? answer + " " + speech.interimTranscript : answer}
          onChange={e => !isRecording && setAnswer(e.target.value)}
        />

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mic status pill */}
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shrink-0 ${
            isRecording ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-white/10 text-white/40"
          }`}>
            {isRecording ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
            {isRecording ? "Listening…" : speech.isSupported ? "Mic paused" : "No mic"}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleRecording}
            disabled={!speech.isSupported}
            className="text-white/50 hover:text-white hover:bg-white/10 text-xs shrink-0"
          >
            {autoListenEnabled ? "Pause mic" : "Resume mic"}
          </Button>

          <div className="flex-1" />

          {/* Submit answer */}
          <Button
            size="sm"
            className="font-bold bg-primary hover:bg-primary/90 shrink-0"
            disabled={!answer.trim() || isStreaming}
            onClick={submitAnswer}
          >
            {isStreaming
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><ChevronRight className="w-4 h-4 mr-1" />Submit</>}
          </Button>

          {/* End call — red hang-up button */}
          <button
            onClick={endEarly}
            className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 flex items-center justify-center shadow-lg shadow-red-900/40 transition-all shrink-0"
            title="End Interview"
          >
            <PhoneOff className="w-4 h-4 text-white" />
          </button>
        </div>

        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-white/40 animate-in fade-in">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            {coach.name} is preparing the next question…
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Question review card ──────────────────────────────────────────────────────

function QuestionReview({ q, idx, coachName, hasReport }: { q: QA; idx: number; coachName: string; hasReport: boolean }) {
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
            <p className="text-sm text-green-950 whitespace-pre-wrap leading-relaxed">{q.feedback ?? (hasReport ? "See overall analysis above for feedback on this answer." : "Generating your personalised feedback…")}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
