import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INDIAN_LANGUAGES } from "@/lib/constants";
import { useHistory } from "@/lib/use-history";
import { useProgress } from "@/lib/use-progress";
import { useGeminiStream } from "@/lib/use-gemini-stream";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { useSpeechSynthesis } from "@/lib/use-speech-synthesis";
import { AnimatedAvatar } from "@/components/avatar";
import {
  Mic, MicOff, Volume2, VolumeX, BookOpen, PenLine, Languages,
  SpellCheck, MessageCircle, Bookmark, BookmarkCheck, GraduationCap,
  Briefcase, Loader2,
} from "lucide-react";

const MODES = [
  { value: "grammar", label: "Grammar Fix", icon: SpellCheck, desc: "Correct grammar mistakes with explanations" },
  { value: "write", label: "Write Better", icon: PenLine, desc: "Improve your writing quality" },
  { value: "vocab", label: "Vocabulary", icon: BookOpen, desc: "Learn new words in your language" },
  { value: "pronounce", label: "Pronunciation", icon: Volume2, desc: "Practice pronouncing English words" },
  { value: "conversation", label: "Conversation", icon: MessageCircle, desc: "Practice speaking English with AI" },
  { value: "lesson", label: "Daily Lesson", icon: GraduationCap, desc: "Structured lesson for your level" },
  { value: "interview_english", label: "Interview English", icon: Briefcase, desc: "Professional phrases for interviews" },
] as const;
type Mode = typeof MODES[number]["value"];

function MicButton({ isListening, isSupported, onStart, onStop, language }: {
  isListening: boolean; isSupported: boolean;
  onStart: () => void; onStop: () => void; language?: string;
}) {
  return (
    <Button
      type="button"
      variant={isListening ? "destructive" : "outline"}
      size="icon"
      onClick={isListening ? onStop : onStart}
      disabled={!isSupported}
      title={!isSupported ? "Voice not supported in this browser" : isListening ? "Stop listening" : "Speak your text"}
      className="shrink-0"
      data-testid="button-mic"
    >
      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </Button>
  );
}

function SpeakButton({ text, isSpeaking, onSpeak, onStop, language }: {
  text: string; isSpeaking: boolean;
  onSpeak: () => void; onStop: () => void; language?: string;
}) {
  return (
    <Button variant="ghost" size="sm" onClick={isSpeaking ? onStop : onSpeak}
      className="text-xs font-semibold shrink-0" data-testid="button-speak">
      {isSpeaking ? <><VolumeX className="w-3.5 h-3.5 mr-1" />Stop</> : <><Volume2 className="w-3.5 h-3.5 mr-1" />Speak</>}
    </Button>
  );
}

function ResultPanel({ title, content, isSpeaking, onSpeak, onStop, onSave, saved, language }: {
  title: string; content: string; isSpeaking: boolean;
  onSpeak: () => void; onStop: () => void;
  onSave: () => void; saved: boolean; language?: string;
}) {
  return (
    <div className="mt-6 p-5 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-bold text-primary text-sm">{title}</h3>
        <div className="flex items-center gap-2">
          <SpeakButton text={content} isSpeaking={isSpeaking} onSpeak={onSpeak} onStop={onStop} language={language} />
          <Button variant="outline" size="sm" onClick={onSave} disabled={saved} className="text-xs font-semibold">
            {saved ? <><BookmarkCheck className="w-3.5 h-3.5 mr-1 text-primary" />Saved</> : <><Bookmark className="w-3.5 h-3.5 mr-1" />Save</>}
          </Button>
        </div>
      </div>
      <div className="text-sm text-secondary whitespace-pre-wrap leading-relaxed">{content}</div>
    </div>
  );
}

