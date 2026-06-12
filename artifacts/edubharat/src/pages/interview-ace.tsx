import { useState, useCallback } from "react";
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
import { AnimatedAvatar } from "@/components/avatar";
import { Loader2, Mic, MicOff, PlayCircle, ChevronRight, Download, Volume2 } from "lucide-react";

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
  saved?: boolean;
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? "bg-green-100 text-green-700" : score >= 6 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold ${color}`}>{score}/10</span>;
}

export default function InterviewAce() {
  const { save } = useHistory();
  const { text: streamText, isStreaming, stream, reset: resetStream } = useGeminiStream();
  const synth = useSpeechSynthesis();
  const speech = useSpeechRecognition("English");

  const [type, setType] = useState(INTERVIEW_TYPES[0].value);
  const [experience, setExperience] = useState(EXPERIENCE_LEVELS[0]);
  const [phase, setPhase] = useState<"setup" | "interview" | "report">("setup");
  const [questions, setQuestions] = useState<QA[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");

  const typeMeta = INTERVIEW_TYPES.find(t => t.value === type)!;
  const currentQ = questions[currentIdx];
  const allAnswered = questions.length > 0 && questions.every(q => q.feedback !== undefined);
  const avgScore = questions.filter(q => q.score !== undefined).reduce((a, b) => a + (b.score ?? 0), 0) / Math.max(1, questions.filter(q => q.score !== undefined).length);

  const startSession = useCallback(async () => {
    resetStream();
    const label = INTERVIEW_TYPES.find(t => t.value === type)?.label ?? type;
    const full = await stream(
      `Generate exactly 5 realistic interview questions for a ${label} role with ${experience} experience. Number them 1-5. Return ONLY the numbered list of questions.`,
      `You are an expert ${label} interviewer in India. Make questions specific and challenging.`
    );
    const lines = full.split("\n").filter(l => /^\d/.test(l.trim()));
    const parsed: QA[] = lines.slice(0, 5).map(l => ({ question: l.replace(/^\d+\.\s*/, "").trim() }));
    if (parsed.length === 0) return;
    setQuestions(parsed);
    setCurrentIdx(0);
    setAnswer("");
    setPhase("interview");
    synth.speak(parsed[0].question, "English");
  }, [type, experience, stream, resetStream, synth]);

  const submitAnswer = useCallback(async () => {
    if (!answer.trim() || !currentQ) return;
    const userAnswer = answer.trim();
    setAnswer("");
    const label = INTERVIEW_TYPES.find(t => t.value === type)?.label ?? type;
    resetStream();
    const feedback = await stream(
      `Interview question: "${currentQ.question}"\nCandidate's answer: "${userAnswer}"\n\nAnalyze this answer for a ${label} role (${experience}). Provide:\n1. Score: X/10\n2. Strengths\n3. Improvements\n4. Ideal answer snippet`,
      `You are a strict but fair ${label} interviewer. Be specific and actionable.`
    );

    const scoreMatch = feedback.match(/score[:\s]+(\d+)/i) ?? feedback.match(/(\d+)\s*\/\s*10/i);
    const score = scoreMatch ? Math.min(10, Math.max(0, parseInt(scoreMatch[1]))) : 6;

    setQuestions(prev => prev.map((q, i) =>
      i === currentIdx ? { ...q, answer: userAnswer, feedback, score } : q
    ));
    synth.speak(`Score: ${score} out of 10. ${feedback.slice(0, 200)}`, "English");
  }, [answer, currentQ, currentIdx, type, experience, stream, resetStream, synth]);

  const nextQuestion = useCallback(() => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= questions.length) {
      setPhase("report");
      return;
    }
    setCurrentIdx(nextIdx);
    setAnswer("");
    resetStream();
    synth.speak(questions[nextIdx].question, "English");
  }, [currentIdx, questions, resetStream, synth]);

  const downloadReport = useCallback(() => {
    const label = INTERVIEW_TYPES.find(t => t.value === type)?.label ?? type;
    const lines = [
      `EDUBHARAT — INTERVIEW ACE REPORT`,
      `Role: ${label} | Experience: ${experience}`,
      `Date: ${new Date().toLocaleDateString("en-IN")}`,
      `Overall Score: ${avgScore.toFixed(1)}/10`,
      ``,
      ...questions.map((q, i) => [
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
    a.href = url;
    a.download = `interview-report-${label.toLowerCase().replace(/ /g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [questions, type, experience, avgScore]);

  if (phase === "setup") {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <AnimatedAvatar name="Raj Sir" role="Interview Coach" isSpeaking={false} gender="male" size="lg" />
          </div>
          <h1 className="text-4xl font-display font-bold text-secondary mb-3">Interview Ace</h1>
          <p className="text-muted-foreground text-lg">AI-powered mock interviews with instant feedback and voice practice.</p>
        </div>

        <Card className="max-w-lg mx-auto shadow-xl border-none">
          <CardHeader>
            <CardTitle>Start Interview Session</CardTitle>
            <CardDescription>Choose your interview type and experience level.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Interview Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-12" data-testid="select-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Experience Level</label>
              <Select value={experience} onValueChange={setExperience}>
                <SelectTrigger className="h-12" data-testid="select-experience"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_LEVELS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full h-12 font-bold text-base shadow-md shadow-primary/20"
              onClick={startSession} disabled={isStreaming} data-testid="button-start">
              {isStreaming ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <PlayCircle className="w-5 h-5 mr-2" />}
              Begin Mock Interview
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (phase === "report") {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-secondary mb-2">Interview Complete!</h1>
          <div className="flex items-center justify-center gap-3 mt-4">
            <span className="text-5xl font-extrabold text-primary">{avgScore.toFixed(1)}</span>
            <span className="text-2xl text-muted-foreground">/10</span>
          </div>
          <p className="text-muted-foreground mt-2">{typeMeta.icon} {typeMeta.label} • {experience}</p>
        </div>

        <div className="space-y-4 mb-8">
          {questions.map((q, i) => (
            <Card key={i} className="border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-secondary mb-2">Q{i + 1}: {q.question}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{q.answer}</p>
                  </div>
                  {q.score !== undefined && <ScoreBadge score={q.score} />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={downloadReport} className="font-bold">
            <Download className="w-4 h-4 mr-2" />Download Report
          </Button>
          <Button onClick={() => { setPhase("setup"); setQuestions([]); }} className="font-bold">
            <PlayCircle className="w-4 h-4 mr-2" />New Session
          </Button>
          <Button variant="secondary" className="font-bold"
            onClick={() => save({
              tool: "Interview Ace",
              title: `${typeMeta.label} Interview — Score: ${avgScore.toFixed(1)}/10`,
              content: questions.map((q, i) => `Q${i + 1}: ${q.question}\nAnswer: ${q.answer}\nScore: ${q.score}/10\nFeedback: ${q.feedback}`).join("\n\n"),
            })}>
            <Download className="w-4 h-4 mr-2" />Save to History
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="grid lg:grid-cols-[220px_1fr] gap-8">
        {/* Avatar sidebar */}
        <aside className="flex flex-col items-center gap-4">
          <AnimatedAvatar
            name="Raj Sir"
            role={`${typeMeta.label}\nInterviewer`}
            isSpeaking={synth.isSpeaking}
            isThinking={isStreaming}
            gender="male"
            size="lg"
          />
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-bold">{currentIdx + 1}/{questions.length}</span>
            </div>
            <Progress value={((currentIdx + 1) / questions.length) * 100} className="h-2" />
            <div className="space-y-1">
              {questions.map((q, i) => (
                <div key={i} className={`flex items-center justify-between text-xs p-1.5 rounded ${i === currentIdx ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"}`}>
                  <span>Q{i + 1}</span>
                  {q.score !== undefined && <ScoreBadge score={q.score} />}
                  {i === currentIdx && !q.feedback && <span className="text-primary">●</span>}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Interview area */}
        <main>
          <div className="flex items-center justify-between mb-4">
            <Badge variant="secondary">{typeMeta.icon} {typeMeta.label}</Badge>
            <Badge variant="outline">{experience}</Badge>
          </div>

          <Card className="shadow-lg border-none">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-3 mb-6">
                <Button variant="ghost" size="icon" className="shrink-0 mt-1 h-8 w-8"
                  onClick={() => { if (currentQ) synth.speak(currentQ.question, "English"); }}>
                  <Volume2 className="w-4 h-4" />
                </Button>
                <h2 className="text-xl font-display font-bold text-secondary leading-snug">
                  {currentQ?.question}
                </h2>
              </div>

              {!currentQ?.feedback ? (
                <div className="space-y-4">
                  <Textarea
                    placeholder="Type your answer, or click the mic to speak..."
                    className="min-h-[180px] text-base bg-muted/40 border-muted-foreground/20"
                    value={speech.isListening ? answer + " " + speech.interimTranscript : answer}
                    onChange={e => setAnswer(e.target.value)}
                    data-testid="input-answer"
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      variant={speech.isListening ? "destructive" : "outline"}
                      size="icon"
                      onClick={speech.isListening ? speech.stop : () => speech.start(t => setAnswer(p => p + " " + t))}
                      disabled={!speech.isSupported}
                      className="h-11 w-11"
                      title="Speak your answer"
                    >
                      {speech.isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </Button>
                    {speech.isListening && <span className="text-xs text-muted-foreground animate-pulse">Listening...</span>}
                    <Button className="ml-auto font-bold px-6 h-11" disabled={!answer.trim() || isStreaming} onClick={submitAnswer} data-testid="button-submit">
                      {isStreaming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Submit Answer
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="p-4 bg-muted rounded-xl">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Answer:</span>
                    <p className="text-sm text-secondary mt-1">{currentQ.answer}</p>
                  </div>
                  <div className="p-5 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold text-green-700 uppercase tracking-wider">AI Feedback</span>
                      {currentQ.score !== undefined && <ScoreBadge score={currentQ.score} />}
                    </div>
                    <div className="text-sm text-green-950 whitespace-pre-wrap leading-relaxed">{currentQ.feedback}</div>
                  </div>
                  <div className="flex justify-end pt-2">
                    {currentIdx < questions.length - 1 ? (
                      <Button onClick={nextQuestion} className="font-bold">
                        Next Question <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    ) : (
                      <Button onClick={() => setPhase("report")} className="font-bold bg-green-600 hover:bg-green-700">
                        View Full Report
                      </Button>
                    )}
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
