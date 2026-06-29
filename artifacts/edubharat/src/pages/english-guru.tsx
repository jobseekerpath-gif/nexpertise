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
import { useEdgeTTS } from "@/lib/use-edge-tts";
import { useStudentProfile } from "@/lib/use-student-profile";
import { AnimatedAvatar } from "@/components/avatar";
import { TUTORS, getTutorById } from "@/lib/tutors";
import { PageMeta } from "@/components/page-meta";
import { exportConversationPdf, exportConversationWord } from "@/lib/export-conversation";
import {
  Mic, MicOff, Volume2, VolumeX, BookOpen, PenLine, Languages,
  SpellCheck, MessageCircle, Bookmark, BookmarkCheck, GraduationCap,
  Briefcase, Loader2, StopCircle, ChevronRight, Zap, ChevronDown,
  Users, FileText, FileDown,
} from "lucide-react";

const MODES = [
  { value: "grammar", label: "Grammar Fix", icon: SpellCheck, desc: "Correct grammar with clear explanations" },
  { value: "write", label: "Write Better", icon: PenLine, desc: "Polish your writing to sound professional" },
  { value: "vocab", label: "Vocabulary", icon: BookOpen, desc: "Learn new words in your language" },
  { value: "pronounce", label: "Pronunciation", icon: Volume2, desc: "Practice English pronunciation" },
  { value: "lesson", label: "Daily Lesson", icon: GraduationCap, desc: "Structured lesson for your level" },
  { value: "interview_english", label: "Interview English", icon: Briefcase, desc: "Professional phrases for interviews" },
] as const;
type Mode = typeof MODES[number]["value"];


function MicButton({ isListening, isSupported, onStart, onStop }: {
  isListening: boolean; isSupported: boolean; onStart: () => void; onStop: () => void;
}) {
  return (
    <Button type="button" variant={isListening ? "destructive" : "outline"} size="icon"
      onClick={isListening ? onStop : onStart} disabled={!isSupported}
      title={!isSupported ? "Voice not supported in this browser" : isListening ? "Stop" : "Speak"} className="shrink-0 min-h-11 min-w-11">
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

  // Capture opener and restore focus on close
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus();
  }, []);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        role="presentation"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutor-dialog-title"
        className="relative bg-card rounded-2xl border shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5"
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
                  width={64}
                  height={64}
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
  return (
    <>
      <PageMeta
        title="English Guru"
        description="Practice English with AI teachers. Speak, listen, fix grammar, and build vocabulary in Hindi and 11 Indian languages."
      />
      <EnglishGuruContent />
    </>
  );
}