export default function EnglishGuru() {
  const { save } = useHistory();
  const { track } = useProgress();
  const { text: aiText, isStreaming, stream, reset: resetAI } = useGeminiStream();
  const synth = useSpeechSynthesis();

  const [mode, setMode] = useState<Mode>("grammar");
  const [uiLang, setUiLang] = useState("Hindi");
  const [level, setLevel] = useState("Beginner");

  const [grammarInput, setGrammarInput] = useState("");
  const [writeInput, setWriteInput] = useState("");
  const [vocabTopic, setVocabTopic] = useState("");
  const [pronounceWord, setPronounceWord] = useState("");
  const [convHistory, setConvHistory] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [convInput, setConvInput] = useState("");

  const [result, setResult] = useState("");
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});

  const speech = useSpeechRecognition(uiLang === "Hindi" ? "Hindi" : "English");

  const speak = useCallback((text: string) => {
    synth.speak(text, "English");
  }, [synth]);

  const handleStream = useCallback(async (prompt: string, system: string, saveTitle: string) => {
    resetAI();
    setResult("");
    synth.stop();
    const full = await stream(prompt, system);
    setResult(full);
    if (full) {
      track("English Guru", saveTitle);
      void speak(full);
    }
    return full;
  }, [stream, resetAI, synth, speak, track]);

  const saveResult = useCallback((key: string, title: string, content: string) => {
    save({ tool: "English Guru", title, content });
    setSavedMap(m => ({ ...m, [key]: true }));
  }, [save]);

  const currentMode = MODES.find(m => m.value === mode)!;
  const Icon = currentMode.icon;

  const displayed = isStreaming ? aiText : result;

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="grid lg:grid-cols-[280px_1fr] gap-8">
        {/* Sidebar */}
        <aside className="space-y-5">
          <div className="flex flex-col items-center py-6 px-4 bg-card rounded-2xl border shadow-sm">
            <AnimatedAvatar
              name="Priya Ma'am"
              role="English Teacher"
              isSpeaking={synth.isSpeaking}
              isThinking={isStreaming}
              gender="female"
              size="lg"
            />
            <Badge variant="secondary" className="mt-3 text-xs">{level} Level</Badge>
          </div>

          <Card className="border shadow-sm">
            <CardContent className="pt-4 pb-3 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mode</label>
                <Select value={mode} onValueChange={(v) => { setMode(v as Mode); setResult(""); resetAI(); }}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        <span className="flex items-center gap-2">
                          <m.icon className="w-3.5 h-3.5" />{m.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Language</label>
                <Select value={uiLang} onValueChange={setUiLang}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INDIAN_LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Level</label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Beginner", "Intermediate", "Advanced"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Main content */}
        <main>
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-secondary">{currentMode.label}</h1>
                <p className="text-sm text-muted-foreground">{currentMode.desc}</p>
              </div>
            </div>
          </div>

          {/* Grammar Fix */}
          {mode === "grammar" && (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="flex gap-2">
                  <Textarea placeholder="Type or speak your text..." className="min-h-[130px] flex-1 text-sm"
                    value={grammarInput} onChange={e => setGrammarInput(e.target.value)} data-testid="input-grammar" />
                </div>
                <div className="flex items-center gap-2">
                  <MicButton isListening={speech.isListening} isSupported={speech.isSupported}
                    onStart={() => speech.start(t => setGrammarInput(p => p + t))} onStop={speech.stop} />
                  {speech.interimTranscript && <span className="text-xs text-muted-foreground italic">{speech.interimTranscript}</span>}
                  <Button className="ml-auto font-bold" disabled={isStreaming || !grammarInput.trim()}
                    onClick={() => handleStream(
                      `Fix grammar in: "${grammarInput}". Explain each correction clearly.`,
                      `You are an encouraging English teacher for Indian ${level} learners. Explain corrections in ${uiLang} where helpful.`,
                      `Grammar Fix`
                    )} data-testid="button-grammar">
                    {isStreaming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <SpellCheck className="w-4 h-4 mr-2" />}
                    Fix Grammar
                  </Button>
                </div>
                {displayed && <ResultPanel title="Corrections:" content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(displayed)} onStop={synth.stop}
                  onSave={() => saveResult("grammar", `Grammar: "${grammarInput.slice(0, 50)}"`, displayed)}
                  saved={!!savedMap["grammar"]} />}
              </CardContent>
            </Card>
          )}

          {/* Write Better */}
          {mode === "write" && (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="flex gap-2">
                  <Textarea placeholder="Type your draft..." className="min-h-[130px] flex-1 text-sm"
                    value={writeInput} onChange={e => setWriteInput(e.target.value)} data-testid="input-write" />
                </div>
                <div className="flex items-center gap-2">
                  <MicButton isListening={speech.isListening} isSupported={speech.isSupported}
                    onStart={() => speech.start(t => setWriteInput(p => p + t))} onStop={speech.stop} />
                  <Button className="ml-auto font-bold" disabled={isStreaming || !writeInput.trim()}
                    onClick={() => handleStream(
                      `Improve this text to sound more professional and natural: "${writeInput}". Show improved version and explain why it's better.`,
                      `You are a writing coach. Help ${level} English learners improve their writing.`,
                      `Write Better`
                    )} data-testid="button-write">
                    {isStreaming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PenLine className="w-4 h-4 mr-2" />}
                    Improve Writing
                  </Button>
                </div>
                {displayed && <ResultPanel title="Improved Version:" content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(displayed)} onStop={synth.stop}
                  onSave={() => saveResult("write", `Write Better: "${writeInput.slice(0, 50)}"`, displayed)}
                  saved={!!savedMap["write"]} />}
              </CardContent>
            </Card>
          )}

          {/* Vocabulary */}
          {mode === "vocab" && (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <Input placeholder="Enter a topic (e.g., Job Interview, Weather, Office)" className="h-11 text-sm"
                  value={vocabTopic} onChange={e => setVocabTopic(e.target.value)} data-testid="input-vocab" />
                <Button className="font-bold w-full" disabled={isStreaming || !vocabTopic.trim()}
                  onClick={() => handleStream(
                    `Give 8 English words related to "${vocabTopic}" for a ${level} learner. For each: English word, ${uiLang} meaning, example sentence in English.`,
                    `You are an English teacher. Format each word clearly. Be practical and relevant for Indian job seekers.`,
                    `Vocabulary: ${vocabTopic}`
                  )} data-testid="button-vocab">
                  {isStreaming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}
                  Generate Vocabulary
                </Button>
                {displayed && <ResultPanel title={`Vocabulary (with ${uiLang} meanings):`} content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(displayed)} onStop={synth.stop}
                  onSave={() => saveResult("vocab", `Vocabulary: ${vocabTopic}`, displayed)}
                  saved={!!savedMap["vocab"]} />}
              </CardContent>
            </Card>
          )}

          {/* Pronunciation */}
          {mode === "pronounce" && (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <CardDescription>AI will say the word aloud. You practice repeating it.</CardDescription>
                <div className="flex gap-2">
                  <Input placeholder="Enter an English word or phrase to practice"
                    value={pronounceWord} onChange={e => setPronounceWord(e.target.value)}
                    className="h-11 flex-1 text-sm" data-testid="input-pronounce" />
                  <Button variant="outline" size="icon" className="h-11 w-11 shrink-0"
                    onClick={() => synth.speak(pronounceWord, "English")}
                    disabled={!pronounceWord.trim() || synth.isSpeaking} title="Hear pronunciation">
                    <Volume2 className="w-4 h-4" />
                  </Button>
                </div>
                <Button className="font-bold w-full" disabled={isStreaming || !pronounceWord.trim()}
                  onClick={() => handleStream(
                    `Teach pronunciation of "${pronounceWord}": phonetic spelling, syllable breakdown, ${uiLang} pronunciation guide, common mistakes Indians make, and 3 example sentences.`,
                    `You are a pronunciation coach. Use simple phonetics an Indian ${level} learner can understand.`,
                    `Pronunciation: ${pronounceWord}`
                  )} data-testid="button-pronounce">
                  {isStreaming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Volume2 className="w-4 h-4 mr-2" />}
                  Get Pronunciation Guide
                </Button>
                {displayed && <ResultPanel title="Pronunciation Guide:" content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(displayed)} onStop={synth.stop}
                  onSave={() => saveResult("pronounce", `Pronunciation: ${pronounceWord}`, displayed)}
                  saved={!!savedMap["pronounce"]} />}
              </CardContent>
            </Card>
          )}

          {/* Conversation Practice */}
          {mode === "conversation" && (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <CardDescription>Have a spoken English conversation with AI. Speak or type your message.</CardDescription>
                {convHistory.length > 0 && (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto p-1">
                    {convHistory.map((msg, i) => (
                      <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                          msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-secondary"
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isStreaming && aiText && (
                      <div className="flex gap-2 justify-start">
                        <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-muted text-secondary">{aiText}</div>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input placeholder="Type or speak in English..." value={convInput}
                    onChange={e => setConvInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (convInput.trim()) handleConvSend(); } }}
                    className="flex-1 h-11 text-sm" data-testid="input-conversation" />
                  <MicButton isListening={speech.isListening} isSupported={speech.isSupported}
                    onStart={() => speech.start(t => setConvInput(p => p + t))} onStop={speech.stop} />
                  <Button className="font-bold" disabled={isStreaming || !convInput.trim()} onClick={handleConvSend} data-testid="button-send-conv">
                    {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                  </Button>
                </div>
                {convHistory.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setConvHistory([])}>Clear conversation</Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Daily Lesson */}
          {mode === "lesson" && (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <CardDescription>Get a structured lesson based on your level and preferred language.</CardDescription>
                <Button className="font-bold w-full h-12" disabled={isStreaming}
                  onClick={() => handleStream(
                    `Create a complete ${level} English lesson. Include: 1) Today's topic 2) Grammar rule with examples 3) 5 new vocabulary words (with ${uiLang} meaning) 4) Practice exercises 5) Homework task.`,
                    `You are a structured English teacher for Indian students at ${level} level. Make it engaging and practical for job seekers.`,
                    `Daily Lesson: ${level}`
                  )} data-testid="button-lesson">
                  {isStreaming ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <GraduationCap className="w-5 h-5 mr-2" />}
                  Generate Today's Lesson
                </Button>
                {displayed && <ResultPanel title={`${level} English Lesson:`} content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(displayed)} onStop={synth.stop}
                  onSave={() => saveResult("lesson", `Daily Lesson: ${level}`, displayed)}
                  saved={!!savedMap["lesson"]} />}
              </CardContent>
            </Card>
          )}

          {/* Interview English */}
          {mode === "interview_english" && (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <CardDescription>Learn professional phrases and expressions used in job interviews.</CardDescription>
                <Button className="font-bold w-full h-12" disabled={isStreaming}
                  onClick={() => handleStream(
                    `Give 10 essential English phrases for a job interview. For each phrase: the phrase in English, when to use it, ${uiLang} meaning, and an example in context.`,
                    `You are a career English coach helping Indian job seekers at ${level} level. Focus on practical, commonly used interview expressions.`,
                    `Interview English`
                  )} data-testid="button-interview-english">
                  {isStreaming ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Briefcase className="w-5 h-5 mr-2" />}
                  Get Interview Phrases
                </Button>
                {displayed && <ResultPanel title="Interview Phrases:" content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(displayed)} onStop={synth.stop}
                  onSave={() => saveResult("interview_eng", `Interview English Phrases`, displayed)}
                  saved={!!savedMap["interview_eng"]} />}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );

  async function handleConvSend() {
    const userMsg = convInput.trim();
    if (!userMsg) return;
    setConvInput("");
    const newHistory = [...convHistory, { role: "user" as const, text: userMsg }];
    setConvHistory(newHistory);

    const historyContext = newHistory.slice(-6).map(m => `${m.role === "user" ? "Student" : "Teacher"}: ${m.text}`).join("\n");
    resetAI();
    const response = await stream(
      `Continue this English conversation practice:\n${historyContext}\nTeacher:`,
      `You are a friendly English conversation teacher for Indian ${level} learners. Keep replies short (2-3 sentences). Gently correct mistakes. Respond naturally to keep the conversation going.`
    );
    if (response) {
      setConvHistory(h => [...h, { role: "ai" as const, text: response }]);
      speak(response);
    }
  }
}
