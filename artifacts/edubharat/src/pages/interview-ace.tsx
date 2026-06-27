import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useHistory } from "@/lib/use-history";
import { useProgress } from "@/lib/use-progress";
import { useGeminiStream } from "@/lib/use-gemini-stream";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { useSpeechSynthesis } from "@/lib/use-speech-synthesis";
import { useStudentProfile } from "@/lib/use-student-profile";
import { AnimatedAvatar } from "@/components/avatar";
import { INTERVIEW_COACHES } from "@/lib/tutors";
import {
  Loader2, Mic, MicOff, PlayCircle, ChevronRight, Download, Volume2,
  LogOut, CheckCircle2, ChevronDown, MessageCircle, Pencil, Flame, Brain,
  Star, Trophy,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a sub-score from AI feedback — handles colon, dash, slash, markdown, and /10 suffixes */
function parseSubScore(text: string, key: string): number | undefined {
  // Match patterns like "Communication: 7", "Communication - 7/10", "**Communication**: 8/10", "communication – 7"
  const pattern = new RegExp(
    `\\b${key}\\b[^\\d]{0,10}(\\d{1,2})(?:\\s*\\/\\s*10)?`,
    "i"
  );
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
  if (score >= 9) return { label: "Outstanding", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
  if (score >= 8) return { label: "Excellent", color: "text-green-700", bg: "bg-green-50 border-green-200" };
  if (score >= 7) return { label: "Good", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" };
  if (score >= 6) return { label: "Average", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" };
  return { label: "Needs Work", color: "text-red-700", bg: "bg-red-50 border-red-200" };
}

// ─── Small components ─────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const g = grade(score);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold border ${g.bg} ${g.color}`}>
      {score}/10
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
        <span className={`text-xs font-bold ${color}`}>{value}/10</span>
      </div>
      <Progress value={value * 10} className="h-2" />
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

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function InterviewAce() {
  const { save } = useHistory();
  const { track } = useProgress();
  const { text: streamText, isStreaming, stream, reset: resetStream } = useGeminiStream();
  const synth = useSpeechSynthesis();
  const speech = useSpeechRecognition("English");
  const { profile } = useStudentProfile();

  const mapExperience = (raw: string): string => {
    // Check most specific patterns first to avoid substring collisions
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
  const [coach, setCoach] = useState<Coach>(INTERVIEW_COACHES[0]!);
  const [phase, setPhase] = useState<"setup" | "interview" | "report">("setup");
  const [questions, setQuestions] = useState<QA[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [autoListenEnabled, setAutoListenEnabled] = useState(true);
  const [autoAdvanceCount, setAutoAdvanceCount] = useState<number | null>(null);
  const [sessionStart, setSessionStart] = useState(() => Date.now());
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerRef = useRef("");

  const typeMeta = INTERVIEW_TYPES.find(t => t.value === type)!;
  const currentQ = questions[currentIdx];
  const avgScore = questions.filter(q => q.score !== undefined).reduce((a, b, _, arr) =>
    a + (b.score ?? 0) / arr.length, 0);

  useEffect(() => { answerRef.current = answer; }, [answer]);

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

  useEffect(() => {
    if (currentQ?.feedback && phase === "interview") {
      setAutoAdvanceCount(5);
      autoAdvanceRef.current = setInterval(() => {
        setAutoAdvanceCount(prev => {
          if (prev === null || prev <= 1) { clearInterval(autoAdvanceRef.current!); return null; }
          return prev - 1;
        });
      }, 1000);
    } else {
      setAutoAdvanceCount(null);
      if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    }
    return () => { if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current); };
  }, [currentQ?.feedback]);

  useEffect(() => { if (autoAdvanceCount === 0) nextQuestion(); }, [autoAdvanceCount]);

  const startSession = useCallback(async () => {
    resetStream();
    const label = typeMeta.label;
    const full = await stream(
      `Generate 8 natural interview questions for a ${label} role in India for a ${experience} candidate.
Rules:
- sound like a real ${coach.role}, not a robot
- one question per line
- mix opening, competency, scenario, and behavioral prompts
- vary the tone slightly across the list
- no numbering, no intro, no closing text
- keep them conversational and specific
- if appropriate, include a light follow-up cue inside the question itself`,
      `You are ${coach.name}, ${coach.role}. Style: ${coach.style}. Keep the flow natural, polite, and human.`
    );
    const lines = full.split("\n").map(l => l.trim()).filter(Boolean);
    const parsed: QA[] = lines.slice(0, 8).map(l => ({ question: l.replace(/^\d+[.)]\s*/, "").trim() }));
    if (parsed.length === 0) return;
    clearAutoSubmitTimer();
    setQuestions(parsed);
    setCurrentIdx(0);
    setAnswer("");
    setIsRecording(false);
    setAutoListenEnabled(true);
    setSessionStart(Date.now()); // reset duration timer for each new session
    setPhase("interview");
    setTimeout(() => synth.speak(parsed[0]!.question, "English"), 300);
  }, [type, experience, coach, stream, resetStream, synth, typeMeta, clearAutoSubmitTimer]);

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
    const feedback = await stream(
      `Q: "${currentQ.question}"
Answer: "${userAnswer}"
Role: ${label}, ${experience}. Interviewer: ${coach.name} (${coach.style}).

Return EXACTLY these sections (no extras):
Reaction: a brief natural interviewer reaction in one sentence.
Score: X/10
Communication: X/10
Grammar: X/10
Confidence: X/10
Technical: X/10
Strengths: 2 short bullets
Improvements: 2 short bullets
Ideal Answer: 2-3 line model answer
Follow-up: one realistic next question

Keep it warm, human, and realistic for an Indian hiring interview. Avoid robotic phrasing and generic praise.`,
      `You are ${coach.name}, ${coach.role}. ${coach.style}. Give natural, practical feedback to an Indian candidate.`
    );

    const scoreMatch = feedback.match(/^score[:\s]+(\d+)/im) ?? feedback.match(/(\d+)\s*\/\s*10/i);
    const score = scoreMatch ? Math.min(10, Math.max(1, parseInt(scoreMatch[1]!))) : 6;
    const communication = parseSubScore(feedback, "Communication");
    const grammar = parseSubScore(feedback, "Grammar");
    const confidence = parseSubScore(feedback, "Confidence");
    const technical = parseSubScore(feedback, "Technical");

    setQuestions(prev => prev.map((q, i) => i === currentIdx
      ? { ...q, answer: userAnswer, feedback, score, communication, grammar, confidence, technical }
      : q
    ));

    // Track with sub-scores
    track("Interview Ace", `${label} — Q${currentIdx + 1}`, score * 10, undefined, {
      interviewType: type,
      experienceLevel: experience,
      communicationScore: communication !== undefined ? communication * 10 : undefined,
      grammarScore: grammar !== undefined ? grammar * 10 : undefined,
      confidenceScore: confidence !== undefined ? confidence * 10 : undefined,
      technicalScore: technical !== undefined ? technical * 10 : undefined,
    });

    const opening = feedback.split("\n")[0]?.replace(/^Reaction:\s*/i, "") ?? feedback.slice(0, 140);
    void synth.speak(opening, "English");
  }, [currentQ, currentIdx, type, experience, coach, stream, resetStream, synth, track, typeMeta, clearAutoSubmitTimer, speech]);

  const submitAnswer = useCallback(() => {
    if (!answer.trim()) return;
    void submitCurrentAnswer(answer.trim());
  }, [answer, submitCurrentAnswer]);

  const nextQuestion = useCallback(() => {
    const nextIdx = currentIdx + 1;
    setAutoAdvanceCount(null);
    if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    if (nextIdx >= questions.length) { setPhase("report"); return; }
    setCurrentIdx(nextIdx);
    setAnswer("");
    setIsRecording(false);
    clearAutoSubmitTimer();
    resetStream();
    setTimeout(() => synth.speak(questions[nextIdx]!.question, "English"), 300);
  }, [currentIdx, questions, resetStream, synth, clearAutoSubmitTimer]);

  const endEarly = useCallback(() => {
    if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
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

  const downloadReport = useCallback(() => {
    const label = typeMeta.label;
    const answered = questions.filter(q => q.feedback);
    const duration = Math.round((Date.now() - sessionStart) / 60000);
    const subAvg = (key: keyof SubScores) => avgOf(answered.map(q => q[key]));
    const lines = [
      `EDUBHARAT — INTERVIEW ACE REPORT`,
      `Coach: ${coach.name} (${coach.role})`,
      `Role: ${label} | Experience: ${experience}`,
      `Date: ${new Date().toLocaleDateString("en-IN")} | Duration: ~${duration} min`,
      `Overall Score: ${avgScore.toFixed(1)}/10 — ${grade(avgScore).label}`,
      ``,
      `SKILL BREAKDOWN`,
      `Communication: ${subAvg("communication") || "N/A"}/10`,
      `Grammar:       ${subAvg("grammar") || "N/A"}/10`,
      `Confidence:    ${subAvg("confidence") || "N/A"}/10`,
      `Technical:     ${subAvg("technical") || "N/A"}/10`,
      ``,
      `QUESTION-BY-QUESTION`,
      ...answered.map((q, i) => [
        `Q${i + 1}: ${q.question}`,
        `Your Answer: ${q.answer ?? ""}`,
        `Score: ${q.score ?? "N/A"}/10`,
        ...(q.communication !== undefined ? [`  Communication: ${q.communication}/10 | Grammar: ${q.grammar}/10 | Confidence: ${q.confidence}/10 | Technical: ${q.technical}/10`] : []),
        `Feedback:\n${q.feedback ?? ""}`,
        ``,
      ].join("\n")),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-${label.toLowerCase().replace(/ /g, "-")}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [questions, type, experience, avgScore, typeMeta, coach, sessionStart]);

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
                  {coach.id === c.id && (
                    <CheckCircle2 className="w-4 h-4 text-primary ml-auto shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">{c.icon}</span>
                  <span className="text-xs font-semibold text-secondary">{c.specialty}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{c.style}</p>
              </button>
            ))}
          </div>

          {/* Selected coach intro */}
          <div className="mt-4 p-4 rounded-2xl bg-muted/40 border text-sm text-secondary italic">
            "{coach.intro}"
          </div>
        </div>

        <Card className="max-w-lg mx-auto shadow-xl border-none">
          <CardHeader>
            <CardTitle>Configure Your Session</CardTitle>
            <CardDescription>8 questions · Voice-powered · Instant AI feedback</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Interview Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERVIEW_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Experience Level</label>
              <Select value={experience} onValueChange={setExperience}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_LEVELS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full h-12 font-bold text-base shadow-md shadow-primary/20"
              onClick={startSession} disabled={isStreaming}>
              {isStreaming
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Preparing questions...</>
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
    const g = grade(avgScore);
    const hasSubScores = answered.some(q => q.communication !== undefined);
    const avgComm = avgOf(answered.map(q => q.communication));
    const avgGram = avgOf(answered.map(q => q.grammar));
    const avgConf = avgOf(answered.map(q => q.confidence));
    const avgTech = avgOf(answered.map(q => q.technical));

    return (
      <div className="min-h-full overflow-y-auto container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Hero */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <AnimatedAvatar name={coach.name} role={coach.role} isSpeaking={false} gender={coach.gender} size="lg" imageSrc={coach.imageSrc} />
          </div>
          <h1 className="text-3xl font-display font-bold text-secondary mt-2 mb-3">Interview Complete!</h1>
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl border-2 ${g.bg}`}>
            <span className={`text-5xl font-extrabold ${g.color}`}>{avgScore.toFixed(1)}</span>
            <div className="text-left">
              <div className={`text-xs font-bold uppercase tracking-wider ${g.color}`}>Overall Score</div>
              <div className={`text-lg font-bold ${g.color}`}>{g.label}</div>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            {typeMeta.icon} {typeMeta.label} · {experience} · {answered.length} questions answered · with {coach.name}
          </p>
        </div>

        {/* Skill breakdown */}
        {hasSubScores && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                Skill Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 grid sm:grid-cols-2 gap-4">
              <SkillBar icon={MessageCircle} label="Communication" value={avgComm} color="text-blue-600" />
              <SkillBar icon={Pencil} label="Grammar & Language" value={avgGram} color="text-green-600" />
              <SkillBar icon={Flame} label="Confidence & Tone" value={avgConf} color="text-orange-600" />
              <SkillBar icon={Brain} label="Technical Accuracy" value={avgTech} color="text-purple-600" />
            </CardContent>
          </Card>
        )}

        {/* Per-question review */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Question-by-Question</h2>
          {answered.map((q, i) => (
            <QuestionReview key={i} q={q} idx={i} coachName={coach.name} hasSubScores={hasSubScores} />
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center flex-wrap pb-6">
          <Button variant="outline" onClick={downloadReport}>
            <Download className="w-4 h-4 mr-2" />Download Report
          </Button>
          <Button onClick={() => { setPhase("setup"); setQuestions([]); }}>
            <PlayCircle className="w-4 h-4 mr-2" />New Session
          </Button>
          <Button variant="secondary"
            onClick={() => save({
              tool: "Interview Ace",
              title: `${typeMeta.label} with ${coach.name} — ${avgScore.toFixed(1)}/10`,
              content: answered.map((q, i) => [
                `Q${i + 1}: ${q.question}`,
                `Answer: ${q.answer}`,
                `Score: ${q.score}/10`,
                ...(q.communication !== undefined ? [`Communication: ${q.communication}/10 | Grammar: ${q.grammar}/10 | Confidence: ${q.confidence}/10 | Technical: ${q.technical}/10`] : []),
                `Feedback: ${q.feedback}`,
              ].join("\n")).join("\n\n"),
            })}>
            <Star className="w-4 h-4 mr-2" />Save to History
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
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span className="font-bold text-secondary">{currentIdx + 1}/{questions.length}</span>
            </div>
            <Progress value={((currentIdx + 1) / questions.length) * 100} className="h-2" />
            <div className="space-y-1 mt-2 overflow-y-auto pr-1">
              {questions.map((q, i) => (
                <div key={i} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg ${i === currentIdx ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"}`}>
                  <span>Q{i + 1}</span>
                  {q.score !== undefined && <ScoreBadge score={q.score} />}
                  {i === currentIdx && !q.feedback && <span className="text-primary text-[10px] animate-pulse">●</span>}
                </div>
              ))}
            </div>
          </div>
          {currentIdx >= 3 && !currentQ?.feedback && (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground w-full" onClick={endEarly}>
              <LogOut className="w-3 h-3 mr-1" />End Interview
            </Button>
          )}
        </aside>

        {/* Main interview area */}
        <main className="min-w-0 min-h-0 flex flex-col">
          <AvatarBar coach={coach} isSpeaking={synth.isSpeaking} isThinking={isStreaming} className="lg:hidden mb-4" />

          <div className="flex items-center gap-3 mb-4 lg:hidden">
            <Progress value={((currentIdx + 1) / questions.length) * 100} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground shrink-0">Q{currentIdx + 1}/{questions.length}</span>
            {currentIdx >= 3 && !currentQ?.feedback && (
              <Button variant="ghost" size="sm" className="text-xs shrink-0 h-7 px-2" onClick={endEarly}>
                <LogOut className="w-3 h-3 mr-1" />End
              </Button>
            )}
          </div>

          <Card className="shadow-lg border-none min-h-[72vh] overflow-hidden">
            <CardContent className="p-5 md:p-7 h-full min-h-0 flex flex-col">
              <div className="flex items-start gap-3 mb-6">
                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 mt-0.5 text-muted-foreground hover:text-primary"
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
                      {speech.isSupported ? (isRecording ? "Mic on — speak freely" : "Mic paused") : "Microphone not supported in this browser"}
                    </div>
                    {speech.interimTranscript && (
                      <span className="text-xs text-muted-foreground italic flex-1 min-w-[220px] truncate">
                        {speech.interimTranscript}
                      </span>
                    )}
                    <Button variant="outline" size="sm" onClick={toggleRecording} disabled={!speech.isSupported}>
                      {autoListenEnabled ? "Pause mic" : "Resume mic"}
                    </Button>
                    <Button className="font-bold" disabled={!answer.trim() || isStreaming} onClick={submitAnswer}>
                      {isStreaming ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analysing...</> : "Submit Written Answer"}
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
                      {currentQ.score !== undefined && <ScoreBadge score={currentQ.score} />}
                      {/* Mini sub-scores */}
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
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-sm text-muted-foreground">
                      {autoAdvanceCount !== null && autoAdvanceCount > 0 && (
                        <span>Next question in <span className="font-bold text-primary">{autoAdvanceCount}s</span>…</span>
                      )}
                    </div>
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

function QuestionReview({ q, idx, coachName, hasSubScores }: {
  q: QA; idx: number; coachName: string; hasSubScores: boolean;
}) {
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
          {q.score !== undefined && <ScoreBadge score={q.score} />}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-muted/20 animate-in slide-in-from-top-1">
          {/* Sub-scores */}
          {hasSubScores && q.communication !== undefined && (
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
