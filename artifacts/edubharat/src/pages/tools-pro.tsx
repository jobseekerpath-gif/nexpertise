import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
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
import { MODES, type Mode, stripMarkdownForSpeech, mapEnglishLevel } from "@/lib/english-tools";
import { MicButton, ResultPanel, TutorSelector } from "@/components/english/shared-ui";
import {
  Volume2, SpellCheck, PenLine, BookOpen, GraduationCap, Briefcase, Loader2, Users,
} from "lucide-react";

export default function ToolsPro() {
  return (
    <>
      <PageMeta
        title="Tools Pro"
        description="Pro English practice tools — fix grammar, write better, build vocabulary, master pronunciation, get a daily lesson, and learn interview phrases in Hindi and 11 Indian languages."
      />
      <ToolsProContent />
    </>
  );
}

function ToolsProContent() {
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
  const teacherShort = tutor.name.replace(/\s+(Ma'am|Sir)$/i, "");

  const [grammarInput, setGrammarInput] = useState("");
  const [writeInput, setWriteInput] = useState("");
  const [vocabTopic, setVocabTopic] = useState("");
  const [pronounceWord, setPronounceWord] = useState("");
  const [result, setResult] = useState("");
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});

  const speech = useSpeechRecognition(uiLang);

  // Seed student name from the signed-in account
  useEffect(() => {
    if (user?.name && !profile.name) updateProfile({ name: user.name });
  }, [user?.name, profile.name, updateProfile]);

  // Keep selectors in sync when the profile changes externally
  useEffect(() => { setUiLang(profile.preferredLanguage); }, [profile.preferredLanguage]);
  useEffect(() => { setLevel(mapEnglishLevel(profile.englishLevel)); }, [profile.englishLevel]);
  useEffect(() => {
    const byId = TUTORS.find(t => t.id === profile.preferredTutor);
    const byStyle = TUTORS.find(t => t.voiceStyle === profile.voiceStyle);
    const preferred = byId ?? byStyle;
    if (preferred && preferred.id !== tutorId) setTutorId(preferred.id);
  }, [profile.preferredTutor, profile.voiceStyle, tutorId]);

  const speak = useCallback((text: string, language = uiLang) => {
    const t = stripMarkdownForSpeech(text)
      .replace(/^(?:Teacher|AI|Assistant|System):\s*/i, "")
      .replace(/\b(?:Student|User):\s*/gi, "")
      .trim();
    // Keep only the first natural reply line if the model echoes instructions.
    const firstSentence = t.split(/\n/).find(l => {
      const s = l.trim();
      return s.length > 2 && !s.startsWith("[") && !s.startsWith("(") && !s.startsWith("-") && !/^\d+[.)]\s*$/.test(s);
    }) ?? t;
    synth.speak(firstSentence, language, undefined, {
      voiceGender: tutor.voiceGender,
      voiceStyle: tutor.voiceStyle,
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
    }
    // Tool results are NOT auto-spoken — each result panel has its own Speak button.
    return full;
  }, [stream, resetAI, synth, track]);

  const saveResult = useCallback((key: string, title: string, content: string) => {
    save({ tool: "English Guru", title, content });
    setSavedMap(m => ({ ...m, [key]: true }));
  }, [save]);

  const displayed = isStreaming ? aiText : result;
  const activeMode = MODES.find(m => m.value === mode);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 max-w-5xl">
      {showTutorPicker && (
        <TutorSelector currentId={tutorId} onSelect={handleSelectTutor} onClose={() => setShowTutorPicker(false)} />
      )}

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-display font-bold text-secondary">Tools Pro</h1>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-500 text-white rounded-full px-2 py-0.5">Pro</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Six focused English tools, powered by your AI Guru <span className="font-semibold text-secondary">{teacherShort}</span>.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-3">
          <Button
            variant="default"
            className="w-full font-semibold rounded-xl h-9"
            onClick={() => setShowTutorPicker(true)}
          >
            <Users className="w-4 h-4 mr-2" />Change Teacher
          </Button>

          {/* Tutor card */}
          <div className="flex flex-col items-center py-3 px-3 bg-card rounded-2xl border shadow-sm">
            <AnimatedAvatar
              name={tutor.name}
              subtitle={tutor.role}
              isSpeaking={synth.isSpeaking}
              isThinking={isStreaming}
              gender={tutor.gender}
              size="md"
              imageSrc={tutor.imageSrc}
            />
            <div className="mt-2 text-center px-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed italic line-clamp-2">"{tutor.intro}"</p>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {tutor.languages.map(l => (
                <span key={l} className="text-[10px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">{l}</span>
              ))}
            </div>
          </div>

          {/* Settings card */}
          <Card className="border shadow-sm">
            <CardContent className="pt-3 pb-3 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Student Name</span>
                <Input
                  value={profile.name}
                  onChange={(e) => updateProfile({ name: e.target.value })}
                  placeholder={user?.name ?? "Your name"}
                  className="h-8 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Native language</span>
                <Select value={uiLang} onValueChange={(v) => { setUiLang(v); updateProfile({ preferredLanguage: v }); }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">🇬🇧 English</SelectItem>
                    <SelectItem value="Hindi">🇮🇳 Hindi</SelectItem>
                    {INDIAN_LANGUAGES.filter(l => l !== "Hindi").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Level</span>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Beginner", "Intermediate", "Advanced"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
            </CardContent>
          </Card>
        </aside>

        {/* Main content */}
        <main className="min-w-0 space-y-3">
          {/* Mode selector */}
          <div className="flex items-center gap-2 flex-wrap">
            {MODES.map(m => {
              const MIcon = m.icon;
              const active = mode === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => { setMode(m.value as Mode); setResult(""); resetAI(); }}
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

          {activeMode && <p className="text-xs text-muted-foreground">{activeMode.desc}</p>}

          {/* ── GRAMMAR FIX ── */}
          {mode === "grammar" && (
            <Card>
              <CardContent className="pt-3 space-y-2">
                <Textarea placeholder="Type or speak your text..." className="min-h-[80px] text-sm"
                  value={grammarInput} onChange={e => setGrammarInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && grammarInput.trim() && !isStreaming) { e.preventDefault(); handleStream(`Fix grammar: "${grammarInput}". List each correction with brief ${uiLang} explanation.`, `Encouraging English teacher named ${teacherShort} for Indian ${level} learners. ${tutor.teachingStyle}.`, "Grammar Fix"); } }} />
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
              <CardContent className="pt-3 space-y-2">
                <Textarea placeholder="Type your draft..." className="min-h-[80px] text-sm"
                  value={writeInput} onChange={e => setWriteInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && writeInput.trim() && !isStreaming) { e.preventDefault(); handleStream(`Improve this to sound professional: "${writeInput}". Show improved version + 3 key changes made.`, `Writing coach named ${teacherShort} for Indian ${level} English learners. ${tutor.teachingStyle}.`, "Write Better"); } }} />
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
              <CardContent className="pt-3 space-y-2">
                <Input placeholder="Topic (e.g. Job Interview, Office, Technology)" className="h-9 text-sm"
                  value={vocabTopic} onChange={e => setVocabTopic(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && vocabTopic.trim() && !isStreaming) { handleStream(`8 English words for "${vocabTopic}" (${level} level). Format: word — ${uiLang} meaning — example sentence.`, `English teacher named ${teacherShort} for Indian job seekers. Practical, commonly-used vocabulary.`, `Vocabulary: ${vocabTopic}`); } }} />
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
              <CardContent className="pt-3 space-y-2">
                <p className="text-xs text-muted-foreground">AI says the word — you repeat and practise.</p>
                <div className="flex gap-2">
                  <Input placeholder="English word or phrase to practise"
                    value={pronounceWord} onChange={e => setPronounceWord(e.target.value)} className="h-9 flex-1 text-sm"
                    onKeyDown={e => { if (e.key === "Enter" && pronounceWord.trim() && !isStreaming) { handleStream(`Pronunciation guide for "${pronounceWord}": phonetic spelling, syllable breakdown, ${uiLang} guide, common Indian mistakes, 3 example sentences.`, `Pronunciation coach named ${teacherShort} for Indian ${level} learners. Simple phonetics.`, `Pronunciation: ${pronounceWord}`); } }} />
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
              <CardContent className="pt-3 space-y-2">
                <p className="text-xs text-muted-foreground">A fresh lesson tailored to your level and native language.</p>
                <Button className="font-bold w-full h-10" disabled={isStreaming}
                  onClick={() => {
                    const LESSON_TOPICS = [
                      "Greetings and Professional Introductions","Workplace Emails and Messages","Telephone Etiquette","Presenting Ideas in Meetings","Job Interview Phrases","Describing Your Work Experience","Polite Disagreement at Work","Asking and Giving Directions","Numbers, Dates and Time","Shopping and Negotiating","Expressing Opinions Clearly","Talking About Health and Wellbeing","Travel and Transportation","Banking and Financial Terms","Media and Current Events","Sports and Recreation Vocabulary","Technology and Social Media","Family and Relationships","Food and Restaurant English","Education and Learning Terms","Describing People and Personalities","Office Small Talk","Following Instructions","Making and Refusing Requests","Apologies and Reconciliation","Reports and Data Language","Leadership and Teamwork Phrases","Problem-Solving Language","Celebrations and Social Events","Environmental and Science Terms",
                    ];
                    const INDIAN_CONTEXTS = [
                      "a software engineer in Bengaluru","a sales executive in Mumbai","a fresh graduate applying to an MNC","a bank teller in Chennai","a nurse at a Delhi hospital","a shop manager in Hyderabad","a government employee in Pune","a college student in Kolkata","a call centre agent in Noida","a schoolteacher in Jaipur","a pharmacist in Ahmedabad","a logistics coordinator in Surat",
                    ];
                    // Fully random every click — topic, context, and a unique seed so no two lessons look alike
                    const topic = LESSON_TOPICS[Math.floor(Math.random() * LESSON_TOPICS.length)]!;
                    const ctx   = INDIAN_CONTEXTS[Math.floor(Math.random() * INDIAN_CONTEXTS.length)]!;
                    const seed  = Math.random().toString(36).slice(2, 8);
                    handleStream(
                      `[uid:${seed}] Write a fresh ${level}-level English lesson on: "${topic}"
Tailor every example to: ${ctx}.

Write ONLY plain text. No *, **, #, ---, bullets, or markdown of any kind.

Structure:

1. TODAY'S TOPIC
Two sentences about "${topic}" and why it helps someone like ${ctx}.

2. WHY IT MATTERS
Two specific real-life examples from ${ctx}'s daily work or life.

3. KEY WORDS
Five English words for this topic. For each: the word, its ${uiLang} meaning, one example sentence from ${ctx}'s world.

4. PRACTICE SENTENCES
Two fill-in-the-blank exercises set in ${ctx}'s situation. Show the answers below each.

5. TODAY'S TASK
One specific 10-minute speaking or writing activity the student can do right now.

Teach warmly and directly. No markdown at all.`,
                      `You are ${teacherShort}, an English teacher for Indian ${level} students. ${tutor.teachingStyle}. Native language: ${uiLang}. Every generation must feel completely fresh — different words, different sentences, different scenarios every time. Plain text only, numbered sections only.`,
                      `Daily Lesson: ${topic}`
                    );
                  }}>
                  {isStreaming ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <GraduationCap className="w-5 h-5 mr-2" />}
                  Generate Today's Lesson
                </Button>
                {displayed && <ResultPanel title={`${level} English Lesson:`} content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(stripMarkdownForSpeech(displayed), "English")} onStop={synth.stop}
                  onSave={() => saveResult("lesson", `Daily Lesson: ${level}`, displayed)} saved={!!savedMap["lesson"]} />}
              </CardContent>
            </Card>
          )}

          {/* ── INTERVIEW ENGLISH ── */}
          {mode === "interview_english" && (
            <Card>
              <CardContent className="pt-3 space-y-2">
                <p className="text-xs text-muted-foreground">Essential phrases and expressions for job interviews.</p>
                <Button className="font-bold w-full h-10" disabled={isStreaming}
                  onClick={() => handleStream(
                    `10 essential interview phrases for Indian ${level} learners. Each: the phrase — when to use it — ${uiLang} meaning — example in context.`,
                    `Career English coach named ${teacherShort} for Indian job seekers. Practical, interview-ready expressions. ${tutor.teachingStyle}.`,
                    "Interview English"
                  )}>
                  {isStreaming ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Briefcase className="w-5 h-5 mr-2" />}
                  Get Interview Phrases
                </Button>
                {displayed && <ResultPanel title="Interview Phrases:" content={displayed} isSpeaking={synth.isSpeaking}
                  onSpeak={() => speak(stripMarkdownForSpeech(displayed), "English")} onStop={synth.stop}
                  onSave={() => saveResult("interview_eng", "Interview English Phrases", displayed)} saved={!!savedMap["interview_eng"]} />}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