function EnglishGuruContent() {
  const { user } = useAuth();
  const { save } = useHistory();
  const { track } = useProgress();
  const { text: aiText, isStreaming, error: aiError, stream, reset: resetAI } = useGeminiStream();
  const synth = useEdgeTTS();
  const { profile, updateProfile } = useStudentProfile();

  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "grammar";
    const requested = new URLSearchParams(window.location.search).get("mode");
    return (MODES.some(m => m.value === requested) ? requested : "grammar") as Mode;
  });
  const [uiLang, setUiLang] = useState(profile.preferredLanguage);

  // Map extended englishLevel field ("Beginner (A1)" etc) to UI level
  const mapEnglishLevel = (raw: string): string => {
    const l = raw.toLowerCase();
    if (l.startsWith("adv") || l.includes("c1") || l.includes("c2")) return "Advanced";
    if (l.startsWith("int") || l.startsWith("upp") || l.includes("b1") || l.includes("b2")) return "Intermediate";
    return "Beginner";
  };

  const [level, setLevel] = useState(() => mapEnglishLevel(profile.englishLevel));
  const [tutorId, setTutorId] = useState(() => {
    // Prefer preferredTutor field; fallback to voiceStyle match
    const byId = TUTORS.find(t => t.id === profile.preferredTutor);
    if (byId) return byId.id;
    const match = TUTORS.find(t => t.voiceStyle === profile.voiceStyle);
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
  const liveChatRef = useRef(liveChat);
  useEffect(() => { liveChatRef.current = liveChat; }, [liveChat]);
  const handleConvPhraseRef = useRef<((p: string) => void) | null>(null);

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
    if (!el) return;
    el.scrollTop = 0;
  }, [convHistory, aiText, isStreaming]);

  // Sync level to profile englishLevel when profile changes externally
  useEffect(() => {
    setLevel(mapEnglishLevel(profile.englishLevel));
  }, [profile.englishLevel]);

  // Sync tutor to profile when profile changes externally
  useEffect(() => {
    const byId = TUTORS.find(t => t.id === profile.preferredTutor);
    const byStyle = TUTORS.find(t => t.voiceStyle === profile.voiceStyle);
    const preferred = byId ?? byStyle;
    if (preferred && preferred.id !== tutorId) setTutorId(preferred.id);
  }, [profile.preferredTutor, profile.voiceStyle, tutorId]);

  const speak = useCallback((text: string, language = uiLang, onEnd?: () => void, opts: { rate?: number } = {}) => {
    synth.speak(stripMarkdownForSpeech(text), language, onEnd, {
      voiceGender: tutor.voiceGender,
      voiceStyle: tutor.voiceStyle,
      ...opts,
    });
  }, [synth, uiLang, tutor.voiceGender, tutor.voiceStyle]);

  const handleSelectTutor = useCallback((id: string) => {
    const t = getTutorById(id);
    if (!t) return;
    synth.stop();
    setTutorId(id);
    updateProfile({ voiceStyle: t.voiceStyle as typeof profile.voiceStyle, voiceGender: t.voiceGender, preferredTutor: id });
  }, [synth, updateProfile]);

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

  // Live chat phrase handler
  const handleConvPhrase = useCallback((phrase: string) => {
    if (!phrase.trim() || isStreaming) return;
    if (liveChatRef.current) {
      // Live voice mode: hard-stop the mic and block it for the whole
      // think+speak cycle so it can never capture the AI's own voice from the
      // speaker (echo / self-repeat). The block is released in the speak onEnd.
      speech.pause();
    } else {
      // Typed mode: just stop any active recognition — never apply the long
      // pause block, or the mic button would stay dead afterwards.
      speech.stop();
    }
    setConvFlowState("ai-thinking");
    void (async () => {
      const userMsg = phrase.trim();
      setConvHistory(h => [...h, { role: "user", text: userMsg }]);
      const recentHistory = [...convHistoryRef.current.slice(-4), { role: "user" as const, text: userMsg }]
        .map(m => `${m.role === "user" ? "Student" : teacherShort}: ${m.text}`).join("\n");
      resetAI();
      const response = await stream(
        `${recentHistory}\n${teacherShort}:`,
        `You are ${teacherShort}, a friendly Indian English coach casually chatting with ${profile.name || "a student"}. ${tutor.teachingStyle}. Reply ONLY in ${uiLang} — never switch languages. Use contractions (I'm, you're, that's). Sound warm and real — like a helpful friend, not a textbook. React naturally ("Oh nice!", "Hmm good point!", "That's right!") when it fits. If the student makes a grammar mistake, use the correct form naturally in your reply without formally pointing it out. No lists, no markdown, no symbols. Max 2 short sentences.`,
        undefined,
        { maxTokens: 120 }
      );
      if (response) {
        const cleanResponse = stripMarkdownForSpeech(response);
        setConvHistory(h => [...h, { role: "ai", text: cleanResponse }]);
        track("English Guru", "Live Conversation");
        setConvFlowState("ai-speaking");
        // Always use uiLang for TTS — AI was instructed to respond in uiLang,
        // so we should speak it in that language regardless of script detection.
        speak(cleanResponse, uiLang, () => {
          if (liveChatRef.current) {
            // Only override the block — the single recognition loop started in
            // toggleLiveChat resumes automatically once blockFor expires.
            // Do NOT call stop() or startContinuous() here; that creates a second
            // competing loop which cancels the first and kills subsequent turns.
            speech.blockFor(1200);
            setConvFlowState("user-speaking");
          } else {
            setConvFlowState("idle");
          }
        }, { rate: 1.15 });
      } else {
        // AI gave no response — release the pause block so the existing loop
        // resumes listening. No new startContinuous needed.
        if (liveChatRef.current) {
          speech.blockFor(400);
          setConvFlowState("user-speaking");
        } else {
          setConvFlowState("idle");
        }
      }
    })();
  }, [stream, resetAI, speak, track, isStreaming, speech, profile.name, tutor.teachingStyle, uiLang, teacherShort]);

  useEffect(() => { handleConvPhraseRef.current = handleConvPhrase; }, [handleConvPhrase]);

  const toggleLiveChat = useCallback(() => {
    if (liveChat) {
      setLiveChat(false);
      setConvFlowState("idle");
      speech.stop();
      synth.stop();
    } else {
      setLiveChat(true);
      setConvFlowState("user-speaking");
      // Use ref so the callback always calls the latest handleConvPhrase even
      // after its deps (e.g. isStreaming) change — avoids stale closures.
      speech.startContinuous(p => handleConvPhraseRef.current?.(p));
    }
  }, [liveChat, speech, synth]);

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
              subtitle={tutor.role}
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
              subtitle={tutor.role}
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
              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Student Name</span>
                <Input
                  value={profile.name}
                  onChange={(e) => updateProfile({ name: e.target.value })}
                  placeholder={user?.name ?? "Your name"}
                  className="h-9 text-sm"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Native Language</span>
                <Select value={uiLang} onValueChange={(value) => { setUiLang(value); updateProfile({ preferredLanguage: value }); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">🇬🇧 English</SelectItem>
                    <SelectItem value="Hindi">🇮🇳 Hindi</SelectItem>
                    {INDIAN_LANGUAGES.filter(l => l !== "Hindi").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">My Level</span>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Beginner", "Intermediate", "Advanced"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
            </CardContent>
          </Card>
        </aside>

        {/* Main content */}
        <main className="order-1 lg:order-2 min-w-0">
          {/* ── MODE SELECTOR STRIP — always visible above Live Chat ── */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {MODES.map(m => {
              const MIcon = m.icon;
              const active = mode === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => { setMode(m.value as Mode); setResult(""); resetAI(); setLiveChat(false); speech.stop(); setConvFlowState("idle"); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                    ${active
                      ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                      : "bg-white text-muted-foreground border-border hover:border-orange-300 hover:text-orange-600"
                    }`}
                >
                  <MIcon className="w-3 h-3 shrink-0" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* ── LIVE CONVERSATION TILE — always visible, not mode-gated ── */}
          <Card className={`flex flex-col overflow-hidden border-2 mb-5 transition-all ${liveChat ? "border-green-400 bg-green-50/30 h-[62vh]" : "border-green-200/70 bg-green-50/10"}`}>
            <CardContent className="pt-4 pb-4 space-y-3 flex min-h-0 flex-1 flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 bg-green-100 text-green-700 rounded-lg flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-secondary">Live Conversation</p>
                    <p className="text-xs text-muted-foreground">Speak in {uiLang}, AI responds naturally</p>
                  </div>
                  {/* Inline teacher/voice selector — compact scrollable dropdown */}
                  <Select value={tutorId} onValueChange={id => { handleSelectTutor(id); }}>
                    <SelectTrigger className="h-8 text-xs max-w-[140px] rounded-full border-green-300 bg-green-50 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TUTORS.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground mr-1">Save chat:</span>
                  <Button variant="outline" size="sm" className="text-xs h-8"
                    onClick={() => exportConversationPdf(convHistory, { aiName: teacherShort, userName: profile.name || "You" })}>
                    <FileDown className="w-3.5 h-3.5 mr-1.5" />PDF
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-8"
                    onClick={() => exportConversationWord(convHistory, { aiName: teacherShort, userName: profile.name || "You" })}>
                    <FileText className="w-3.5 h-3.5 mr-1.5" />Word
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-8 ml-auto"
                    onClick={() => { setConvHistory([]); setLiveChat(false); speech.stop(); setConvFlowState("idle"); }}>
                    Clear & Start Over
                  </Button>
                </div>
              )}
              {!speech.isSupported && (
                <p className="text-xs text-muted-foreground text-center">Voice requires Chrome or Edge browser</p>
              )}
            </CardContent>
          </Card>

          <div className="mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-secondary">{currentMode.label}</h1>
              </div>
            </div>
          </div>



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
                <CardDescription>A fresh research-based lesson every day — tailored to your level and native language.</CardDescription>
                <Button className="font-bold w-full h-12" disabled={isStreaming}
                  onClick={() => {
                    const today = new Date();
                    const dayOfYear = Math.ceil((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
                    const LESSON_TOPICS = [
                      "Greetings and Professional Introductions","Workplace Emails and Messages","Telephone Etiquette","Presenting Ideas in Meetings","Job Interview Phrases","Describing Your Work Experience","Polite Disagreement at Work","Asking and Giving Directions","Numbers, Dates and Time","Shopping and Negotiating","Expressing Opinions Clearly","Talking About Health and Wellbeing","Travel and Transportation","Banking and Financial Terms","Media and Current Events","Sports and Recreation Vocabulary","Technology and Social Media","Family and Relationships","Food and Restaurant English","Education and Learning Terms","Describing People and Personalities","Office Small Talk","Following Instructions","Making and Refusing Requests","Apologies and Reconciliation","Reports and Data Language","Leadership and Teamwork Phrases","Problem-Solving Language","Celebrations and Social Events","Environmental and Science Terms",
                    ];
                    const topic = LESSON_TOPICS[dayOfYear % LESSON_TOPICS.length]!;
                    handleStream(
                      `Today is ${today.toLocaleDateString("en-IN")} (Day ${dayOfYear}).

Generate a UNIQUE ${level}-level English lesson on: "${topic}"

IMPORTANT: Write ONLY plain sentences. Do NOT use *, **, #, ##, ---, bullets, or any markdown.

Use exactly this structure:

1. TODAY'S TOPIC
Write 2 clear sentences about "${topic}" and why it matters for Indian job seekers.

2. WHY IT MATTERS
Give 2 examples of real career or daily life situations where this topic helps.

3. KEY WORDS
List 5 useful English words from this topic. For each word write: the word, then its ${uiLang} meaning, then one example sentence. Separate each with a line break.

4. PRACTICE SENTENCES
Give 2 fill-in-the-blank exercises. Then show the correct answers below each.

5. TODAY'S TASK
Give one specific 10-minute activity the student can do right now to practise this topic.

Write warmly as a teacher. Use simple, clear language. No markdown symbols at all.`,
                      `You are ${teacherShort}, a warm and experienced English teacher for Indian ${level} students. ${tutor.teachingStyle}. The student's native language is ${uiLang}. Respond entirely in plain text with numbered sections only. Never use *, **, #, ---, or bullets. Write as if speaking to a student directly.`,
                      `Daily Lesson: ${topic}`
                    );
                  }}>
                  {isStreaming ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <GraduationCap className="w-5 h-5 mr-2" />}
                  Generate Today's Lesson
                </Button>
                {displayed && <ResultPanel title={`${level} English Lesson:`} content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(stripMarkdownForSpeech(displayed))} onStop={synth.stop}
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
