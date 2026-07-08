import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INDIAN_LANGUAGES } from "@/lib/constants";
import { useAuth } from "@/lib/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useCredits, startLiveBlock, tickLiveBlock, LIVE_BLOCK_SECONDS } from "@/lib/use-credits";
import { useGuestTrial, guestLiveSecondsLeft, addGuestLiveSeconds } from "@/lib/guest-trial";
import { useProgress } from "@/lib/use-progress";
import { useGeminiStream } from "@/lib/use-gemini-stream";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { useEdgeTTS, unlockAudio } from "@/lib/use-edge-tts";
import { useStudentProfile } from "@/lib/use-student-profile";
import { AnimatedAvatar } from "@/components/avatar";
import { TUTORS, getTutorById } from "@/lib/tutors";
import { PageMeta } from "@/components/page-meta";
import { exportConversationPdf, exportConversationWord } from "@/lib/export-conversation";
import {
  Mic, MessageCircle, Loader2, StopCircle, ChevronRight,
  Users, FileText, FileDown,
} from "lucide-react";
import { stripMarkdownForSpeech, mapEnglishLevel } from "@/lib/english-tools";
import { MicButton, TutorSelector } from "@/components/english/shared-ui";

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
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { balance } = useCredits();
  const { liveSecondsLeft: guestLiveLeft } = useGuestTrial();
  const { track } = useProgress();
  const { text: aiText, isStreaming, error: aiError, stream, reset: resetAI } = useGeminiStream();
  const synth = useEdgeTTS();
  const { profile, updateProfile } = useStudentProfile();

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

  const [convHistory, setConvHistory] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [convInput, setConvInput] = useState("");
  const [liveChat, setLiveChat] = useState(false);
  const [convFlowState, setConvFlowState] = useState<"idle" | "user-speaking" | "ai-thinking" | "ai-speaking">("idle");
  const convInputRef = useRef<HTMLTextAreaElement>(null);
  const convScrollRef = useRef<HTMLDivElement>(null);

  const speech = useSpeechRecognition(uiLang);
  /**
   * speechRef — always-current speech handle so handleConvPhrase doesn't need
   * `speech` in its deps (speech changes every render because it's an object
   * literal, causing unnecessary handleConvPhrase re-creation).
   */
  const speechRef = useRef(speech);
  useEffect(() => { speechRef.current = speech; }, [speech]);
  const convHistoryRef = useRef(convHistory);
  const liveChatRef = useRef(liveChat);
  useEffect(() => { liveChatRef.current = liveChat; }, [liveChat]);
  const handleConvPhraseRef = useRef<((p: string) => void) | null>(null);
  /**
   * aiBusyRef — true from the moment a phrase is accepted until the AI finishes
   * thinking AND speaking. Guards against a late/echoed recognition result
   * re-triggering handleConvPhrase mid-reply, which would call globalStop() and
   * cut the AI off abruptly. isStreaming alone doesn't cover the TTS window.
   */
  const aiBusyRef = useRef(false);
  /** Safety timer: if TTS onEnd never fires, force-clear aiBusyRef so the mic comes back. */
  const speakSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tracks last user speech activity (interim transcript / phrase) for silence detection. */
  const lastUserSpeechRef = useRef(Date.now());
  /** Prevents re-entrant silence probes if one is already in-flight. */
  const silenceProbeActiveRef = useRef(false);
  /** Counts consecutive silence probes since the user last spoke; max 2 nudges then stop. */
  const silenceProbeCountRef = useRef(0);

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

  // Update lastUserSpeechRef whenever recognition produces interim text
  useEffect(() => {
    if (speech.interimTranscript && liveChat) {
      lastUserSpeechRef.current = Date.now();
      silenceProbeActiveRef.current = false; // user is actively speaking — cancel any pending re-engage
      silenceProbeCountRef.current = 0; // user spoke — reset nudge counter
    }
  }, [speech.interimTranscript, liveChat]);

  // Silence re-engagement: if user hasn't spoken for 10 s during live chat,
  // the AI gently re-engages — but only up to 2 consecutive nudges.
  useEffect(() => {
    if (!liveChat || convFlowState !== "user-speaking") {
      silenceProbeActiveRef.current = false;
      return;
    }
    // Reset the clock whenever we enter user-speaking state
    lastUserSpeechRef.current = Date.now();
    silenceProbeActiveRef.current = false;
    const id = setInterval(() => {
      if (aiBusyRef.current || !liveChatRef.current || silenceProbeActiveRef.current) return;
      if (silenceProbeCountRef.current >= 2) return; // already nudged twice — don't nag
      const silentMs = Date.now() - lastUserSpeechRef.current;
      if (silentMs > 10_000) {
        silenceProbeActiveRef.current = true;
        silenceProbeCountRef.current += 1;
        lastUserSpeechRef.current = Date.now();
        // Trigger re-engagement via the phrase handler using a sentinel value
        handleConvPhraseRef.current?.("__silence__");
      }
    }, 2_500);
    return () => clearInterval(id);
  }, [liveChat, convFlowState]);

  // Sync tutor to profile when profile changes externally
  useEffect(() => {
    const byId = TUTORS.find(t => t.id === profile.preferredTutor);
    const byStyle = TUTORS.find(t => t.voiceStyle === profile.voiceStyle);
    const preferred = byId ?? byStyle;
    if (preferred && preferred.id !== tutorId) setTutorId(preferred.id);
  }, [profile.preferredTutor, profile.voiceStyle, tutorId]);

  const speak = useCallback((text: string, language = uiLang, onEnd?: () => void, opts: { rate?: number } = {}) => {
    let t = stripMarkdownForSpeech(text)
      .replace(/^(?:Teacher|AI|Assistant|System):\s*/i, "")
      .replace(/\b(?:Student|User):\s*/gi, "")
      .trim();
    // If the model accidentally echoes instructions, keep only the first natural reply line.
    const firstSentence = t.split(/\n/).find(l => {
      const s = l.trim();
      return s.length > 2 && !s.startsWith("[") && !s.startsWith("(") && !s.startsWith("-") && !/^\d+[.)]\s*$/.test(s);
    }) ?? t;
    synth.speak(firstSentence, language, onEnd, {
      voiceGender: tutor.voiceGender,
      voiceStyle: tutor.voiceStyle,
      ...opts,
    });
  }, [synth, uiLang, tutor.voiceGender, tutor.voiceStyle]);

  /**
   * speakRef — always-current speak function so handleConvPhrase doesn't need
   * `speak` in its deps (speak changes whenever synth.isSpeaking toggles).
   */
  const speakRef = useRef(speak);
  useEffect(() => { speakRef.current = speak; }, [speak]);
  // Echo-rejection state: the AI's most recent spoken text and when it finished.
  // handleConvPhrase uses these to drop mic captures that are really the AI's
  // own voice coming back through the speaker.
  const lastAiSpeechRef = useRef("");
  const lastAiSpeechEndRef = useRef(0);

  const handleSelectTutor = useCallback((id: string) => {
    const t = getTutorById(id);
    if (!t) return;
    synth.stop();
    // Cancel any pending release/safety timer from an in-flight turn so it can't
    // later fire and unblock the mic in the middle of the handoff greeting.
    if (speakSafetyTimerRef.current) { clearTimeout(speakSafetyTimerRef.current); speakSafetyTimerRef.current = null; }
    // Unlock the busy flag — the previous AI reply may still be "speaking" as
    // far as the flag is concerned, which would silently block the next turn.
    aiBusyRef.current = false;
    setTutorId(id);
    updateProfile({ voiceStyle: t.voiceStyle as typeof profile.voiceStyle, voiceGender: t.voiceGender, preferredTutor: id });
    // If live conversation is running, resume it with the new tutor's voice.
    // Use a natural transition — not a scripted introduction — so the handoff
    // feels like a real person stepping in mid-conversation.
    if (liveChatRef.current) {
      const shortName = t.name.replace(/\s+(Ma'am|Sir)$/i, "");
      const transitions = [
        `I've got it from here! I'm ${shortName}. Please go ahead — I'm listening!`,
        `Taking over now! ${shortName} here. Continue whenever you're ready.`,
        `${shortName} stepping in! Right, so where were we? Go ahead!`,
        `Here's ${shortName}! I'm all ears — carry on.`,
      ];
      const greeting = transitions[Math.floor(Math.random() * transitions.length)]!;
      setConvHistory(h => [...h, { role: "ai", text: greeting }]);
      setConvFlowState("ai-speaking");
      // Lock the busy flag AND kill the mic BEFORE speaking so the greeting
      // can't be picked up as user input (same pattern as handleConvPhrase).
      aiBusyRef.current = true;
      speechRef.current.pause();
      lastAiSpeechRef.current = greeting;
      // Release the mic when the greeting finishes. Guarded by a safety timer so
      // that if TTS onEnd never fires (autoplay block, audio glitch, eviction)
      // the mic and busy flag can't stay stuck — otherwise the conversation would
      // freeze right after a teacher switch.
      const releaseGreeting = () => {
        if (speakSafetyTimerRef.current) { clearTimeout(speakSafetyTimerRef.current); speakSafetyTimerRef.current = null; }
        aiBusyRef.current = false;
        if (!liveChatRef.current) return;
        setConvFlowState("user-speaking");
        // Echo-guard: 1500 ms matches handleConvPhrase so teacher-switch greetings
        // never get self-captured by the mic on the next turn.
        lastAiSpeechEndRef.current = Date.now();
        speechRef.current.blockFor(1500);
      };
      speakSafetyTimerRef.current = setTimeout(releaseGreeting, Math.max(greeting.length * 60 + 4000, 8000));
      // Greetings are always English — voice them with the English tutor voice so
      // a native neural voice never reads English text with the wrong accent.
      synth.speak(stripMarkdownForSpeech(greeting), "English", releaseGreeting, { voiceGender: t.voiceGender, voiceStyle: t.voiceStyle });
    }
  }, [synth, updateProfile, speech, uiLang]);

  const teacherShort = tutor.name.replace(/\s+(Ma'am|Sir)$/i, "");

  // Sentinel value for silence-probe turns (no visible user message added)
  const SILENCE_MARKER = "__silence__";

  // Live chat phrase handler
  const handleConvPhrase = useCallback((phrase: string) => {
    const isSilenceProbe = phrase === SILENCE_MARKER;
    // Guard: normal phrases need content; silence probes just need the channel to be free.
    if (!isSilenceProbe && (!phrase.trim() || (!liveChatRef.current && isStreaming) || aiBusyRef.current)) return;
    if (isSilenceProbe && (aiBusyRef.current || !liveChatRef.current)) return;
    // Echo guard: a phrase arriving within ~3.5s of the AI finishing, that closely
    // matches what the AI just said, is the mic hearing the speaker — not the user.
    // Drop it so the teacher never "replies to its own voice".
    if (!isSilenceProbe && Date.now() - lastAiSpeechEndRef.current < 4500) {
      const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
      const p = norm(phrase);
      const ai = norm(lastAiSpeechRef.current);
      if (p.length >= 6 && ai) {
        const words = p.split(" ");
        const aiWords = new Set(ai.split(" "));
        const overlap = words.filter(w => aiWords.has(w)).length / words.length;
        // Substring match only for longer fragments; overlap match needs several
        // words at a high ratio — so short legit replies ("yes", "okay, tell me
        // more") are never mistaken for the AI's own echo.
        if ((p.length >= 10 && ai.includes(p)) || (words.length >= 4 && words.length <= 14 && overlap >= 0.85)) return;
      }
    }
    // Real user phrase resets the silence-nudge counter
    if (!isSilenceProbe) { silenceProbeCountRef.current = 0; silenceProbeActiveRef.current = false; }
    aiBusyRef.current = true;
    if (liveChatRef.current) {
      // Live voice mode: hard-stop the mic and block it for the whole
      // think+speak cycle so it can never capture the AI's own voice from the
      // speaker (echo / self-repeat). The block is released in the speak onEnd.
      speechRef.current.pause();
    } else {
      // Typed mode: just stop any active recognition — never apply the long
      // pause block, or the mic button would stay dead afterwards.
      speechRef.current.stop();
    }
    setConvFlowState("ai-thinking");
    void (async () => {
      try {
        const userMsg = isSilenceProbe ? "" : phrase.trim();
        // Only add normal phrases to visible conversation history
        if (!isSilenceProbe) {
          setConvHistory(h => [...h, { role: "user", text: userMsg }]);
        }
        // Build AI context: for silence probes, inject a re-engage instruction
        const historySlice = [...convHistoryRef.current.slice(-6)];
        if (!isSilenceProbe) historySlice.push({ role: "user" as const, text: userMsg });
        const recentHistory = historySlice
          .map(m => `${m.role === "user" ? "Student" : teacherShort}: ${m.text}`).join("\n");
        const silenceInstruction = isSilenceProbe
          ? `\n[The student has been quiet for a moment. Gently re-engage — ask a warm natural follow-up question or check in based on the conversation so far. 1–2 sentences max.]\n`
          : "";
        resetAI();

        // ── News / current-events enrichment ─────────────────────────────
        // When the student clearly asks about real-world news or info, fetch
        // a quick web snippet so the AI can answer confidently rather than
        // saying "I cannot access the internet."
        // Kept intentionally specific to avoid false-positives on common words
        // (e.g. "result" of a grammar exercise vs. "match result").
        const NEWS_RE = /\b(news|latest news|cricket (score|match|result|news)|ipl (score|match|result)|election (result|winner|news)|prime minister|petrol price|diesel price|gold price|dollar rate|stock market|sensex|nifty|box office|film release|weather forecast|covid|inflation rate|gdp|budget 2024|budget 2025)\b/i;
        let webContext = "";
        if (!isSilenceProbe && NEWS_RE.test(userMsg)) {
          try {
            const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
            const ctxRes = await fetch(
              `${base}/api/ai/web-context?q=${encodeURIComponent(userMsg.slice(0, 200))}`,
              { credentials: "include", signal: AbortSignal.timeout(1500) }
            );
            if (ctxRes.ok) {
              const ctxData = await ctxRes.json() as { context: string };
              webContext = (ctxData.context ?? "").trim();
            }
          } catch { /* web context is enrichment only — never block conversation */ }
        }

        const isEnglishNative = uiLang === "English";
        const languageGuidance = isEnglishNative
          ? `Speak in clear, simple, natural English throughout.`
          : `The student's ONLY helper language is ${uiLang} — do NOT use any other Indian language (not Hindi, not Kannada, not Tamil, not any other — ONLY ${uiLang} when needed). English is the goal, so speak MOSTLY in simple, clear English and keep them practicing. But use ${uiLang} as a warm helping hand whenever they need it: if the student replies in ${uiLang}, tells you (in any language) that they didn't understand, or clearly seems confused, briefly explain the tricky word or idea in ${uiLang}, then continue in English. You may drop a short ${uiLang} gloss in brackets right after a hard English word. Never leave them stuck or embarrassed — slow down, simplify, and lean on ${uiLang} to unblock them, then gently guide them back to English. When they're managing fine in English, keep your whole reply in English.`;

        const webContextNote = webContext
          ? `\n\nLive web context (use naturally if relevant): "${webContext}"`
          : "";

        const response = await stream(
          `${recentHistory}${silenceInstruction}\n${teacherShort}:`,
          `You are ${teacherShort}, a warm, experienced Indian English coach on a live voice call with ${profile.name || "a student"} (${level} English level). ${tutor.teachingStyle}. ${languageGuidance}

This is an ONGOING conversation. NEVER introduce yourself or say "Hello, I'm ${teacherShort}" — just continue naturally as a human teacher would mid-conversation.

Rules for spoken replies:
- Imagine you are SPEAKING, not writing. Keep it 2–3 short, punchy sentences max.
- Use contractions always: I'm, you're, that's, let's, it's, can't, won't.
- Vary your opening reactions — never use the same one twice: "Oh interesting!", "Hmm!", "Right, so...", "Actually...", "Oh nice!", "Ah I see!", "Yeah, and...", "Good point!", "That makes sense..."
- Use natural fillers occasionally: "Hmm...", "You know...", "Actually...", "Let me think..."
- Ask follow-up questions based on what they just said — never repeat a question already covered in this conversation.
- NEVER restate, rephrase, or echo your own previous message — each reply must add something genuinely new and move the conversation forward.
- If they make a grammar mistake, quietly use the correct form in YOUR next sentence — never point it out.
- NEVER use bullet points, numbered lists, dashes, asterisks, or any formatting.
- NEVER start your reply with your name or any label like "Teacher:".
- Always finish your thought — never cut off mid-sentence.
- If asked about news, sports, films, prices, or current events: answer confidently using "from what I know" or "last I heard". Do NOT say you have no internet. Your knowledge is up to early 2025; for very recent things, say "I may not have the very latest, but…".${webContextNote}`,
          undefined,
          { maxTokens: 160 }
        );
        /** Release the busy lock and reopen the mic — called from TTS onEnd OR the safety timer. */
        const releaseTurn = () => {
          if (speakSafetyTimerRef.current) { clearTimeout(speakSafetyTimerRef.current); speakSafetyTimerRef.current = null; }
          aiBusyRef.current = false;
          if (liveChatRef.current) {
            // 1500 ms block — generous enough to outlast speaker echo (incl.
            // cross-script transliteration of the AI's own English speech) so the
            // mic can't capture the AI's voice and feed it back as a "user" turn.
            lastAiSpeechEndRef.current = Date.now();
            speechRef.current.blockFor(1500);
            setConvFlowState("user-speaking");
          } else {
            setConvFlowState("idle");
          }
        };

        if (response) {
          // Strip any "TeacherName: " prefix the AI may echo, plus markdown
          const cleanResponse = stripMarkdownForSpeech(response)
            .replace(/^[A-Za-zÀ-ÿ'\s]{2,30}:\s*/, "")
            .trim();
          setConvHistory(h => [...h, { role: "ai", text: cleanResponse }]);
          track("English Guru", "Live Conversation");
          setConvFlowState("ai-speaking");
          // Safety timer: if TTS onEnd never fires (Edge TTS failure, audio context suspend, etc.)
          // force-release the busy lock after a generous timeout so the mic comes back.
          const safetyMs = Math.max(cleanResponse.length * 60 + 4_000, 10_000);
          speakSafetyTimerRef.current = setTimeout(releaseTurn, safetyMs);
          // Voice the reply in English by default — the AI is instructed to speak
          // MOSTLY English here, so a native neural voice (e.g. Malayalam) reading
          // English text was the "teacher isn't speaking English" bug. Only switch
          // to the native voice when the reply is predominantly native script (a
          // heavier "help" moment), so that gloss is still pronounced correctly.
          // Use speakRef so we always call the latest speak closure even though
          // handleConvPhrase no longer has `speak` in its deps.
          const speechLang = uiLang === "English"
            ? "English"
            : ((cleanResponse.match(/[\u0900-\u0D7F\u0600-\u06FF]/g)?.length ?? 0)
                > (cleanResponse.match(/[A-Za-z]/g)?.length ?? 0) ? uiLang : "English");
          lastAiSpeechRef.current = cleanResponse;
          speakRef.current(cleanResponse, speechLang, releaseTurn);
        } else {
          releaseTurn();
        }
      } catch {
        // Never leave the busy flag latched on an unexpected failure, or all
        // future turns (live and typed) would be silently blocked.
        aiBusyRef.current = false;
        setConvFlowState(liveChatRef.current ? "user-speaking" : "idle");
      }
    })();
  // `speech` and `speak` intentionally removed from deps — accessed via
  // speechRef/speakRef so the callback isn't re-created on every render.
  // `level` and `uiLang` ARE deps so a filter change is picked up on the very
  // next turn (handleConvPhraseRef is refreshed by the effect below).
  }, [stream, resetAI, track, isStreaming, profile.name, tutor.teachingStyle, uiLang, level, teacherShort]);

  useEffect(() => { handleConvPhraseRef.current = handleConvPhrase; }, [handleConvPhrase]);

  // Continuity watchdog: browsers occasionally kill the SpeechRecognition loop
  // (transient errors, tab backgrounding, OS mic hiccups), which would make the
  // teacher stop answering after a reply. While live chat is on and the AI isn't
  // mid-turn, re-kick the loop every few seconds. startContinuous() is now
  // idempotent — if a recognizer is already spawning or listening it's a no-op
  // (guarded by recognitionActiveRef); if the loop actually died, it respawns.
  // This is what guarantees the conversation keeps going until the user ends it.
  useEffect(() => {
    if (!liveChat) return;
    const id = setInterval(() => {
      if (!liveChatRef.current || aiBusyRef.current) return;
      speechRef.current.startContinuous(p => handleConvPhraseRef.current?.(p));
    }, 4000);
    return () => clearInterval(id);
  }, [liveChat]);

  const toggleLiveChat = useCallback(async () => {
    // Unlock browser autoplay policy synchronously within the user-gesture stack.
    // Must run before any await so Chrome still considers this a gesture-initiated play.
    unlockAudio();
    if (liveChat) {
      setLiveChat(false);
      setConvFlowState("idle");
      speech.stop();
      synth.stop();
      // synth.stop() does not fire the speak() onEnd callback, so clear the
      // busy flag here or the next session's first turn would be blocked.
      aiBusyRef.current = false;
      if (speakSafetyTimerRef.current) { clearTimeout(speakSafetyTimerRef.current); speakSafetyTimerRef.current = null; }
      silenceProbeCountRef.current = 0;
      return;
    }
    // Don't decide guest vs. paid until auth has resolved — otherwise a signed-in
    // user could slip onto the free path before /api/auth/me returns.
    if (authLoading) {
      toast({ title: "One moment…", description: "Checking your account — please try again in a second." });
      return;
    }
    // Guests get a free 15-minute trial (no signup); signed-in users spend credits (5/hour).
    if (!user) {
      if (guestLiveSecondsLeft() <= 0) {
        toast({ title: "Free trial finished", description: "That's your 15 free minutes. Sign in to get 20 free credits and keep chatting.", variant: "destructive" });
        return;
      }
    } else {
      const charge = await startLiveBlock();
      if (!charge.ok) {
        if (charge.status === 402) {
          toast({ title: "Not enough credits", description: "Live conversation uses 5 credits/hour. Top up to continue.", variant: "destructive" });
        } else {
          toast({ title: "Couldn't start live chat", description: charge.error ?? "Please try again.", variant: "destructive" });
        }
        return;
      }
    }
    setLiveChat(true);
    setConvFlowState("user-speaking");
    // Use ref so the callback always calls the latest handleConvPhrase even
    // after its deps (e.g. isStreaming) change — avoids stale closures.
    speech.startContinuous(p => handleConvPhraseRef.current?.(p));
  }, [liveChat, speech, synth, user, authLoading, toast]);

  // Keep a live reference to the "stop everything" action for the metering timer.
  const stopLiveRef = useRef<() => void>(() => {});
  useEffect(() => {
    stopLiveRef.current = () => {
      setLiveChat(false);
      setConvFlowState("idle");
      speech.stop();
      synth.stop();
      aiBusyRef.current = false;
    };
  }, [speech, synth]);

  // Meter live conversation: signed-in users spend 1 credit per 12-min block;
  // guests burn down a free 15-minute trial. Both end gracefully when exhausted.
  useEffect(() => {
    if (!liveChat) return;
    if (user) {
      const id = setInterval(async () => {
        const r = await tickLiveBlock();
        if (!r.ok && r.status === 402) {
          stopLiveRef.current();
          toast({ title: "Credits used up", description: "Your live conversation ended. Top up to keep chatting.", variant: "destructive" });
        }
      }, LIVE_BLOCK_SECONDS * 1000);
      return () => clearInterval(id);
    }
    // Guest trial: tick down the free 15 minutes locally.
    const GUEST_TICK = 10; // seconds
    const id = setInterval(() => {
      addGuestLiveSeconds(GUEST_TICK);
      if (guestLiveSecondsLeft() <= 0) {
        stopLiveRef.current();
        toast({ title: "Free trial finished 🎉", description: "That's your 15 free minutes. Sign in to get 20 free credits and keep going.", variant: "destructive" });
      }
    }, GUEST_TICK * 1000);
    return () => clearInterval(id);
  }, [liveChat, user, toast]);

  const handleConvSend = useCallback(async () => {
    const userMsg = convInput.trim();
    if (!userMsg) return;
    setConvInput("");
    await handleConvPhrase(userMsg);
  }, [convInput, handleConvPhrase]);

  return (
    <div className="min-h-full lg:h-full lg:flex lg:flex-col lg:overflow-hidden container mx-auto px-3 sm:px-4 pt-1 pb-2 max-w-6xl">
      {showTutorPicker && (
        <TutorSelector currentId={tutorId} onSelect={handleSelectTutor} onClose={() => setShowTutorPicker(false)} />
      )}

      <div className="grid gap-3 lg:grid-cols-[280px_1fr] lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        {/* Sidebar */}
        <aside className="order-2 lg:order-1 space-y-2 lg:flex lg:flex-col lg:overflow-y-auto lg:min-h-0">
          {/* Change Teacher — top of page CTA */}
          <Button
            variant="default"
            className="w-full font-semibold rounded-xl h-9"
            onClick={() => setShowTutorPicker(true)}
          >
            <Users className="w-4 h-4 mr-2" />Change Teacher
          </Button>

          {/* Student Name */}
          <Card className="border shadow-sm">
            <CardContent className="pt-2 pb-2 space-y-2">
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Student Name</span>
                <Input
                  value={profile.name}
                  onChange={(e) => updateProfile({ name: e.target.value })}
                  placeholder={user?.name ?? "Your name"}
                  className="h-8 text-sm"
                />
              </label>
            </CardContent>
          </Card>

          {/* Desktop avatar card */}
          <div className="hidden lg:flex flex-col items-center py-3 px-3 bg-card rounded-2xl border shadow-sm">
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
            {liveChat && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600 font-semibold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Live ON
              </div>
            )}
          </div>

          {/* Mobile avatar bar — hidden; portrait is now at the top of main content */}
          <div className="hidden items-center gap-3 p-3 bg-card rounded-xl border shadow-sm">
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
              {liveChat && <div className="text-xs text-green-600 font-semibold mt-0.5 animate-pulse">● Live</div>}
            </div>
            <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => setShowTutorPicker(true)}>
              <Users className="w-3.5 h-3.5" />
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <main className="order-1 lg:order-2 min-w-0 lg:flex lg:flex-col lg:min-h-0 lg:overflow-y-auto max-lg:overflow-y-auto max-lg:min-h-0">
          {/* ── MOBILE HERO — Change Teacher at top, then student greeting + tutor ── */}
          <div className="lg:hidden flex flex-col shrink-0 mb-2 gap-1.5">
            <Button
              variant="default"
              className="w-full font-semibold rounded-xl h-9"
              onClick={() => setShowTutorPicker(true)}
            >
              <Users className="w-4 h-4 mr-2" />Change Teacher
            </Button>
            <div className="flex items-center gap-2 py-2 px-3 bg-card rounded-2xl border shadow-sm">
              <AnimatedAvatar
                name={tutor.name}
                subtitle={tutor.role}
                isSpeaking={synth.isSpeaking}
                isThinking={isStreaming}
                gender={tutor.gender}
                size="sm"
                imageSrc={tutor.imageSrc}
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-secondary leading-tight">{profile.name || user?.name ? `Hi, ${profile.name || user?.name} 👋` : "Hi there 👋"}</p>
                <p className="text-xs text-muted-foreground italic leading-snug line-clamp-2 mt-0.5">"{tutor.intro}"</p>
                {liveChat && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-semibold animate-pulse mt-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Live ON
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── STICKY PROFILE BAR — always visible at top without scrolling ── */}
          <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 py-1 mb-2 bg-background/95 backdrop-blur-sm border-b flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-secondary truncate">{profile.name || user?.name || "Guest"}</span>
            <span className="text-muted-foreground/40">•</span>
            <span className="text-xs font-medium text-muted-foreground">Native language</span>
            <Select value={uiLang} onValueChange={(v) => {
              if (v === uiLang) return;
              setUiLang(v);
              updateProfile({ preferredLanguage: v });
              // Live chat: DON'T interrupt the conversation. The new language reaches
              // the AI on its next turn (uiLang is a handleConvPhrase dep) and the
              // recognizer reads it on its next spawn (langCodeRef) — so continuity is
              // never broken and the change applies right away. If it's the student's
              // turn, softly restart the mic so their next words are recognised in the
              // new language immediately; the loop stays alive (pause()+blockFor keep
              // shouldContinue true). Never touch the mic while the AI is mid-turn
              // (aiBusyRef) or it would capture the coach's own voice as input.
              if (liveChatRef.current && !aiBusyRef.current) {
                speech.pause();
                speech.blockFor(150);
              }
            }}>
              <SelectTrigger className="h-7 text-xs w-[120px] rounded-full border-dashed" aria-label="Native language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">🇬🇧 English</SelectItem>
                <SelectItem value="Hindi">🇮🇳 Hindi</SelectItem>
                {INDIAN_LANGUAGES.filter(l => l !== "Hindi").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={(v) => {
              if (v === level) return;
              setLevel(v);
              updateProfile({ englishLevel: v });
              // Applies to the AI's next turn immediately (level is a handleConvPhrase
              // dep, so handleConvPhraseRef is refreshed). The live session is left
              // completely untouched — no stop, no abort — so continuity is preserved.
            }}>
              <SelectTrigger className="h-7 text-xs w-[110px] rounded-full border-dashed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Beginner", "Intermediate", "Advanced"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            {liveChat && (
              <span className="ml-auto text-xs text-green-600 font-semibold animate-pulse flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Live
              </span>
            )}
          </div>

          {/* ── LIVE CONVERSATION — top section with its own heading ── */}
          <section className="flex flex-col min-h-0 flex-1">
            <Card className={`flex flex-col overflow-hidden border-2 transition-all flex-1 min-h-0 max-h-[calc(100dvh-6rem)] lg:max-h-none ${liveChat ? "border-green-400 bg-green-50/30" : "border-green-200/70 bg-green-50/10"}`}>
            <CardContent className="pt-3 pb-3 space-y-2 flex min-h-0 flex-1 flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 bg-green-100 text-green-700 rounded-lg flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-secondary">Live Conversation</h2>
                    <p className="text-xs text-muted-foreground">{uiLang === "English" ? "Speak in English — I reply naturally" : `Speak in English or ${uiLang} — I'll help in ${uiLang} when you're stuck`}</p>
                  </div>
                </div>
                <Button
                  onClick={toggleLiveChat}
                  variant={liveChat ? "destructive" : "default"}
                  size="sm"
                  className={`font-bold shrink-0 w-full sm:w-auto ${liveChat ? "" : "bg-green-600 hover:bg-green-700"}`}
                  disabled={!speech.isSupported}>
                  {liveChat ? <><StopCircle className="w-4 h-4 mr-1.5" />End</> : <><Mic className="w-4 h-4 mr-1.5" />Live</>}
                </Button>
              </div>
              {!liveChat && (
                <p className="text-xs text-muted-foreground">
                  {user ? (
                    <>Uses <span className="font-semibold text-secondary">5 credits/hour</span> · Balance: <span className="font-semibold text-secondary">{balance ?? "…"}</span> · <Link href="/credits" className="text-primary font-semibold hover:underline">Top up</Link></>
                  ) : guestLiveLeft > 0 ? (
                    <><span className="font-semibold text-green-700">{Math.ceil(guestLiveLeft / 60)} min</span> free trial left — no signup needed · <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link> for 20 free credits</>
                  ) : (
                    <>Free trial used up · <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link> to get 20 free credits and keep chatting</>
                  )}
                </p>
              )}
              {liveChat && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${convFlowState === "user-speaking" ? "bg-green-50 text-green-700 border border-green-200" : convFlowState === "ai-thinking" || convFlowState === "ai-speaking" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-muted text-muted-foreground"}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${convFlowState === "user-speaking" ? "bg-green-500 animate-pulse" : convFlowState === "ai-thinking" ? "bg-yellow-500 animate-pulse" : convFlowState === "ai-speaking" ? "bg-blue-500 animate-pulse" : "bg-muted-foreground"}`} />
                  {convFlowState === "user-speaking" && (speech.interimTranscript ? `"${speech.interimTranscript}"` : "Listening for you...")}
                  {convFlowState === "ai-thinking" && `${tutor.name} is thinking...`}
                  {convFlowState === "ai-speaking" && `${tutor.name} is speaking... (mic restarts when done)`}
                  {convFlowState === "idle" && "Live chat off"}
                </div>
              )}
              {liveChat && aiError && (
                <div className="mx-1 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  {aiError} — tap mic to try again
                </div>
              )}
              {(convHistory.length > 0 || isStreaming || (liveChat && !!speech.interimTranscript)) && (
                <div ref={convScrollRef} className="flex flex-col gap-3 flex-1 min-h-[260px] lg:min-h-0 overflow-y-auto pr-1 pt-1">
                  {liveChat && speech.interimTranscript && (
                    <div className="flex gap-2 justify-end">
                      <div className="max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words bg-primary/60 text-primary-foreground italic">
                        {speech.interimTranscript}
                        <span className="inline-block w-0.5 h-3.5 ml-0.5 align-middle bg-primary-foreground/80 animate-pulse" />
                      </div>
                    </div>
                  )}
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
                    placeholder={uiLang === "English" ? "Type in English, or press mic to speak..." : `Type in English or ${uiLang}, or press mic to speak...`}
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
          </section>

        </main>
      </div>
    </div>
  );
}
