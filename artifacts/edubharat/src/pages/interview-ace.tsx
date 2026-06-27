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
import { AnimatedAvatar } from "@/components/avatar";
import { INTERVIEW_COACHES } from "@/lib/tutors";
import { Loader2, Mic, MicOff, PlayCircle, ChevronRight, Download, Volume2, StopCircle, LogOut } from "lucide-react";

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

const RAJ = INTERVIEW_COACHES[0]!;

type QA = {
  question: string;
  answer?: string;
  feedback?: string;
  score?: number;
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? "bg-green-100 text-green-700" : score >= 6 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold ${color}`}>{score}/10</span>;
}

function AvatarBar({ isSpeaking, isThinking, className = "" }: {
  isSpeaking: boolean; isThinking: boolean; className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 bg-card rounded-xl border shadow-sm ${className}`}>
      <AnimatedAvatar
        name={RAJ.name}
        role={RAJ.role}
        isSpeaking={isSpeaking}
        isThinking={isThinking}
        gender="male"
        size="md"
        imageSrc={RAJ.imageSrc}
      />
      <div className="min-w-0">
        <p className="font-bold text-sm text-secondary">{RAJ.name}</p>
        <p className="text-xs text-muted-foreground">{RAJ.role}</p>
        {isThinking && <span className="text-xs text-primary animate-pulse">Thinking...</span>}
        {isSpeaking && !isThinking && <span className="text-xs text-primary animate-pulse">Speaking...</span>}
      </div>
    </div>
  );
}

