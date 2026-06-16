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

function AvatarBar({ name, role, isSpeaking, isThinking, className = "" }: {
  name: string; role: string; isSpeaking: boolean; isThinking: boolean; className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 bg-card rounded-xl border shadow-sm ${className}`}>
      <AnimatedAvatar name={name} role={role} isSpeaking={isSpeaking} isThinking={isThinking} gender="male" size="sm" />
      <div className="min-w-0">
        <p className="font-bold text-sm text-secondary">{name}</p>
        <p className="text-xs text-muted-foreground">{role}</p>
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
  const [autoAdvanceCount, setAutoAdvanceCount] = useState<number | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const typeMeta = INTERVIEW_TYPES.find(t => t.value === type)!;
  const currentQ = questions[currentIdx];
  const avgScore = questions.filter(q => q.score !== undefined).reduce((a, b, _, arr) =>
    a + (b.score ?? 0) / arr.length, 0);

  // Stop recording when phase changes or feedback arrives
  useEffect(() => {
    if (currentQ?.feedback || phase !== "interview") {
      if (isRecording) {
        setIsRecording(false);
        speech.stop();
      }
    }
  }, [currentQ?.feedback, phase]);

  // Auto-advance countdown after feedback
  useEffect(() => {
    if (currentQ?.feedback && phase === "interview") {
      setAutoAdvanceCount(5);
      autoAdvanceRef.current = setInterval(() => {
        setAutoAdvanceCount(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(autoAdvanceRef.current!);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setAutoAdvanceCount(null);
      if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    }
    return () => { if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current); };
  }, [currentQ?.feedback]);

  // Trigger next question when countdown hits 0
  useEffect(() => {
    if (autoAdvanceCount === 0) nextQuestion();
  }, [autoAdvanceCount]);

  const startSession = useCallback(async () => {
    resetStream();
    const label = typeMeta.label;
    const full = await stream(
      `8 interview questions for ${label} (${experience}). Q1-2: warm-up (background, motivation). Q3-6: role-specific competency. Q7-8: behavioral (STAR format). Numbered list only, no extra text.`,
      `Expert ${label} interviewer in India. Progressive difficulty, India-relevant context.`
    );
    const lines = full.split("\n").filter(l => /^\d/.test(l.trim()));
    const parsed: QA[] = lines.slice(0, 8).map(l => ({ question: l.replace(/^\d+[.)]\s*/, "").trim() }));
    if (parsed.length === 0) return;
    setQuestions(parsed);
    setCurrentIdx(0);
    setAnswer("");
    setPhase("interview");
    setTimeout(() => synth.speak(parsed[0]!.question, "English"), 400);
  }, [type, experience, stream, resetStream, synth, typeMeta]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop → auto submit if there's an answer
      setIsRecording(false);
      speech.stop();
      if (answer.trim()) {
        void submitCurrentAnswer(answer.trim());
      }
    } else {
      // Start continuous recording
      synth.stop();
      setIsRecording(true);
      setAnswer("");
      speech.startContinuous(text => {
        setAnswer(prev => (prev + " " + text).trim());
      });
    }
  }, [isRecording, answer, speech, synth]);

  const submitCurrentAnswer = useCallback(async (userAnswer: string) => {
    if (!userAnswer || !currentQ) return;
    setAnswer("");
    const label = typeMeta.label;
    resetStream();
    const feedback = await stream(
      `Q: "${currentQ.question}"\nAnswer: "${userAnswer}"\nRole: ${label}, ${experience}.\nGive: Score X/10, 2 strengths, 2 improvements, ideal answer snippet (2-3 lines). Be conversational, not robotic.`,
      `Fair ${label} interviewer. Practical, encouraging feedback for Indian job seekers.`
    );
    const scoreMatch = feedback.match(/score[:\s]+(\d+)/i) ?? feedback.match(/(\d+)\s*\/\s*10/i);
    const score = scoreMatch ? Math.min(10, Math.max(1, parseInt(scoreMatch[1]!))) : 6;
    setQuestions(prev => prev.map((q, i) => i === currentIdx ? { ...q, answer: userAnswer, feedback, score } : q));
    track("Interview Ace", `${label} — Q${currentIdx + 1}`, score * 10);
    void synth.speak(`Score: ${score} out of 10. ${feedback.slice(0, 150)}`, "English");
  }, [currentQ, currentIdx, type, experience, stream, resetStream, synth, track, typeMeta]);

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
    resetStream();
    setTimeout(() => synth.speak(questions[nextIdx]!.question, "English"), 300);
  }, [currentIdx, questions, resetStream, synth]);

  const endEarly = useCallback(() => {
    if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    speech.stop();
    setIsRecording(false);
    setPhase("report");
  }, [speech]);

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
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <AnimatedAvatar name="Raj Sir" role="Interview Coach" isSpeaking={false} gender="male" size="lg" />
          </div>
          <h1 className="text-4xl font-display font-bold text-secondary mb-2">Interview Ace</h1>
          <p className="text-muted-foreground">AI mock interviews with real-time feedback and voice practice</p>
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
                <SelectTrigger className="h-12" data-testid="select-type"><SelectValue /></SelectTrigger>
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
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-8">
          <AnimatedAvatar name="Raj Sir" role="Interview Coach" isSpeaking={false} gender="male" size="md" />
          <h1 className="text-3xl font-display font-bold text-secondary mt-4 mb-2">Interview Complete!</h1>
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
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="grid lg:grid-cols-[200px_1fr] gap-6">
        {/* Desktop sidebar avatar */}
        <aside className="hidden lg:flex flex-col items-center gap-4">
          <AnimatedAvatar name="Raj Sir" role={`${typeMeta.label} Interviewer`} isSpeaking={synth.isSpeaking} isThinking={isStreaming} gender="male" size="lg" />
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span className="font-bold text-secondary">{currentIdx + 1}/{questions.length}</span>
            </div>
            <Progress value={((currentIdx + 1) / questions.length) * 100} className="h-2" />
            <div className="space-y-1 mt-2">
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
        <main className="min-w-0">
          {/* Mobile avatar bar */}
          <AvatarBar name="Raj Sir" role={`${typeMeta.icon} ${typeMeta.label}`} isSpeaking={synth.isSpeaking} isThinking={isStreaming} className="lg:hidden mb-4" />

          {/* Mobile progress */}
          <div className="flex items-center gap-3 mb-4 lg:hidden">
            <Progress value={((currentIdx + 1) / questions.length) * 100} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground shrink-0">Q{currentIdx + 1}/{questions.length}</span>
            {currentIdx >= 3 && !currentQ?.feedback && (
              <Button variant="ghost" size="sm" className="text-xs shrink-0 h-7 px-2" onClick={endEarly}>
                <LogOut className="w-3 h-3 mr-1" />End
              </Button>
            )}
          </div>

          <Card className="shadow-lg border-none">
            <CardContent className="p-5 md:p-7">
              {/* Question */}
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
                <div className="space-y-4">
                  <Textarea
                    placeholder={isRecording ? "Listening... speak your answer" : "Tap the mic button to start speaking, or type your answer here"}
                    className={`min-h-[160px] text-base transition-colors ${isRecording ? "bg-red-50/50 border-red-300 focus-visible:ring-red-300" : "bg-muted/40 border-muted-foreground/20"}`}
                    value={isRecording && speech.interimTranscript ? answer + " " + speech.interimTranscript : answer}
                    onChange={e => !isRecording && setAnswer(e.target.value)}
                    data-testid="input-answer"
                  />

                  {/* Voice recording button — primary action */}
                  <div className="space-y-3">
                    {speech.isSupported && (
                      <Button
                        onClick={toggleRecording}
                        variant={isRecording ? "destructive" : "outline"}
                        className={`w-full h-14 font-bold text-base gap-3 transition-all ${isRecording ? "animate-pulse shadow-lg shadow-red-200" : "border-2 border-dashed hover:border-primary hover:bg-primary/5"}`}
                        disabled={isStreaming}
                      >
                        {isRecording ? (
                          <><StopCircle className="w-5 h-5" />Stop Recording & Submit Answer</>
                        ) : (
                          <><Mic className="w-5 h-5" />Tap to Record Your Answer</>
                        )}
                      </Button>
                    )}

                    {/* Text submit button */}
                    {!isRecording && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground">or</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    {!isRecording && (
                      <Button className="w-full font-bold" disabled={!answer.trim() || isStreaming} onClick={submitAnswer}>
                        {isStreaming ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analysing...</> : "Submit Written Answer"}
                      </Button>
                    )}
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
