import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INDIAN_LANGUAGES } from "@/lib/constants";
import { useAuth } from "@/lib/use-auth";
import { useHistory } from "@/lib/use-history";
import { useProgress } from "@/lib/use-progress";
import { useGeminiStream } from "@/lib/use-gemini-stream";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { useSpeechSynthesis } from "@/lib/use-speech-synthesis";
import { useStudentProfile } from "@/lib/use-student-profile";
import { AnimatedAvatar } from "@/components/avatar";
import { TUTORS, getTutorById } from "@/lib/tutors";
import {
  Mic, MicOff, Volume2, VolumeX, BookOpen, PenLine, Languages,
  SpellCheck, MessageCircle, Bookmark, BookmarkCheck, GraduationCap,
  Briefcase, Loader2, Map, StopCircle, ChevronRight, Zap, ChevronDown,
  Users,
} from "lucide-react";

const MODES = [
  { value: "roadmap", label: "My Journey", icon: Map, desc: "Your personalised A1→C2 learning roadmap" },
  { value: "conversation", label: "Live Conversation", icon: MessageCircle, desc: "Real-time voice chat with AI teacher" },
  { value: "grammar", label: "Grammar Fix", icon: SpellCheck, desc: "Correct grammar with clear explanations" },
  { value: "write", label: "Write Better", icon: PenLine, desc: "Polish your writing to sound professional" },
  { value: "vocab", label: "Vocabulary", icon: BookOpen, desc: "Learn new words in your language" },
  { value: "pronounce", label: "Pronunciation", icon: Volume2, desc: "Practice English pronunciation" },
  { value: "lesson", label: "Daily Lesson", icon: GraduationCap, desc: "Structured lesson for your level" },
  { value: "interview_english", label: "Interview English", icon: Briefcase, desc: "Professional phrases for interviews" },
] as const;
type Mode = typeof MODES[number]["value"];

const ROADMAP_STAGES = [
  {
    level: "A1", label: "Foundation", color: "border-slate-300 bg-slate-50 text-slate-700",
    topics: ["Greetings & introductions", "Numbers, days, months", "Simple sentences: I am, You are", "Colors, family members", "Basic questions: What, Who, Where", "Common objects vocabulary"],
  },
  {
    level: "A2", label: "Basics", color: "border-blue-300 bg-blue-50 text-blue-700",
    topics: ["Present & past tense basics", "Shopping & food vocabulary", "Giving directions", "Daily routine descriptions", "Simple workplace phrases", "Writing short messages"],
  },
  {
    level: "B1", label: "Intermediate", color: "border-green-300 bg-green-50 text-green-700",
    topics: ["All English tenses", "Expressing opinions clearly", "Job interview basics", "Email writing", "Telephone conversations", "Narrating events & stories"],
  },
  {
    level: "B2", label: "Upper-Intermediate", color: "border-yellow-300 bg-yellow-50 text-yellow-700",
    topics: ["Complex grammar: conditionals, passive voice", "Professional communication", "Idioms & phrasal verbs", "Formal reports & letters", "Debate & argumentation", "Business meeting language"],
  },
  {
    level: "C1", label: "Advanced", color: "border-orange-300 bg-orange-50 text-orange-700",
    topics: ["Nuanced vocabulary & tone", "Presentations & public speaking", "Negotiation & persuasion", "Academic & technical writing", "Complex comprehension", "Networking & leadership language"],
  },
  {
    level: "C2", label: "Mastery", color: "border-purple-300 bg-purple-50 text-purple-700",
    topics: ["Native-level fluency", "Subtle tone & register shifts", "Creative & persuasive writing", "Cultural references & humour", "Executive communication", "Language for leadership"],
  },
];

const LEVEL_TO_STAGE: Record<string, string> = { Beginner: "A1", Intermediate: "B1", Advanced: "C1" };

