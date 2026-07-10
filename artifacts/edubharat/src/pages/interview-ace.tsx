import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useHistory } from "@/lib/use-history";
import { useGeminiStream } from "@/lib/use-gemini-stream";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { useEdgeTTS, unlockAudio } from "@/lib/use-edge-tts";
import { useStudentProfile } from "@/lib/use-student-profile";
import { useAuth } from "@/lib/use-auth";
import { useCredits, chargeInterview, tickInterview, endInterview, interviewCreditCost, interviewBlockSeconds, INTERVIEW_MAX_BLOCKS } from "@/lib/use-credits";
import { useGuestTrial, guestInterviewsLeft, consumeGuestInterview } from "@/lib/guest-trial";
import { AnimatedAvatar } from "@/components/avatar";
import { INTERVIEW_COACHES, recommendedCoachFor } from "@/lib/tutors";
import { COMPETENCIES, coveredCompetencies, weightedScoreFor, areaForBeat, functionalKnowledgeFor, calibrationFor, type CompetencyKey } from "@/lib/interview-format";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { interviewVerdict as verdictFor, recommendationForWeighted, ratingLabel, RECOMMENDATION_STYLES, type RecommendationLabel } from "@/lib/interview-verdict";
import {
  Loader2, Mic, MicOff, PlayCircle, ChevronRight, Download, Volume2,
  LogOut, CheckCircle2, ChevronDown, MessageCircle, Pencil, Flame, Brain,
  Star, Clock, Timer, AlertCircle, Save, PhoneOff, VideoOff, Video, Target, XCircle,
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

type CompetencyRating = { rating: number; comment: string };

type InterviewReport = {
  /** 0–100 overall (= weightedScore × 20). Kept for analytics, trends and
   *  older saved reports so nothing downstream breaks. */
  overallScore: number;
  /** 1–5 Total Weighted Score — the scorecard's primary result. */
  weightedScore: number;
  /** Strong Hire / Hire / Hold / No Hire, derived from weightedScore. */
  recommendation: RecommendationLabel;
  communicationScore: number;
  grammarScore: number;
  confidenceScore: number;
  technicalScore: number;
  roleFit: string;
  /** Human hiring-recommendation rationale shown next to the Selected / Not
   *  Selected result (the label itself is derived from overallScore). */
  verdictReason?: string;
  /** Per-competency 1–5 ratings, keyed by CompetencyKey (only the competencies
   *  this interview length covered are present). */
  competencies?: Partial<Record<CompetencyKey, CompetencyRating>>;
  strengths: string[];
  concerns: string[];
  /** Legacy field kept only so older saved reports still parse cleanly. */
  improvements?: string[];
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

/** Remove any prompt artifacts (Ack:/Next:, labels, markdown) that could leak into TTS. */
function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^(?:Ack|Next):\s*/gim, "")
    .replace(/\b(?:Ack|Next):\s*/gi, "")
    .replace(/^[A-Za-zÀ-ÿ'\s]{2,30}:\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseCompetencyRating(v: unknown): CompetencyRating {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const raw = Number(o["rating"]);
  const rating = Number.isFinite(raw) ? Math.min(5, Math.max(1, Math.round(raw))) : 3;
  return { rating, comment: String(o["comment"] || "") };
}

/** Deterministically derive the weighted score (1–5), the 0–100 overall
 *  (weighted × 20, kept for analytics/trends), the recommendation band and the
 *  typed sub-scores from the 1–5 ratings — over the competencies this interview
 *  length covers. Computing this here (not from the AI) guarantees the score,
 *  ratings and recommendation can never contradict one another. */
function deriveScores(
  competencies: Partial<Record<CompetencyKey, CompetencyRating>>,
  durationMin: number,
) {
  const ratings: Partial<Record<CompetencyKey, number>> = {};
  for (const key of Object.keys(competencies) as CompetencyKey[]) {
    ratings[key] = competencies[key]!.rating;
  }
  const weightedScore = weightedScoreFor(ratings, durationMin);
  const overallScore = Math.round(weightedScore * 20);
  const recommendation = recommendationForWeighted(weightedScore).label;
  const pct = (key: CompetencyKey) =>
    typeof ratings[key] === "number" ? ratings[key]! * 20 : overallScore;
  return {
    weightedScore,
    overallScore,
    recommendation,
    communicationScore: pct("communication"),
    grammarScore: pct("communication"),
    confidenceScore: pct("ownership"),
    technicalScore: pct("domainKnowledge"),
  };
}

/** A neutral fallback report (every covered competency rated 3) used only when
 *  automated scoring is interrupted, so the user still sees a coherent result. */
function neutralReport(durationMin: number): InterviewReport {
  const competencies: Partial<Record<CompetencyKey, CompetencyRating>> = {};
  for (const c of coveredCompetencies(durationMin)) {
    competencies[c.key] = { rating: 3, comment: "Automated scoring was interrupted — this is an indicative result." };
  }
  return {
    ...deriveScores(competencies, durationMin),
    roleFit: "Promising candidate with room to grow.",
    verdictReason: "Automated scoring was interrupted, so this is an indicative result — please review the detailed feedback below.",
    competencies,
    strengths: ["Engaged actively throughout the interview", "Attempted every question", "Showed willingness to learn"],
    concerns: ["Automated scoring was interrupted — re-run the interview for a precise assessment"],
    nextSteps: ["Practice structured STAR-method answers", "Record yourself and review your clarity", "Book another mock interview this week"],
  };
}

function parseReportJson(text: string, durationMin: number): InterviewReport | null {
  let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  // If the model wrapped the JSON in prose, keep only the outermost {...} block
  // so a stray sentence before/after the object doesn't break JSON.parse.
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const rawComp =
      parsed["competencies"] && typeof parsed["competencies"] === "object"
        ? (parsed["competencies"] as Record<string, unknown>)
        : {};
    // Keep only the competencies this interview length covers; default any
    // missing covered competency to a neutral 3 so every covered row still shows.
    const competencies: Partial<Record<CompetencyKey, CompetencyRating>> = {};
    for (const c of coveredCompetencies(durationMin)) {
      competencies[c.key] =
        rawComp[c.key] !== undefined
          ? parseCompetencyRating(rawComp[c.key])
          : { rating: 3, comment: "Only lightly tested in this interview." };
    }
    const concerns = Array.isArray(parsed["concerns"])
      ? parsed["concerns"].map(String)
      : Array.isArray(parsed["improvements"])
        ? parsed["improvements"].map(String)
        : [];
    return {
      ...deriveScores(competencies, durationMin),
      roleFit: String(parsed["roleFit"] || ""),
      verdictReason: String(parsed["verdictReason"] || parsed["recommendation"] || ""),
      competencies,
      strengths: Array.isArray(parsed["strengths"]) ? parsed["strengths"].map(String) : [],
      concerns,
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
  // coachThinking drives the "considering your answer" indicator during the
  // deliberate pause between the candidate finishing and the interviewer replying.
  const [coachThinking, setCoachThinking] = useState(false);
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
      const ttsText = cleanForSpeech(text);
      if (!ttsText) return;
      speech.pause();
      // Clear any previous safety timer before starting fresh
      if (coachSafetyTimerRef.current) { clearTimeout(coachSafetyTimerRef.current); coachSafetyTimerRef.current = null; }
      setCoachSpeaking(true);
      // 50 ms/char + 5 s base, minimum 16 s (just after the 15 s TTS hang-abort).
      // When this fires it means TTS hung — release the 10-min mic block that
      // speech.pause() set so the auto-listen effect can restart the mic.
      const safetyMs = Math.max(text.length * 50 + 5_000, 16_000);
      coachSafetyTimerRef.current = setTimeout(() => {
        coachSafetyTimerRef.current = null;
        speech.blockFor(400); // override the 10-min pause window → mic can retry
        setCoachSpeaking(false);
      }, safetyMs);
      void synth.speak(ttsText, "English", () => {
        if (coachSafetyTimerRef.current) { clearTimeout(coachSafetyTimerRef.current); coachSafetyTimerRef.current = null; }
        speech.blockFor(400); // mic reopens ~460ms after audio ends (well under 2s target)
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

  // B2B interview params — populated when this page is launched from a recruiter invite link.
  const b2bParams = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      token:    p.get("b2bToken"),
      type:     p.get("b2bType"),
      duration: p.get("b2bDuration") ? Number(p.get("b2bDuration")) : null,
      coach:    p.get("b2bCoach"),
    };
  }, []);
  const b2bToken = b2bParams.token;

  const [type, setType] = useState(() => b2bParams.type || mapPreferredRoleToType(profile.preferredRole));
  const [experience, setExperience] = useState(() => mapExperience(profile.experienceLevel));
  const [coach, setCoach] = useState<Coach>(() => {
    // B2B invites lock the interviewer to the recruiter's choice; otherwise the
    // interviewer is auto-matched to the interview type the candidate picked.
    if (b2bParams.coach) {
      return INTERVIEW_COACHES.find(c => c.id === b2bParams.coach) ?? INTERVIEW_COACHES[0]!;
    }
    return recommendedCoachFor(type);
  });
  const [duration, setDuration] = useState(() => b2bParams.duration || 10);
  const [phase, setPhase] = useState<"setup" | "interview" | "report">("setup");
  const [questions, setQuestions] = useState<QA[]>([]);
  const questionsRef = useRef<QA[]>([]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  // phaseRef mirrors `phase` so async callbacks (e.g. an in-flight submit) can
  // tell if the interview already ended without capturing a stale `phase`.
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
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
  const endingRef = useRef(false);
  // Guards against a second interview turn starting before the current one finishes
  // (record → stream → thinking pause → speak). Set synchronously at the top of
  // submitCurrentAnswer; reset reactively below when the coach stops speaking — which
  // marks the true end of a turn (coachSpeaking stays true through the thinking pause).
  const turnInFlightRef = useRef(false);
  useEffect(() => { if (!coachSpeaking) turnInFlightRef.current = false; }, [coachSpeaking]);
  // Diversified interview rotation: which "beat" (competency area) the current
  // question targets. Advances one beat per answered question so consecutive
  // questions cover DIFFERENT areas instead of chaining the same topic.
  const beatIdxRef = useRef(0);
  // Retries on the current beat, for the 2-attempt rule: a weak answer earns ONE
  // gentle re-ask; after that we move on to a fresh area rather than dwelling.
  const retryRef = useRef(0);
  // Interview credits are metered per block (1 credit each). The first block is
  // charged at start; this counts blocks charged so the meter stops at the max
  // (a full session costs at most INTERVIEW_MAX_BLOCKS credits).
  const interviewBlocksChargedRef = useRef(1);
  // Server-minted token for THIS tab's interview (from /charge); presented on
  // every tick/end so this tab can only bill/clear the interview it started.
  const interviewIdRef = useRef<string | null>(null);
  const answerRef = useRef("");
  // Webcam for video call mode
  const webcamRef = useRef<HTMLVideoElement>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const typeMeta = INTERVIEW_TYPES.find(t => t.value === type)!;
  const recommendedCoachId = recommendedCoachFor(type).id;
  // B2B invites lock the interviewer to the recruiter's choice — the candidate
  // must not be able to swap it (from the type dropdown or the coach grid).
  const coachLocked = !!b2bParams.coach;
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

  // Auto-end when the interview clock runs out. This fires even if the mic is
  // still recording (candidate went quiet near the end) — otherwise the session
  // could hang past its duration and never produce feedback. The coach gives a
  // short natural sign-off, any in-progress answer is captured so it counts in
  // the report, then we move to the report phase.
  useEffect(() => {
    if (phase !== "interview" || endingRef.current) return;
    if (elapsedSeconds < duration * 60) return;
    endingRef.current = true;
    // Abort any in-flight "next question" stream so it can't resolve after the
    // sign-off and tack on an extra question / make the coach speak again.
    resetStream();
    if (autoSubmitRef.current) { clearTimeout(autoSubmitRef.current); autoSubmitRef.current = null; }
    speech.stop();
    setIsRecording(false);
    setAutoListenEnabled(false);
    const pending = answerRef.current.trim();
    if (pending) {
      setQuestions(prev => prev.map((q, i) => i === currentIdx && !q.answer ? { ...q, answer: pending } : q));
    }
    const firstName = (profile.name || "there").split(" ")[0];
    speakCoach(`That is all the time we have, ${firstName}. Thank you for your time today. I will now prepare your feedback report.`, { voiceGender: coach.gender });
    setTimeout(() => setPhase("report"), 2600);
  }, [elapsedSeconds, duration, phase, currentIdx, profile.name, coach.gender, speakCoach, speech, resetStream]);

  const clearAutoSubmitTimer = useCallback(() => {
    if (autoSubmitRef.current) clearTimeout(autoSubmitRef.current);
    autoSubmitRef.current = null;
  }, []);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      // The interview may have ended (time-up / hang-up / final question) while the
      // permission prompt was still open. The phase-transition cleanup already ran
      // and won't fire again for this stream, so release it now instead of leaving
      // the camera live on the report screen.
      if (phaseRef.current !== "interview") {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
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

  // Auto-release the candidate's camera the moment the interview is over
  // (time-up, all questions answered, or hang-up). The webcam PiP lives only in
  // the "interview" phase, but this component stays mounted through the report,
  // so stop the stream on any transition out of "interview" instead of relying
  // on unmount.
  useEffect(() => {
    if (phase !== "interview") stopWebcam();
  }, [phase, stopWebcam]);

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
    // Unlock browser autoplay policy synchronously within the user-gesture stack.
    // Must run before any await so Chrome still considers this a gesture-initiated play.
    unlockAudio();
    // Don't decide guest vs. paid until auth has resolved — otherwise a signed-in
    // user could slip onto the free path before /api/auth/me returns.
    if (authLoading) {
      toast({ title: "One moment…", description: "Checking your account — please try again in a second." });
      return;
    }
    // Guests get 2 free interviews (no signup); signed-in users spend credits.
    if (!user && guestInterviewsLeft() <= 0) {
      toast({ title: "Free interviews used up", description: "Sign in to get 20 free credits and keep practising.", variant: "destructive" });
      return;
    }
    resetStream();
    const candidateName = profile.name || "there";
    const firstName = candidateName.split(" ")[0];
    const full = await stream(
      `You are ${coach.name}, a professional interviewer conducting a formal ${typeMeta.label} interview with ${firstName} (${experience} level).

This interview will cover a broad range of areas. Start by warmly introducing yourself in 1-2 short sentences — say your name and that you will be taking ${firstName}'s interview today, and put them at ease — then ask ONE clear opening question about their educational background: degree, key subjects, and any notable curricular or extra-curricular achievements relevant to the ${typeMeta.label} role.

Rules:
- Keep it to at most 3 sentences. Warm and professional — you want ${firstName} to feel relaxed. A little warmth is good; NO cheesy greetings like "Hey, good to see you", no small talk, no "let's dive in".
- Plain spoken words ONLY. No asterisks, no *actions*, no markdown, no quotes around your reply.
- Do NOT list rules, do NOT explain the interview process.
- LANGUAGE: Use simple, clear, everyday English — short sentences and common words. Many candidates are from average English-medium colleges, so avoid difficult vocabulary, idioms and long, complex sentences (${firstName}'s stated English level: ${profile.englishLevel || "Beginner"}).
- Ask exactly ONE question.`,
      `You are ${coach.name}, ${coach.role}. ${coach.style} You conduct professional but warm, encouraging interviews that cover a broad range of areas. Speak in clear, simple, everyday spoken English that an average Indian college graduate can easily follow. Never use markdown, action words, or effusive flattery.`,
      undefined,
      { maxTokens: 120 }
    );
    const opening = full.replace(/^\s*["']?|["']?\s*$/g, "").trim();
    if (!opening) return;
    // Now that a real interview is starting:
    // - Valid B2B token: company pays on completion — no charge to the candidate
    // - Guest (no b2b): consume free trial slot
    // - Signed-in user (no b2b): charge credits as usual
    if (b2bToken) {
      // Validate the invite token server-side BEFORE bypassing credit/trial checks.
      // This prevents fake tokens from granting unlimited free interviews.
      const baseCheck = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      try {
        const infoRes = await fetch(`${baseCheck}/api/b2b/invite/${b2bToken}/info`, { credentials: "include" });
        if (!infoRes.ok) {
          const d = await infoRes.json() as { error?: string };
          toast({ title: d.error ?? "Invalid invite link", description: "This interview link could not be verified.", variant: "destructive" });
          return;
        }
      } catch {
        toast({ title: "Could not verify invite link", description: "Check your internet connection and try again.", variant: "destructive" });
        return;
      }
      // Valid B2B invite — company's account is billed when the session is submitted
    } else if (!user) {
      consumeGuestInterview();
    } else {
      const charge = await chargeInterview(duration);
      if (!charge.ok) {
        if (charge.status === 402) {
          toast({
            title: "Not enough credits",
            description: `You need at least 1 credit to start (interviews are billed by the minute, up to ${interviewCreditCost(duration)}). You have ${charge.balance ?? 0}. Top up to continue.`,
            variant: "destructive",
          });
        } else if (charge.status === 409) {
          toast({ title: "Interview already in progress", description: "Finish or close your other interview tab before starting a new one.", variant: "destructive" });
        } else {
          toast({ title: "Couldn't start interview", description: charge.error ?? "Please try again.", variant: "destructive" });
        }
        return;
      }
      interviewIdRef.current = charge.interviewId ?? null;
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
    endingRef.current = false;
    beatIdxRef.current = 0;
    retryRef.current = 0;
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
    // Resuming: clear any lingering mic-block window (e.g. from a stuck pause())
    // so the auto-listen effect can start recognition immediately.
    speech.blockFor(0);
    setIsRecording(false); // force auto-listen effect to re-evaluate and restart
    setAutoListenEnabled(true);
  }, [autoListenEnabled, clearAutoSubmitTimer, speech]);

  const submitCurrentAnswer = useCallback(async (userAnswer: string) => {
    if (!userAnswer || !currentQ) return;
    // Non-reentrancy: never start a new turn while one is still in flight. The
    // deliberate thinking pause leaves isStreaming false for ~4.5s, so a manual
    // submit could otherwise start an overlapping turn and double-advance the
    // stage. The ref is synchronous, closing even a same-tick double submit.
    if (turnInFlightRef.current) return;
    turnInFlightRef.current = true;
    clearAutoSubmitTimer();
    setIsRecording(false);
    speech.stop();
    // Lock the coach-speaking flag BEFORE the async stream call so the auto-listen
    // effect never sees a window where isRecording=false AND coachSpeaking=false AND
    // isStreaming=false all at once (which would make it restart the mic mid-processing).
    setCoachSpeaking(true);
    const recordedAnswer = userAnswer.trim();
    setAnswer("");
    resetStream();

    const elapsedMin = Math.floor(elapsedSeconds / 60);
    const remainingMin = duration - elapsedMin;
    const isFinalQuestion = elapsedSeconds >= duration * 60 - 60;

    // Record the answer without generating per-question feedback
    setQuestions(prev => prev.map((q, i) => i === currentIdx
      ? { ...q, answer: recordedAnswer }
      : q
    ));

    const firstName = (profile.name || "there").split(" ")[0];

    if (isFinalQuestion) {
      speakCoach(`Thank you, ${firstName}. That concludes our interview. I will now prepare your feedback report.`, { voiceGender: coach.gender });
      setTimeout(() => setPhase("report"), 1500);
      return;
    }

    // Build recent interview history for context (last 3 answered questions)
    const recentAnswered = questionsRef.current
      .filter(q => q.answer)
      .slice(-3)
      .map((q, i) => `Q: ${q.question}\nA: ${q.answer}`)
      .join("\n\n");

    // Detect whether the candidate could not answer, so we can apply the
    // 2-attempt rule (give ONE more chance, then move on kindly) instead of
    // drilling the same question over and over.
    const wordCount = recordedAnswer.split(/\s+/).filter(Boolean).length;
    const lowerAnswer = recordedAnswer.toLowerCase();
    const saysDontKnow = /\b(i (?:really |just )?(?:don'?t|do not) know|not sure|no idea|can'?t (?:recall|remember|answer)|don'?t (?:recall|remember)|i'?m not sure|no clue|not aware|please skip|skip this|next question|let'?s move on|move to the next)\b/.test(lowerAnswer);
    const isWeakAnswer = saysDontKnow || wordCount < 8;

    // DIVERSIFIED rotation: each question targets a DIFFERENT competency area so
    // the interview never becomes a chain of near-identical questions. We advance
    // one beat per answered question. 2-attempt rule: a weak answer re-probes the
    // SAME area ONCE (a gentle rephrase/hint); if it is still weak we move on to a
    // fresh area instead of dwelling. Refs are committed only after a valid
    // question is produced (below), so an aborted/errored turn never skips.
    const willRetry = isWeakAnswer && retryRef.current < 1;
    const nextRetry = willRetry ? retryRef.current + 1 : 0;
    const targetBeatIdx = willRetry ? beatIdxRef.current : beatIdxRef.current + 1;
    const area = areaForBeat(targetBeatIdx, {
      durationMin: duration,
      experience,
      type: typeMeta.value,
      roleLabel: typeMeta.label,
    });
    // areaForBeat already composes the full focus (role-specific for domain
    // knowledge, experience-specific for the depth probe), so use it directly.
    const areaFocus = area.focus;

    let directive: string;
    if (willRetry) {
      directive = `${firstName} struggled with that question${saysDontKnow ? " (they said they don't know)" : ` (only ${wordCount} words)`}. Give them ONE more chance: ask the SAME thing again but more simply, or offer a small hint, a concrete example, or an easier way in. Keep it warm and encouraging so they relax — this is still about "${area.label}".`;
    } else if (isWeakAnswer) {
      directive = `${firstName} could not answer that even after a second attempt — do NOT dwell on it or ask it again. Acknowledge briefly and kindly (something like "No problem, let's move on."), then ask a fresh question on a NEW area. New area — ${area.label}. Focus on: ${areaFocus}.`;
    } else {
      directive = `Now move to a DIFFERENT area to keep the interview varied — do NOT keep drilling the previous topic. New area — ${area.label}. Focus on: ${areaFocus}. You may briefly connect to what they just said, but the question itself must target this new area. Ask a genuinely fresh question you have not asked before.`;
    }

    let response: string;
    // ── Thinking-pause guarantee ───────────────────────────────────────────────
    // Target: interviewer ALWAYS starts speaking within 4 s of the candidate stopping.
    // Hard cap: NEVER exceed 4 s (reply-within-4-seconds rule).
    //
    // Strategy: start a 3 s minimum-wait timer IN PARALLEL with the AI stream
    // call so streaming latency counts toward the pause window.  After the stream
    // resolves we wait only the *remaining* time up to naturalPauseMs (≤ 4 s).
    // This guarantees:
    //   • fast stream (< 3 s)  → always waits at least the 3 s floor
    //   • medium stream (3–4 s) → fires within the natural window
    //   • slow stream (> 4 s)  → fires immediately (network-constrained, best effort)
    const thinkStart = Date.now();

    // Compute target pause length based on answer length (determined before this call).
    // Range 3 000–4 000 ms; short answers get quicker replies, long ones a touch more.
    const naturalPauseMs = (() => {
      let base: number;
      if (wordCount < 15) {
        base = 3000 + Math.random() * 400;   // 3.0–3.4 s
      } else if (wordCount < 50) {
        base = 3200 + Math.random() * 500;   // 3.2–3.7 s
      } else {
        base = 3400 + Math.random() * 500;   // 3.4–3.9 s
      }
      // Hesitation markers → slight extra hesitation (stays within cap)
      if (/\b(um+|uh+|hmm+|err+|like,? you know|i mean|so,? basically|basically)\b/i.test(recordedAnswer)) {
        base += Math.random() * 300;
      }
      return Math.min(4000, Math.max(3000, Math.round(base)));
    })();

    // Neutral fallback questions used when the AI stream times out or errors.
    // Defined here so they're available both in the timeout path and the parsing fallback below.
    const FALLBACK_QUESTIONS = [
      "Could you elaborate on that a little more?",
      "Can you give me a specific example from your experience?",
      "Please walk me through that in more detail.",
      "What was the biggest challenge you faced in that situation?",
    ];

    // Kick off the minimum 3 s floor immediately — runs while streaming proceeds.
    const minWaitPromise = new Promise<void>(resolve => setTimeout(resolve, 3000));

    // Hard deadline: if the AI hasn't replied in 3 800 ms, inject a fallback so
    // the interviewer ALWAYS starts speaking within 4 s of the candidate stopping.
    const STREAM_DEADLINE_MS = 3800;
    let streamTimedOut = false;
    const streamDeadlinePromise = new Promise<string>(resolve =>
      setTimeout(() => { streamTimedOut = true; resolve(""); }, STREAM_DEADLINE_MS)
    );

    setCoachThinking(true);
    try {
      response = await Promise.race([
        stream(
          `You are ${coach.name} conducting a friendly but professional ${typeMeta.label} interview. ${remainingMin} minutes left.

Candidate: ${firstName} | ${buildProfileSummary()}

Recent exchanges:
${recentAnswered || "(This is the first response)"}

Your last question: "${currentQ.question}"
${firstName} answered: "${recordedAnswer}"

${directive}

STYLE — important:
- Warm, encouraging and human — you genuinely want ${firstName} to do well and feel at ease. You MAY add a light, tasteful touch of humour now and then to relax them, but never sarcasm, never at their expense, and keep it to a brief aside.
- Acknowledge their answer with ONE short, genuine phrase (max about 6 words). Do NOT summarise their whole answer and do NOT pile on flattery.
- Ask EXACTLY ONE question, and NEVER repeat a question already asked in this interview.
- The interview must feel DIVERSIFIED across the whole scorecard — functional/role knowledge, problem-solving, adaptability, ownership & work ethic, collaboration and IT skills, plus their background — not a chain of similar questions. Do NOT keep asking only about functional/domain knowledge; keep moving across the different areas.
- LANGUAGE LEVEL: By default ask in SIMPLE, clear, everyday English — short sentences, common words — because many candidates are from average English-medium colleges. Judge ${firstName}'s own English from their answers so far: if they are clearly fluent and comfortable, you may use richer vocabulary and slightly more complex questions to match them; if they struggle, make your wording even simpler. Never make a question harder to follow than the candidate can handle.
- Use ${firstName}'s name sparingly.
- Plain spoken words ONLY: no markdown, no asterisks, no *actions*, no stage directions, no quotes around your reply.
- The Next line must be the question ONLY — no greeting, no preamble, no name.

Output format — exactly two lines, nothing else:
Ack: <short, warm acknowledgement, max ~6 words>
Next: <the interview question only>`,
          `You are ${coach.name}, ${coach.role}. ${coach.style} You conduct a professional but warm, encouraging interview that covers a BROAD range of areas and never fixates on one topic. Light, tasteful humour to relax the candidate is welcome. Speak in clear, simple, everyday English by default, and use more advanced English only for candidates who clearly speak strongly. Never use markdown, action words, or effusive flattery.`,
          undefined,
          { maxTokens: 220 }
        ),
        streamDeadlinePromise,
      ]);
    } catch {
      // Stream threw — inject a fallback so the interview keeps moving (no silent drop).
      const fallback = FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)]!;
      response = `Ack: I see.\nNext: ${fallback}`;
    }

    // If the 3.8 s deadline fired OR stream returned empty, cancel the in-flight
    // stream and inject a fallback so the 4 s window is respected.
    if (streamTimedOut || !response.trim()) {
      resetStream();
      const fallback = FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)]!;
      response = `Ack: I see.\nNext: ${fallback}`;
    }

    // If the interview ended while the stream was in flight, stop here.
    if (endingRef.current || phaseRef.current !== "interview") { setCoachThinking(false); return; }

    // Robust parsing — tolerates multiline Ack, minor model format drift, or
    // missing labels. Prevents premature session-end if the model skips "Next:".
    const ackMatch = response.match(/^Ack:\s*([\s\S]+?)(?=\nNext:|\n\nNext:|$)/im);
    const nextMatch = response.match(/^Next:\s*([\s\S]+?)$/im);
    let acknowledgment = ackMatch?.[1]?.trim().replace(/\n+/g, " ") ?? "Thank you.";
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
        acknowledgment = "Understood.";
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
    if (!nextQuestion) {
      nextQuestion = FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)]!;
      acknowledgment = "Understood.";
    }

    // ── Enforce 3–4 s thinking window ─────────────────────────────────────────
    // Step 1: ensure the 3 s floor has elapsed (timer started BEFORE stream call).
    await minWaitPromise;
    // Guard: interview may have ended during stream/minWait — don't continue.
    if (endingRef.current || phaseRef.current !== "interview") { setCoachThinking(false); return; }
    // Step 2: wait any remaining time up to naturalPauseMs, but hard-clamp against
    // the absolute wall-clock budget (4 000 ms from thinkStart) to prevent drift.
    const wallRemaining = 4000 - (Date.now() - thinkStart);
    const targetRemaining = naturalPauseMs - (Date.now() - thinkStart);
    const remainingWait = Math.min(wallRemaining, targetRemaining);
    if (remainingWait > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingWait));
    }
    // Re-check after the final wait — the interview may have ended during the pause.
    if (endingRef.current || phaseRef.current !== "interview") { setCoachThinking(false); return; }
    setCoachThinking(false);

    // Commit the beat advance + retry counter now that we have a valid question.
    beatIdxRef.current = targetBeatIdx;
    retryRef.current = nextRetry;
    setQuestions(prev => [...prev, { question: nextQuestion! }]);
    setCurrentIdx(prev => prev + 1);
    setAnswer("");
    setIsRecording(false);
    const pitchVariation = coach.gender === "male" ? 0.88 + Math.random() * 0.06 : 1.06 + Math.random() * 0.06;
    speakCoach(`${acknowledgment} ${nextQuestion}`, { voiceGender: coach.gender, pitch: pitchVariation });
  }, [currentQ, currentIdx, experience, duration, elapsedSeconds, coach, stream, resetStream, synth, typeMeta, buildProfileSummary, buildTranscript, clearAutoSubmitTimer, speech, profile]);

  /**
   * submitCurrentAnswerRef — always points to the latest submitCurrentAnswer.
   * Used in the auto-listen startContinuous callback so the callback closure
   * doesn't need submitCurrentAnswer in deps. Without this, the elapsedSeconds
   * dep in submitCurrentAnswer causes a new reference every second, which makes
   * the auto-listen effect re-run every second and its cleanup clears the 800ms
   * auto-submit timer before it can fire — the user's answer is never submitted.
   */
  const submitCurrentAnswerRef = useRef<typeof submitCurrentAnswer>(submitCurrentAnswer);
  useEffect(() => { submitCurrentAnswerRef.current = submitCurrentAnswer; }, [submitCurrentAnswer]);

  const submitAnswer = useCallback(() => {
    if (!answer.trim() || turnInFlightRef.current) return;
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
    endingRef.current = true;
    clearAutoSubmitTimer();
    speech.stop();
    synth.stop();
    stopWebcam();
    setIsRecording(false);
    setAutoListenEnabled(false);
    setPhase("report");
  }, [speech, synth, clearAutoSubmitTimer, stopWebcam]);

  // Keep a live ref to endEarly so the long-interval billing timer below is not
  // torn down every render. endEarly's deps (speech/synth) are fresh objects each
  // render and this page re-renders every second — without the ref the interval
  // would be cleared before a block ever elapses, so ticks would never fire.
  const endEarlyRef = useRef(endEarly);
  useEffect(() => { endEarlyRef.current = endEarly; }, [endEarly]);

  // Release the server-side interview meter when the interview ends (any path to
  // the report) or the user leaves mid-interview, so the "one interview per
  // account at a time" lock frees promptly and the next start isn't rejected.
  const activeUserRef = useRef(user);
  useEffect(() => { activeUserRef.current = user; }, [user]);
  useEffect(() => {
    if (phase === "report" && user) void endInterview(interviewIdRef.current ?? undefined);
  }, [phase, user]);
  useEffect(() => () => { if (activeUserRef.current) void endInterview(interviewIdRef.current ?? undefined); }, []);

  // Meter interview credits by ACTUAL usage: 1 credit per block entered, with the
  // first block already charged at start, so leaving early costs less and a full
  // session costs at most INTERVIEW_MAX_BLOCKS credits. If the balance runs out
  // mid-interview, end gracefully to the report. Guests use free trials, not credits.
  useEffect(() => {
    if (phase !== "interview" || !user) return;
    interviewBlocksChargedRef.current = 1; // block 1 was charged at start
    const blockMs = interviewBlockSeconds(duration) * 1000;
    const id = setInterval(async () => {
      if (phaseRef.current !== "interview" || endingRef.current) return;
      if (interviewBlocksChargedRef.current >= INTERVIEW_MAX_BLOCKS) { clearInterval(id); return; }
      const nextBlock = interviewBlocksChargedRef.current + 1;
      const r = await tickInterview(nextBlock, interviewIdRef.current ?? undefined);
      if (r.ok) {
        interviewBlocksChargedRef.current = nextBlock;
      } else if (r.status === 402 || r.status === 401 || r.status === 409) {
        clearInterval(id);
        if (endingRef.current) return;
        if (r.status === 402) {
          toast({ title: "Credits used up", description: "Wrapping up your interview now. Top up to practise longer next time.", variant: "destructive" });
        }
        endEarlyRef.current();
      }
    }, blockMs);
    return () => clearInterval(id);
  }, [phase, user, duration, toast]);

  useEffect(() => {
    // coachSpeaking guard: don't start mic while the AI coach is speaking — prevents
    // the mic from activating between when the stream ends and when TTS actually starts.
    if (phase !== "interview" || !autoListenEnabled || !speech.isSupported || !currentQ || isStreaming || synth.isSpeaking || isRecording || coachSpeaking) return;
    // Silence window before auto-submit: 5 s max. Once the candidate starts
    // talking, 5 s of continuous quiet ends their turn and submits the answer.
    // (Initial thinking before the FIRST word is still unlimited — the timer below
    // is only armed once the candidate starts talking.) The Submit button stays
    // enabled the whole time as a manual override to submit sooner.
    const silenceMs = 5000;
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
      // 5 s of quiet → auto-submit. Long enough that a candidate with natural
      // mid-sentence pauses isn't cut off mid-thought, short enough to keep the
      // interview moving. The Submit button stays enabled as a manual override.
      // Uses submitCurrentAnswerRef (not submitCurrentAnswer directly) so the
      // closure always calls the latest version without adding submitCurrentAnswer
      // to deps. Without this, elapsedSeconds (a dep of submitCurrentAnswer) gives
      // it a new reference every second → effect re-runs every second → cleanup
      // fires clearAutoSubmitTimer() before it elapses → answer never submitted.
      autoSubmitRef.current = setTimeout(() => {
        const latest = answerRef.current.trim();
        if (latest) void submitCurrentAnswerRef.current(latest);
      }, silenceMs);
    });
    // No clearAutoSubmitTimer in cleanup: timer must survive normal dep changes.
    // Unmount cleanup is handled by the dedicated effect above. Clearing here
    // would cancel in-flight auto-submits whenever any dep ticks (e.g. speech.status).
  }, [phase, currentQ, autoListenEnabled, speech.isSupported, speech.startContinuous, isStreaming, synth.isSpeaking, isRecording, coachSpeaking, clearAutoSubmitTimer]);

  // Watchdog: if isRecording is true but the recognition has silently died
  // (speech status is "idle" for 4+ seconds while nothing else is blocking),
  // reset isRecording so the auto-listen effect above retries startContinuous.
  useEffect(() => {
    if (phase !== "interview" || !autoListenEnabled) return;
    const id = setInterval(() => {
      if (
        isRecording &&
        speech.status === "idle" &&
        !coachSpeaking &&
        !synth.isSpeaking &&
        !isStreaming
      ) {
        setIsRecording(false); // triggers auto-listen effect to restart mic
      }
    }, 4_000);
    return () => clearInterval(id);
  }, [phase, autoListenEnabled, isRecording, speech.status, coachSpeaking, synth.isSpeaking, isStreaming]);

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

      // Build the covered-competency list + JSON template for THIS interview
      // length so the model only scores what the format actually covers.
      const covered = coveredCompetencies(duration);
      const compLines = covered
        .map((c) => {
          const focus =
            c.key === "domainKnowledge"
              ? `${c.focus} — ${functionalKnowledgeFor(typeMeta.value, typeMeta.label)}`
              : c.focus;
          return `- "${c.key}" — ${c.label} (weight ${Math.round(c.weight * 100)}%): ${focus}`;
        })
        .join("\n");
      const compJsonKeys = covered
        .map((c) => `    "${c.key}": {"rating": 1-5, "comment": "one concise sentence citing specific evidence from the transcript"}`)
        .join(",\n");

      const reportText = await stream(
        `You are an expert interview panellist scoring a mock interview against a structured, weighted competency scorecard.

Role: ${typeMeta.label}
Candidate experience level: ${experience}
Interview length: ${duration} minutes (${formatTime(elapsedSeconds)} used)
Profile: ${buildProfileSummary()}

CALIBRATION — read carefully: ${calibrationFor(experience)}

Rate each competency on this 1-5 scale, calibrated to the experience level above:
1 = Considerable improvement, 2 = Moderate improvement, 3 = Meets expectations, 4 = Exceeds expectations, 5 = Outstanding.

Score ALL of these competencies for this candidate — every parameter must be rated:
${compLines}

Full interview transcript:
${transcript}

Return ONLY a valid JSON object with exactly these keys (no markdown, no commentary before or after):
{
  "competencies": {
${compJsonKeys}
  },
  "roleFit": "one honest sentence about this candidate for this role",
  "strengths": ["2-3 specific strengths observed in the transcript"],
  "concerns": ["2-3 honest concerns or red flags — use an empty array [] ONLY if there are genuinely none"],
  "nextSteps": ["3 concrete, actionable steps to improve"],
  "verdictReason": "1-2 honest sentences summarising your hiring recommendation for THIS role at THIS experience level and why"
}

Rate EVERY competency above from evidence in the transcript, calibrated to the experience level — do not leave any unrated. Communication Skills and Personality & Disposition are judged from HOW the candidate expressed every answer (tone, energy, clarity), not from dedicated questions; you cannot see the candidate, so judge personality from vocal energy and content only and never invent visual details like body language, dress or eye contact. Educational Background comes from their introduction. If a competency was only lightly tested in this interview, infer conservatively from the overall conversation and say so in its comment rather than guessing high. Be fair, specific and honest — never inflate a candidate who lacks the core functional knowledge for the role. Use Indian hiring context.`,
        `You are a senior hiring manager and interview panellist evaluating an Indian candidate against a weighted scorecard. Give human, realistic, honest feedback and rate strictly on the 1-5 scale.`,
        undefined,
        { maxTokens: 2000 }
      );

      const parsed = parseReportJson(reportText, duration) ?? neutralReport(duration);

      // Per-question feedback is ALWAYS fetched in a separate, focused call.
      // Keeping it out of the main report keeps that JSON small, so the overall
      // scores and competencies never get lost to truncation (the old cause of a
      // uniform-60 fallback when a long questionScores array overflowed the cap).
      {
        const fbText = await stream(
          `You are an interview coach. For each answer below, give a 2-3 sentence honest, natural, specific feedback.

${answered.map((q, i) => `Q${i + 1}: ${q.question}\nAnswer: ${q.answer ?? ""}`).join("\n\n")}

Return ONLY a valid JSON array (no markdown) with one object per question in order:
[{"score":1-10,"communication":1-10,"grammar":1-10,"confidence":1-10,"technical":1-10,"feedback":"2-3 sentences"}]`,
          `You are a concise interview evaluator. Be honest, specific, and encouraging.`,
          undefined,
          { maxTokens: 2000 }
        );
        let cleaned = fbText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const firstBracket = cleaned.indexOf("[");
        const lastBracket = cleaned.lastIndexOf("]");
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          cleaned = cleaned.slice(firstBracket, lastBracket + 1);
        }
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
  }, [phase, report, isGeneratingReport, questions, typeMeta, experience, elapsedSeconds, duration, stream, buildProfileSummary]);

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

    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    if (b2bToken) {
      // B2B: submit to the recruiter endpoint (works for both guests and logged-in users)
      try {
        const res = await fetch(`${base}/api/b2b/invite/${b2bToken}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ...payload, candidateName: profile.name || undefined }),
        });
        if (!res.ok) throw new Error("B2B submit failed");
        toast({ title: "Interview submitted", description: "Your results have been shared with the company." });
      } catch {
        toast({ title: "Could not submit results", description: "Your report was saved locally.", variant: "destructive" });
      }
    } else if (user) {
      try {
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
      report ? `Total Weighted Score: ${report.weightedScore.toFixed(1)} / 5.0 (${report.overallScore}%) — ${report.recommendation}` : `Overall Score: ${avgScore}% — ${grade(avgScore).label}`,
      report ? `Result: ${verdictFor(report.overallScore).label}${report.verdictReason ? ` — ${report.verdictReason}` : ""}` : `Result: ${verdictFor(avgScore).label}`,
      report ? `Role Fit: ${report.roleFit}` : "",
      ``,
      ...(report?.competencies ? [
        `COMPETENCY SCORECARD (rated 1-5)`,
        ...COMPETENCIES.filter(c => report.competencies![c.key]).map(c => {
          const cr = report.competencies![c.key]!;
          return `${c.label} (${Math.round(c.weight * 100)}%): ${cr.rating}/5 — ${ratingLabel(cr.rating)}${cr.comment ? ` — ${cr.comment}` : ""}`;
        }),
        ``,
      ] : []),
      `STRENGTHS`,
      ...(report ? report.strengths : []),
      ``,
      `CONCERNS / RED FLAGS`,
      ...(report ? (report.concerns.length ? report.concerns : ["None noted."]) : []),
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
      <div className="container mx-auto px-4 max-w-4xl pt-3 pb-4">
        {/* Compact header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-display font-bold text-secondary leading-tight">Interview Ace</h1>
            <p className="text-xs text-muted-foreground">AI mock interviews · Voice-powered · India-focused</p>
          </div>
        </div>

        {/* Settings bar */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-sm font-semibold text-secondary truncate">
            {profile.name || user?.name || "Guest"}
          </span>
          <span className="text-muted-foreground/40">•</span>
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v);
              // Re-match the interviewer to the new type (unless a B2B invite locked it).
              if (!b2bParams.coach) setCoach(recommendedCoachFor(v));
            }}
          >
            <SelectTrigger className="h-7 text-xs w-[150px] rounded-full border-dashed">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVIEW_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={experience} onValueChange={setExperience}>
            <SelectTrigger className="h-7 text-xs w-[110px] rounded-full border-dashed">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPERIENCE_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(duration)} onValueChange={v => setDuration(Number(v))}>
            <SelectTrigger className="h-7 text-xs w-[110px] rounded-full border-dashed">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Coach grid — compact. Auto-matched to the interview type; tap to override. */}
        <div className="flex items-baseline gap-2 mb-2 flex-wrap">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Interviewer</p>
          <span className="text-[10px] font-medium text-muted-foreground/70 normal-case">
            {coachLocked ? "Set by the recruiter for this invite" : `Auto-matched to ${typeMeta.label} · tap to change`}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-3">
          {INTERVIEW_COACHES.map(c => (
            <button
              key={c.id}
              onClick={() => { if (!coachLocked) setCoach(c); }}
              disabled={coachLocked && coach.id !== c.id}
              className={`text-left rounded-xl border-2 p-3 transition-all ${
                coach.id === c.id
                  ? "border-primary shadow-md bg-primary/5"
                  : coachLocked
                    ? "border-border bg-card opacity-40 cursor-not-allowed"
                    : "border-border bg-card hover:border-primary/40 hover:shadow-md"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <AnimatedAvatar
                  name={c.name}
                  subtitle={c.role}
                  isSpeaking={false}
                  gender={c.gender}
                  size="sm"
                  imageSrc={c.imageSrc}
                />
                {coach.id === c.id && <CheckCircle2 className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />}
              </div>
              <p className="font-bold text-xs text-secondary truncate">{c.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs">{c.icon}</span>
                <span className="text-[10px] font-semibold text-muted-foreground truncate">{c.specialty}</span>
              </div>
              {c.id === recommendedCoachId && (
                <span className="mt-1 inline-block rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                  Recommended
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Inline start bar */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border shadow-sm">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-secondary truncate">
              {typeMeta.icon} {typeMeta.label} · {experience} · {duration} min · {coach.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user ? (
                <>Up to <span className="font-semibold text-secondary">{interviewCost} credits</span> · billed by the minute · Balance: <span className="font-semibold">{balance ?? "…"}</span> · <Link href="/credits" className="text-primary font-semibold hover:underline">Top up</Link></>
              ) : guestInterviewsRemaining > 0 ? (
                <><span className="font-semibold text-green-700">{guestInterviewsRemaining} free {guestInterviewsRemaining === 1 ? "interview" : "interviews"}</span> left · <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link> for 20 free credits</>
              ) : (
                <>Free interviews used up · <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link> for 20 free credits</>
              )}
            </p>
          </div>
          <Button className="shrink-0 font-bold shadow-md shadow-primary/20" onClick={startSession} disabled={isStreaming}>
            {isStreaming
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Preparing…</>
              : <><PlayCircle className="w-4 h-4 mr-1.5" />Begin</>}
          </Button>
        </div>
      </div>
    );
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  if (phase === "report") {
    const answered = questions.filter(q => q.answer);
    const avgScore = avgOf(answered.map(q => q.score)) * 10;
    const durationMin = Math.round(elapsedSeconds / 60);
    const g = grade(avgScore); // fallback styling used only when there is no AI report

    return (
      <div className="min-h-full container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Hero */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <AnimatedAvatar name={coach.name} subtitle={coach.role} isSpeaking={false} gender={coach.gender} size="lg" imageSrc={coach.imageSrc} />
          </div>
          <h1 className="text-3xl font-display font-bold text-secondary mt-2 mb-3">Interview Complete!</h1>

          {report ? (
            <>
              {(() => {
                const style = RECOMMENDATION_STYLES[report.recommendation];
                return (
                  <div className={`inline-flex items-center gap-4 px-6 py-4 rounded-2xl border-2 ${style.badge}`}>
                    <div className="text-left leading-none">
                      <span className={`text-5xl font-extrabold ${style.text}`}>{report.weightedScore.toFixed(1)}</span>
                      <span className={`text-xl font-bold ${style.text}`}> / 5.0</span>
                    </div>
                    <div className="text-left border-l-2 pl-4">
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${style.text}`}>Recommendation</div>
                      <div className={`text-lg font-extrabold ${style.text}`}>{report.recommendation}</div>
                      <div className={`text-xs font-semibold ${style.text} opacity-80`}>{report.overallScore}% overall</div>
                    </div>
                  </div>
                );
              })()}
              {(() => {
                const v = verdictFor(report.overallScore);
                return (
                  <div className="mt-4">
                    <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm border-2 ${v.selected ? "bg-green-100 text-green-800 border-green-300" : "bg-red-100 text-red-800 border-red-300"}`}>
                      {v.selected ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      Result: {v.label}
                    </div>
                    {report.verdictReason && (
                      <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">{report.verdictReason}</p>
                    )}
                    {report.roleFit && (
                      <p className="text-sm text-secondary mt-2 max-w-xl mx-auto italic">{report.roleFit}</p>
                    )}
                  </div>
                );
              })()}
            </>
          ) : (
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl border-2 ${g.bg}`}>
              <span className={`text-5xl font-extrabold ${g.color}`}>{avgScore}</span>
              <div className="text-left">
                <div className={`text-xs font-bold uppercase tracking-wider ${g.color}`}>Overall Score</div>
                <div className={`text-lg font-bold ${g.color}`}>{g.label}</div>
              </div>
            </div>
          )}

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
            {report.competencies && (
              <Card className="border shadow-sm">
                <CardHeader className="pb-2 pt-5 px-5">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Competency Scorecard
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Rated 1–5 · weighted to a {report.weightedScore.toFixed(1)} / 5.0 total for this {durationMin}-min interview
                  </p>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-4">
                  {COMPETENCIES.filter(c => report.competencies![c.key]).map(c => {
                    const cr = report.competencies![c.key]!;
                    return (
                      <div key={c.key}>
                        <div className="flex items-center justify-between mb-1.5 gap-3">
                          <span className="text-sm font-bold text-secondary">
                            {c.label}
                            <span className="text-xs font-medium text-muted-foreground ml-1.5">{Math.round(c.weight * 100)}%</span>
                          </span>
                          <span className="text-xs font-bold text-secondary whitespace-nowrap">{cr.rating}/5 · {ratingLabel(cr.rating)}</span>
                        </div>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(n => (
                            <div key={n} className={`h-2 flex-1 rounded-full ${n <= cr.rating ? "bg-primary" : "bg-muted"}`} />
                          ))}
                        </div>
                        {cr.comment && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{cr.comment}</p>}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

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
                    <AlertCircle className="w-4 h-4" />Concerns / Red Flags
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  {report.concerns.length > 0 ? (
                    <ul className="space-y-2">
                      {report.concerns.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                          <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />{s}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No significant concerns noted — a clean interview.</p>
                  )}
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
              isThinking={isStreaming || coachThinking}
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
          {(isStreaming || coachThinking) && !synth.isSpeaking && (
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
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shrink-0 transition-colors ${
            isRecording
              ? speech.status === "warming"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-white/10 text-white/40"
          }`}>
            {isRecording ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
            {isRecording
              ? speech.status === "warming"
                ? "Get ready…"
                : "Speak now 🎤"
              : speech.isSupported
                ? "Mic paused"
                : "No mic"}
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
            disabled={!answer.trim() || isStreaming || coachSpeaking || coachThinking}
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