export default function InterviewAce() {
  const { save } = useHistory();
  const { track } = useProgress();
  const { text: streamText, isStreaming, stream, reset: resetStream } = useGeminiStream();
  const synth = useSpeechSynthesis();
  const speech = useSpeechRecognition("English");

  const [type, setType] = useState(INTERVIEW_TYPES[0]!.value);
  const [experience, setExperience] = useState(EXPERIENCE_LEVELS[0]!);
  const [phase, setPhase] = useState<"setup" | "interview" | "report">("setup");
  const [questions, setQuestions] = useState<QA[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [autoListenEnabled, setAutoListenEnabled] = useState(true);
  const [autoAdvanceCount, setAutoAdvanceCount] = useState<number | null>(null);
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
      - sound like a real HR interviewer, not a robot
      - ask one question per line
      - mix opening, competency, scenario, and behavioral prompts
      - vary the tone slightly across the list
      - no numbering, no intro, no closing text
      - keep them conversational and specific
      - if appropriate, include a light follow-up cue inside the question itself
      `,
      `You are a warm, sharp, realistic ${label} interviewer in India. Keep the flow natural, polite, and human.`
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
    setPhase("interview");
    setTimeout(() => synth.speak(parsed[0]!.question, "English"), 300);
  }, [type, experience, stream, resetStream, synth, typeMeta, clearAutoSubmitTimer]);

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
Role: ${label}, ${experience}.

Return exactly these sections:
Reaction: a brief natural interviewer reaction in one sentence.
Score: X/10
Strengths: 2 short bullets
Improvements: 2 short bullets
Ideal Answer: 2-3 line model answer
Follow-up: one realistic next question

Keep it warm, human, and realistic for an Indian hiring interview. Avoid robotic phrasing and generic praise.`,
      `You are a seasoned ${label} interviewer giving natural, practical feedback to an Indian candidate. Sound like a real human interviewer.`
    );
    const scoreMatch = feedback.match(/score[:\s]+(\d+)/i) ?? feedback.match(/(\d+)\s*\/\s*10/i);
    const score = scoreMatch ? Math.min(10, Math.max(1, parseInt(scoreMatch[1]!))) : 6;
    setQuestions(prev => prev.map((q, i) => i === currentIdx ? { ...q, answer: userAnswer, feedback, score } : q));
    track("Interview Ace", `${label} — Q${currentIdx + 1}`, score * 10);
    const opening = feedback.split("\n")[0]?.replace(/^Reaction:\s*/i, "") ?? feedback.slice(0, 140);
    void synth.speak(opening, "English");
  }, [currentQ, currentIdx, type, experience, stream, resetStream, synth, track, typeMeta, clearAutoSubmitTimer, speech]);

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
    const lines = [
      `EDUBHARAT — INTERVIEW ACE REPORT`,
      `Role: ${label} | Experience: ${experience}`,
      `Date: ${new Date().toLocaleDateString("en-IN")}`,
      `Overall Score: ${avgScore.toFixed(1)}/10`,
      ``,
      ...questions.filter(q => q.feedback).map((q, i) => [
        `Q${i + 1}: ${q.question}`,
        `Your Answer: ${q.answer ?? ""}`,
        `Score: ${q.score ?? "N/A"}/10`,
        `Feedback: ${q.feedback ?? ""}`,
        ``,
      ].join("\n")),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `interview-${label.toLowerCase().replace(/ /g, "-")}.txt`; a.click();
    URL.revokeObjectURL(url);
  }, [questions, type, experience, avgScore, typeMeta]);

  if (phase === "setup") {
    return (
      <div className="min-h-full overflow-y-auto container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-5">
            <AnimatedAvatar
              name={RAJ.name}
              role={RAJ.role}
              isSpeaking={false}
              gender="male"
              size="xl"
              imageSrc={RAJ.imageSrc}
            />
          </div>
          <h1 className="text-4xl font-display font-bold text-secondary mb-2">Interview Ace</h1>
          <p className="text-muted-foreground max-w-md mx-auto">{RAJ.intro}</p>
        </div>

        <Card className="max-w-lg mx-auto shadow-xl border-none">
          <CardHeader>
            <CardTitle>Start Your Mock Interview</CardTitle>
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
              {isStreaming ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Preparing questions...</> : <><PlayCircle className="w-5 h-5 mr-2" />Begin Mock Interview</>}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (phase === "report") {
    const answered = questions.filter(q => q.feedback);
    return (
      <div className="min-h-full overflow-y-auto container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <AnimatedAvatar
              name={RAJ.name}
              role={RAJ.role}
              isSpeaking={false}
              gender="male"
              size="lg"
              imageSrc={RAJ.imageSrc}
            />
          </div>
          <h1 className="text-3xl font-display font-bold text-secondary mt-2 mb-2">Interview Complete!</h1>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-5xl font-extrabold text-primary">{avgScore.toFixed(1)}</span>
            <span className="text-2xl text-muted-foreground">/10</span>
          </div>
          <p className="text-muted-foreground mt-2">{typeMeta.icon} {typeMeta.label} · {experience} · {answered.length} questions answered</p>
        </div>
        <div className="space-y-4 mb-8">
          {answered.map((q, i) => (
            <Card key={i} className="border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-secondary mb-1">Q{i + 1}: {q.question}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{q.answer}</p>
                  </div>
                  {q.score !== undefined && <ScoreBadge score={q.score} />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button variant="outline" onClick={downloadReport}><Download className="w-4 h-4 mr-2" />Download Report</Button>
          <Button onClick={() => { setPhase("setup"); setQuestions([]); }}><PlayCircle className="w-4 h-4 mr-2" />New Session</Button>
          <Button variant="secondary"
            onClick={() => save({ tool: "Interview Ace", title: `${typeMeta.label} — Score: ${avgScore.toFixed(1)}/10`, content: answered.map((q, i) => `Q${i + 1}: ${q.question}\nAnswer: ${q.answer}\nScore: ${q.score}/10\nFeedback: ${q.feedback}`).join("\n\n") })}>
            <Download className="w-4 h-4 mr-2" />Save to History
          </Button>
        </div>
      </div>
    );
  }

  // Interview phase
  return (
    <div className="min-h-full overflow-y-auto container mx-auto px-4 py-4 max-w-[1400px]">
      <div className="grid min-h-full lg:grid-cols-[260px_1fr] gap-5">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col items-center gap-4 min-h-0 overflow-hidden">
          <AnimatedAvatar
            name={RAJ.name}
            role={`${typeMeta.label} Interviewer`}
            isSpeaking={synth.isSpeaking}
            isThinking={isStreaming}
            gender="male"
            size="xl"
            imageSrc={RAJ.imageSrc}
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
          <AvatarBar isSpeaking={synth.isSpeaking} isThinking={isStreaming} className="lg:hidden mb-4" />

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
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Raj Sir's Feedback</span>
                      {currentQ.score !== undefined && <ScoreBadge score={currentQ.score} />}
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