function MicButton({ isListening, isSupported, onStart, onStop }: {
  isListening: boolean; isSupported: boolean; onStart: () => void; onStop: () => void;
}) {
  return (
    <Button type="button" variant={isListening ? "destructive" : "outline"} size="icon"
      onClick={isListening ? onStop : onStart} disabled={!isSupported}
      title={!isSupported ? "Voice not supported in this browser" : isListening ? "Stop" : "Speak"} className="shrink-0">
      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </Button>
  );
}

function ResultPanel({ title, content, isSpeaking, onSpeak, onStop, onSave, saved }: {
  title: string; content: string; isSpeaking: boolean;
  onSpeak: () => void; onStop: () => void; onSave: () => void; saved: boolean;
}) {
  return (
    <div className="mt-5 p-5 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-bold text-primary text-sm">{title}</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={isSpeaking ? onStop : onSpeak} className="text-xs font-semibold">
            {isSpeaking ? <><VolumeX className="w-3.5 h-3.5 mr-1" />Stop</> : <><Volume2 className="w-3.5 h-3.5 mr-1" />Speak</>}
          </Button>
          <Button variant="outline" size="sm" onClick={onSave} disabled={saved} className="text-xs font-semibold">
            {saved ? <><BookmarkCheck className="w-3.5 h-3.5 mr-1 text-primary" />Saved</> : <><Bookmark className="w-3.5 h-3.5 mr-1" />Save</>}
          </Button>
        </div>
      </div>
      <div className="text-sm text-secondary whitespace-pre-wrap leading-relaxed">{content}</div>
    </div>
  );
}

function stripMarkdownForSpeech(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function detectSpokenLanguage(text: string, fallback: string) {
  if (/[\u0900-\u097F]/.test(text)) return "Hindi";
  if (/[\u0980-\u09FF]/.test(text)) return "Bengali";
  if (/[\u0B80-\u0BFF]/.test(text)) return "Tamil";
  if (/[\u0C00-\u0C7F]/.test(text)) return "Telugu";
  if (/[\u0A00-\u0A7F]/.test(text)) return "Punjabi";
  if (/[\u0D00-\u0D7F]/.test(text)) return "Malayalam";
  if (/[\u0C80-\u0CFF]/.test(text)) return "Kannada";
  if (/[\u0A80-\u0AFF]/.test(text)) return "Gujarati";
  if (/[\u0600-\u06FF]/.test(text)) return "Urdu";
  return fallback;
}

/** Tutor selector — accessible modal dialog for choosing a teacher */
function TutorSelector({
  currentId,
  onSelect,
  onClose,
}: {
  currentId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Initial focus — move to close button when dialog opens
  useEffect(() => { closeBtnRef.current?.focus(); }, []);

  // Focus trap inside the panel
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    panel.addEventListener("keydown", trapFocus);
    return () => panel.removeEventListener("keydown", trapFocus);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutor-dialog-title"
        className="bg-card rounded-2xl border shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 id="tutor-dialog-title" className="text-xl font-display font-bold text-secondary">Choose Your AI Guru</h2>
            <p className="text-sm text-muted-foreground">Each teacher has a unique specialization and style</p>
          </div>
          <Button ref={closeBtnRef} variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {TUTORS.map(tutor => {
            const isActive = tutor.id === currentId;
            return (
              <button
                key={tutor.id}
                onClick={() => { onSelect(tutor.id); onClose(); }}
                aria-pressed={isActive}
                className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40 bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <img
                  src={tutor.imageSrc}
                  alt=""
                  aria-hidden="true"
                  className="w-16 h-16 rounded-full object-cover object-top border-2 shrink-0"
                  style={{ borderColor: isActive ? tutor.accentColor : "#e2e8f0" }}
                  loading="lazy"
                  decoding="async"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-secondary text-sm">{tutor.name}</p>
                    {isActive && <Badge className="text-[10px] h-4 px-1.5">Active</Badge>}
                  </div>
                  <p className="text-xs font-medium text-primary mt-0.5">{tutor.role}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tutor.specialization}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tutor.languages.slice(0, 2).map(l => (
                      <span key={l} className="text-[10px] rounded-full border bg-background px-2 py-0.5">{l}</span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function EnglishGuru() {
  const { user } = useAuth();
  const { save } = useHistory();
  const { track } = useProgress();
  const { text: aiText, isStreaming, error: aiError, stream, reset: resetAI } = useGeminiStream();
  const synth = useSpeechSynthesis();
  const { profile, updateProfile } = useStudentProfile();

  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "roadmap";
    const requested = new URLSearchParams(window.location.search).get("mode");
    return (MODES.some(m => m.value === requested) ? requested : "roadmap") as Mode;
  });
  const [uiLang, setUiLang] = useState(profile.preferredLanguage);
  const [level, setLevel] = useState("Beginner");
  const [tutorId, setTutorId] = useState(() => {
    // derive from saved voiceStyle
    const vs = profile.voiceStyle;
    const match = TUTORS.find(t => t.voiceStyle === vs);
    return match?.id ?? "priya";
  });
  const [showTutorPicker, setShowTutorPicker] = useState(false);

  const tutor = getTutorById(tutorId) ?? TUTORS[0]!;

  const [grammarInput, setGrammarInput] = useState("");
  const [writeInput, setWriteInput] = useState("");
  const [vocabTopic, setVocabTopic] = useState("");
  const [pronounceWord, setPronounceWord] = useState("");
  const [convHistory, setConvHistory] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [convInput, setConvInput] = useState("");
  const [liveChat, setLiveChat] = useState(false);
  const [convFlowState, setConvFlowState] = useState<"idle" | "user-speaking" | "ai-thinking" | "ai-speaking">("idle");
  const convInputRef = useRef<HTMLTextAreaElement>(null);
  const convScrollRef = useRef<HTMLDivElement>(null);

  const [result, setResult] = useState("");
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const speech = useSpeechRecognition(uiLang);
  const convHistoryRef = useRef(convHistory);

  useEffect(() => {
    if (user?.name && !profile.name) updateProfile({ name: user.name });
  }, [user?.name, profile.name, updateProfile]);

  useEffect(() => { setUiLang(profile.preferredLanguage); }, [profile.preferredLanguage]);

  useEffect(() => {
    const el = convInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [convInput]);

  useEffect(() => { convHistoryRef.current = convHistory; }, [convHistory]);

  useEffect(() => {
    const el = convScrollRef.current;
    if (!el || mode !== "conversation") return;
    el.scrollTop = 0;
  }, [mode, convHistory, aiText, isStreaming]);

  // Sync tutor to profile voice when profile changes externally
  useEffect(() => {
    const match = TUTORS.find(t => t.voiceStyle === profile.voiceStyle);
    if (match && match.id !== tutorId) setTutorId(match.id);
  }, [profile.voiceStyle]);

  const speak = useCallback((text: string, language = uiLang, onEnd?: () => void) => {
    synth.speak(stripMarkdownForSpeech(text), language, onEnd, {
      voiceGender: tutor.voiceGender,
      voiceStyle: tutor.voiceStyle,
    });
  }, [synth, uiLang, tutor.voiceGender, tutor.voiceStyle]);

  const handleSelectTutor = useCallback((id: string) => {
    const t = getTutorById(id);
    if (!t) return;
    synth.stop();
    setTutorId(id);
    updateProfile({ voiceStyle: t.voiceStyle as typeof profile.voiceStyle, voiceGender: t.voiceGender });
  }, [synth, updateProfile]);

  // Live chat: restart mic after AI finishes speaking
  useEffect(() => {
    if (!liveChat) return undefined;
    if (convFlowState === "ai-speaking" && !synth.isSpeaking && !isStreaming) {
      const timer = setTimeout(() => {
        setConvFlowState("user-speaking");
        speech.startContinuous(phrase => { handleConvPhrase(phrase); });
      }, 700);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [liveChat, convFlowState, synth.isSpeaking, isStreaming]);

  // When streaming ends in live chat, switch to speaking state
  useEffect(() => {
    if (!liveChat) return;
    if (convFlowState === "ai-thinking" && !isStreaming) setConvFlowState("ai-speaking");
  }, [liveChat, isStreaming, convFlowState]);

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
  const teacherShort = tutor.name.replace(/\s+(Ma'am|Sir)$/i, "");
  const currentStage = LEVEL_TO_STAGE[level] ?? "A1";

  // Live chat phrase handler
  const handleConvPhrase = useCallback((phrase: string) => {
    if (!phrase.trim() || isStreaming) return;
    speech.stop();
    setConvFlowState("ai-thinking");
    void (async () => {
      const userMsg = phrase.trim();
      setConvHistory(h => [...h, { role: "user", text: userMsg }]);
      const recentHistory = [...convHistoryRef.current.slice(-4), { role: "user" as const, text: userMsg }]
        .map(m => `${m.role === "user" ? "Student" : teacherShort}: ${m.text}`).join("\n");
      resetAI();
      const response = await stream(
        `${recentHistory}\n${teacherShort}:`,
        `You are ${teacherShort}, a warm Indian English tutor for ${profile.name || "the student"}. ${tutor.teachingStyle}. Reply in the same language the student used. If English, respond with gentle corrections. If a regional language is used, answer naturally in that language and explain the English meaning simply. Never use markdown, bullets, numbering, or symbols. Keep replies to 1-2 short lines.`,
        undefined,
        { maxTokens: 120 }
      );
      if (response) {
        const cleanResponse = stripMarkdownForSpeech(response);
        setConvHistory(h => [...h, { role: "ai", text: cleanResponse }]);
        track("English Guru", "Live Conversation");
        const spokenLanguage = detectSpokenLanguage(cleanResponse, uiLang);
        speak(cleanResponse, spokenLanguage, () => {
          if (liveChat) setConvFlowState("ai-speaking");
        });
      }
    })();
  }, [stream, resetAI, speak, track, isStreaming, speech, liveChat, profile.name, tutor.teachingStyle, uiLang, teacherShort]);

  const toggleLiveChat = useCallback(() => {
    if (liveChat) {
      setLiveChat(false);
      setConvFlowState("idle");
      speech.stop();
      synth.stop();
    } else {
      setLiveChat(true);
      setConvFlowState("user-speaking");
      speech.startContinuous(handleConvPhrase);
    }
  }, [liveChat, speech, synth, handleConvPhrase]);

  const handleConvSend = useCallback(async () => {
    const userMsg = convInput.trim();
    if (!userMsg) return;
    setConvInput("");
    await handleConvPhrase(userMsg);
  }, [convInput, handleConvPhrase]);

  return (
    <div className="min-h-full overflow-y-auto container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
      {showTutorPicker && (
        <TutorSelector currentId={tutorId} onSelect={handleSelectTutor} onClose={() => setShowTutorPicker(false)} />
      )}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <aside className="order-2 lg:order-1 space-y-4 lg:sticky lg:top-20 self-start">
          {/* Desktop avatar card */}
          <div className="hidden lg:flex flex-col items-center py-6 px-4 bg-card rounded-2xl border shadow-sm">
            <AnimatedAvatar
              name={tutor.name}
              role={tutor.role}
              isSpeaking={synth.isSpeaking}
              isThinking={isStreaming}
              gender={tutor.gender}
              size="xl"
              imageSrc={tutor.imageSrc}
            />
            <div className="mt-4 text-center px-2">
              <p className="text-xs text-muted-foreground leading-relaxed italic">"{tutor.intro}"</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full font-semibold rounded-full text-xs"
              onClick={() => setShowTutorPicker(true)}
            >
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Change Teacher
            </Button>
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {tutor.languages.map(l => (
                <span key={l} className="text-[10px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">{l}</span>
              ))}
            </div>
            {liveChat && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600 font-semibold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Live Chat ON
              </div>
            )}
          </div>

          {/* Mobile avatar bar */}
          <div className="flex lg:hidden items-center gap-3 p-3 bg-card rounded-xl border shadow-sm">
            <AnimatedAvatar
              name={tutor.name}
              role={tutor.role}
              isSpeaking={synth.isSpeaking}
              isThinking={isStreaming}
              gender={tutor.gender}
              size="md"
              imageSrc={tutor.imageSrc}
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{tutor.name}</p>
              <p className="text-xs text-muted-foreground">{tutor.role}</p>
              <Badge variant="secondary" className="text-xs mt-0.5">{level}</Badge>
              {liveChat && <div className="text-xs text-green-600 font-semibold mt-0.5 animate-pulse">● Live Chat</div>}
            </div>
            <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => setShowTutorPicker(true)}>
              <Users className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Card className="border shadow-sm">
            <CardContent className="pt-4 pb-3 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Student Name</label>
                <Input
                  value={profile.name}
                  onChange={(e) => updateProfile({ name: e.target.value })}
                  placeholder={user?.name ?? "Your name"}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mode</label>
                <Select value={mode} onValueChange={(v) => { setMode(v as Mode); setResult(""); resetAI(); setLiveChat(false); speech.stop(); setConvFlowState("idle"); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODES.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        <span className="flex items-center gap-2"><m.icon className="w-3.5 h-3.5" />{m.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Conversation Language</label>
                <Select value={uiLang} onValueChange={(value) => { setUiLang(value); updateProfile({ preferredLanguage: value }); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    {INDIAN_LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">My Level</label>
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
        <main className="order-1 lg:order-2 min-w-0">
          <div className="mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-secondary">{currentMode.label}</h1>
                <p className="text-sm text-muted-foreground">{currentMode.desc}</p>
              </div>
            </div>
          </div>

          {/* ── MY JOURNEY ROADMAP ── */}
          {mode === "roadmap" && (
            <div className="space-y-5">
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-900">
                <strong>Your current level:</strong> {level} ({currentStage}) — stages below show your full path to English mastery.
              </div>
              <div className="relative space-y-3">
                {ROADMAP_STAGES.map((stage, idx) => {
                  const isCurrent = stage.level === currentStage;
                  const isPast = ROADMAP_STAGES.findIndex(s => s.level === currentStage) > idx;
                  return (
                    <div key={stage.level} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold border-2 shrink-0 ${isCurrent ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30" : isPast ? "bg-primary/20 text-primary border-primary/40" : "bg-muted text-muted-foreground border-border"}`}>
                          {isPast ? "✓" : stage.level}
                        </div>
                        {idx < ROADMAP_STAGES.length - 1 && (
                          <div className={`w-0.5 flex-1 my-1 min-h-[16px] ${isPast ? "bg-primary/40" : "bg-border"}`} />
                        )}
                      </div>
                      <div className={`flex-1 p-4 rounded-xl border-2 mb-1 transition-all ${isCurrent ? "border-primary bg-orange-50/80 shadow-sm" : isPast ? "border-primary/30 bg-muted/40 opacity-75" : `${stage.color}`}`}>
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-secondary text-sm">{stage.label}</span>
                            {isCurrent && <Badge className="text-[10px] px-1.5 py-0 h-5">You are here</Badge>}
                            {isPast && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary">Done</Badge>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {stage.topics.map(t => (
                            <span key={t} className={`text-xs px-2 py-0.5 rounded-full border ${isCurrent ? "bg-primary/10 border-primary/20 text-primary font-medium" : isPast ? "bg-primary/5 border-primary/10 text-primary/60" : "bg-white/70 border-border/60 text-muted-foreground"}`}>{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-5 space-y-3">
                  <p className="text-sm font-semibold text-secondary">Want a personalised 30-day plan for your level?</p>
                  <Button className="w-full font-bold" disabled={isStreaming}
                    onClick={() => handleStream(
                      `Create a 30-day English learning plan for an Indian ${level} learner (${currentStage} level) aiming to improve for job interviews. Week 1: day-by-day tasks. Week 2-4: weekly themes with activities. Include time per day, resources, and milestones. Keep it practical and achievable.`,
                      `Experienced English teacher named ${teacherShort}. Practical, India-specific learning advice. ${tutor.teachingStyle}.`,
                      `30-Day Learning Plan: ${level}`
                    )}>
                    {isStreaming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                    Get My 30-Day Plan
                  </Button>
                  {displayed && <ResultPanel title="Your Personalised Learning Plan:" content={displayed} isSpeaking={synth.isSpeaking}
                    onSpeak={() => speak(displayed)} onStop={synth.stop}
                    onSave={() => saveResult("roadmap", `30-Day Plan: ${level}`, displayed)} saved={!!savedMap["roadmap"]} />}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── LIVE CONVERSATION ── */}
          {mode === "conversation" && (
            <Card className="flex min-h-[72vh] flex-col overflow-hidden">
              <CardContent className="pt-5 space-y-4 flex min-h-0 flex-1 flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-secondary">Live Voice Chat with {tutor.name}</p>
                    <p className="text-xs text-muted-foreground">Press mic once — speak naturally — AI responds, mic restarts automatically</p>
                  </div>
                  <Button
                    onClick={toggleLiveChat}
                    variant={liveChat ? "destructive" : "default"}
                    size="sm"
                    className={`font-bold shrink-0 w-full sm:w-auto ${liveChat ? "" : "bg-green-600 hover:bg-green-700"}`}
                    disabled={!speech.isSupported}>
                    {liveChat ? <><StopCircle className="w-4 h-4 mr-1.5" />End Chat</> : <><Mic className="w-4 h-4 mr-1.5" />Start Live Chat</>}
                  </Button>
                </div>

                {liveChat && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${convFlowState === "user-speaking" ? "bg-green-50 text-green-700 border border-green-200" : convFlowState === "ai-thinking" || convFlowState === "ai-speaking" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-muted text-muted-foreground"}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${convFlowState === "user-speaking" ? "bg-green-500 animate-pulse" : convFlowState === "ai-thinking" ? "bg-yellow-500 animate-pulse" : convFlowState === "ai-speaking" ? "bg-blue-500 animate-pulse" : "bg-muted-foreground"}`} />
                    {convFlowState === "user-speaking" && (speech.interimTranscript ? `"${speech.interimTranscript}"` : "Listening for you...")}
                    {convFlowState === "ai-thinking" && `${tutor.name} is thinking...`}
                    {convFlowState === "ai-speaking" && `${tutor.name} is speaking... (mic restarts when done)`}
                    {convFlowState === "idle" && "Live chat off"}
                  </div>
                )}

                {(convHistory.length > 0 || isStreaming) && (
                  <div ref={convScrollRef} className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto pr-1 pt-1">
                    {isStreaming && !aiText && (
                      <div className="flex gap-2 justify-start">
                        <div className="px-4 py-2.5 bg-muted rounded-2xl">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}
                    {isStreaming && aiText && (
                      <div className="flex gap-2 justify-start">
                        <div className="max-w-[90%] rounded-2xl px-4 py-2.5 text-sm bg-muted text-secondary whitespace-pre-wrap break-words">{stripMarkdownForSpeech(aiText)}</div>
                      </div>
                    )}
                    {[...convHistory].reverse().map((msg, i) => (
                      <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-secondary"}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!liveChat && (
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                    <Textarea
                      ref={convInputRef}
                      placeholder={`Type in ${uiLang}, or press mic to speak...`}
                      value={convInput}
                      onChange={e => setConvInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (convInput.trim()) void handleConvSend(); } }}
                      className="flex-1 min-h-[52px] max-h-[180px] resize-none overflow-hidden text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <MicButton isListening={speech.isListening} isSupported={speech.isSupported}
                        onStart={() => speech.start(t => setConvInput(p => p + t))} onStop={speech.stop} />
                      <Button className="font-bold px-4 w-full sm:w-auto" disabled={isStreaming || !convInput.trim()} onClick={handleConvSend}>
                        {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {convHistory.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs w-full"
                    onClick={() => { setConvHistory([]); setLiveChat(false); speech.stop(); setConvFlowState("idle"); }}>
                    Clear & Start Over
                  </Button>
                )}
                {!speech.isSupported && (
                  <p className="text-xs text-muted-foreground text-center">Voice requires Chrome or Edge browser</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── GRAMMAR FIX ── */}
          {mode === "grammar" && (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <Textarea placeholder="Type or speak your text..." className="min-h-[130px] text-sm"
                  value={grammarInput} onChange={e => setGrammarInput(e.target.value)} />
                <div className="flex items-center gap-2">
                  <MicButton isListening={speech.isListening} isSupported={speech.isSupported}
                    onStart={() => speech.start(t => setGrammarInput(p => p + t))} onStop={speech.stop} />
                  {speech.interimTranscript && <span className="text-xs text-muted-foreground italic flex-1 truncate">{speech.interimTranscript}</span>}
                  <Button className="ml-auto font-bold" disabled={isStreaming || !grammarInput.trim()}
                    onClick={() => handleStream(
                      `Fix grammar: "${grammarInput}". List each correction with brief ${uiLang} explanation.`,
                      `Encouraging English teacher named ${teacherShort} for Indian ${level} learners. ${tutor.teachingStyle}.`,
                      "Grammar Fix"
                    )}>
                    {isStreaming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <SpellCheck className="w-4 h-4 mr-2" />}
                    Fix Grammar
                  </Button>
                </div>
                {aiError && <p className="text-sm text-destructive">{aiError}</p>}
                {displayed && <ResultPanel title="Corrections:" content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(displayed)} onStop={synth.stop}
                  onSave={() => saveResult("grammar", `Grammar: "${grammarInput.slice(0, 50)}"`, displayed)} saved={!!savedMap["grammar"]} />}
              </CardContent>
            </Card>
          )}

          {/* ── WRITE BETTER ── */}
          {mode === "write" && (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <Textarea placeholder="Type your draft..." className="min-h-[130px] text-sm"
                  value={writeInput} onChange={e => setWriteInput(e.target.value)} />
                <div className="flex items-center gap-2">
                  <MicButton isListening={speech.isListening} isSupported={speech.isSupported}
                    onStart={() => speech.start(t => setWriteInput(p => p + t))} onStop={speech.stop} />
                  <Button className="ml-auto font-bold" disabled={isStreaming || !writeInput.trim()}
                    onClick={() => handleStream(
                      `Improve this to sound professional: "${writeInput}". Show improved version + 3 key changes made.`,
                      `Writing coach named ${teacherShort} for Indian ${level} English learners. ${tutor.teachingStyle}.`,
                      "Write Better"
                    )}>
                    {isStreaming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PenLine className="w-4 h-4 mr-2" />}
                    Improve Writing
                  </Button>
                </div>
                {displayed && <ResultPanel title="Improved Version:" content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(displayed)} onStop={synth.stop}
                  onSave={() => saveResult("write", `Write Better: "${writeInput.slice(0, 50)}"`, displayed)} saved={!!savedMap["write"]} />}
              </CardContent>
            </Card>
          )}

          {/* ── VOCABULARY ── */}
          {mode === "vocab" && (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <Input placeholder="Topic (e.g. Job Interview, Office, Technology)" className="h-11 text-sm"
                  value={vocabTopic} onChange={e => setVocabTopic(e.target.value)} />
                <Button className="font-bold w-full" disabled={isStreaming || !vocabTopic.trim()}
                  onClick={() => handleStream(
                    `8 English words for "${vocabTopic}" (${level} level). Format: word — ${uiLang} meaning — example sentence.`,
                    `English teacher named ${teacherShort} for Indian job seekers. Practical, commonly-used vocabulary.`,
                    `Vocabulary: ${vocabTopic}`
                  )}>
                  {isStreaming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}
                  Generate Vocabulary
                </Button>
                {displayed && <ResultPanel title={`Vocabulary (${uiLang} meanings):`} content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(displayed)} onStop={synth.stop}
                  onSave={() => saveResult("vocab", `Vocabulary: ${vocabTopic}`, displayed)} saved={!!savedMap["vocab"]} />}
              </CardContent>
            </Card>
          )}

          {/* ── PRONUNCIATION ── */}
          {mode === "pronounce" && (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <CardDescription>AI will say the word — you repeat and practise.</CardDescription>
                <div className="flex gap-2">
                  <Input placeholder="English word or phrase to practise"
                    value={pronounceWord} onChange={e => setPronounceWord(e.target.value)} className="h-11 flex-1 text-sm" />
                  <Button variant="outline" size="icon" className="h-11 w-11 shrink-0"
                    onClick={() => speak(pronounceWord, "English")} disabled={!pronounceWord.trim() || synth.isSpeaking}>
                    <Volume2 className="w-4 h-4" />
                  </Button>
                </div>
                <Button className="font-bold w-full" disabled={isStreaming || !pronounceWord.trim()}
                  onClick={() => handleStream(
                    `Pronunciation guide for "${pronounceWord}": phonetic spelling, syllable breakdown, ${uiLang} guide, common Indian mistakes, 3 example sentences.`,
                    `Pronunciation coach named ${teacherShort} for Indian ${level} learners. Simple phonetics.`,
                    `Pronunciation: ${pronounceWord}`
                  )}>
                  {isStreaming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Volume2 className="w-4 h-4 mr-2" />}
                  Get Pronunciation Guide
                </Button>
                {displayed && <ResultPanel title="Pronunciation Guide:" content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(displayed)} onStop={synth.stop}
                  onSave={() => saveResult("pronounce", `Pronunciation: ${pronounceWord}`, displayed)} saved={!!savedMap["pronounce"]} />}
              </CardContent>
            </Card>
          )}

          {/* ── DAILY LESSON ── */}
          {mode === "lesson" && (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <CardDescription>A complete structured lesson tailored to your level and language.</CardDescription>
                <Button className="font-bold w-full h-12" disabled={isStreaming}
                  onClick={() => handleStream(
                    `${level} English lesson: 1) Today's topic & why it matters 2) Key grammar rule + examples 3) 5 vocabulary words (${uiLang} meaning) 4) Practice exercise 5) Homework task.`,
                    `Structured English teacher named ${teacherShort} for Indian ${level} students. ${tutor.teachingStyle}.`,
                    `Daily Lesson: ${level}`
                  )}>
                  {isStreaming ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <GraduationCap className="w-5 h-5 mr-2" />}
                  Generate Today's Lesson
                </Button>
                {displayed && <ResultPanel title={`${level} English Lesson:`} content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(displayed)} onStop={synth.stop}
                  onSave={() => saveResult("lesson", `Daily Lesson: ${level}`, displayed)} saved={!!savedMap["lesson"]} />}
              </CardContent>
            </Card>
          )}

          {/* ── INTERVIEW ENGLISH ── */}
          {mode === "interview_english" && (
            <Card>
              <CardContent className="pt-5 space-y-4">
                <CardDescription>Essential English phrases and expressions used in job interviews.</CardDescription>
                <Button className="font-bold w-full h-12" disabled={isStreaming}
                  onClick={() => handleStream(
                    `10 essential interview phrases for Indian ${level} learners. Each: the phrase — when to use it — ${uiLang} meaning — example in context.`,
                    `Career English coach named ${teacherShort} for Indian job seekers. Practical, interview-ready expressions. ${tutor.teachingStyle}.`,
                    "Interview English"
                  )}>
                  {isStreaming ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Briefcase className="w-5 h-5 mr-2" />}
                  Get Interview Phrases
                </Button>
                {displayed && <ResultPanel title="Interview Phrases:" content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(displayed)} onStop={synth.stop}
                  onSave={() => saveResult("interview_eng", "Interview English Phrases", displayed)} saved={!!savedMap["interview_eng"]} />}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
