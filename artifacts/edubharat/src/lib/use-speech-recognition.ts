import { useState, useRef, useCallback, useEffect } from "react";

export type SpeechRecognitionStatus = "idle" | "listening" | "processing" | "error";

// Browser Speech Recognition type shim
type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null;
};

type AnyWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

const LANG_MAP: Record<string, string> = {
  Hindi: "hi-IN", Bengali: "bn-IN", Tamil: "ta-IN", Telugu: "te-IN",
  Marathi: "mr-IN", Gujarati: "gu-IN", Kannada: "kn-IN", Malayalam: "ml-IN",
  Punjabi: "pa-IN", Odia: "or-IN", Assamese: "as-IN", Urdu: "ur-IN", English: "en-IN",
};

/**
 * If a recognizer has claimed the active slot but shown no lifecycle event
 * (onstart/onresult) for this long, treat it as a zombie and force-respawn.
 * Must comfortably exceed the browser's own silence auto-end (~5-8s with
 * continuous=false) so a healthy but quiet recognizer is never killed early.
 */
const RECOGNITION_LEASE_MS = 15000;

export function useSpeechRecognition(language = "English") {
  const [status, setStatus] = useState<SpeechRecognitionStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef    = useRef<any>(null);
  const shouldContinueRef = useRef(false);
  const onPhraseRef       = useRef<((text: string) => void) | null>(null);

  /**
   * blockedUntilRef — epoch ms before which startContinuous must NOT spawn
   * a new recognition session. Set by blockFor() when AI is speaking to
   * prevent the mic from picking up the AI's own voice (echo/loopback).
   */
  const blockedUntilRef = useRef(0);

  /**
   * spawnRecognitionRef — points to the spawnRecognition function created
   * inside startContinuous. blockFor() uses this to schedule a direct
   * wakeup instead of waiting up to 250ms for the poll cycle.
   */
  const spawnRecognitionRef = useRef<(() => void) | null>(null);

  /**
   * wakeTimerRef — timer ID of the direct-wakeup scheduled by blockFor().
   * Stored so it can be cancelled when blockFor() is called again (avoids
   * stacking multiple direct wakeups) and on stop()/pause().
   */
  const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * recognitionActiveRef — true from just before spawnRecognition calls
   * .start() until that instance fully ends (onend) or errors. It stays true
   * for the ENTIRE listening period, NOT just the brief start→onstart window.
   * This single guard stops the two spawn triggers — the 250ms poll loop and
   * blockFor()'s direct wakeup — from ever creating two overlapping recognizer
   * instances (which abort each other and silently kill the mic after a turn
   * or two). It also makes startContinuous() itself an idempotent no-op while a
   * recognizer is live, so the continuity watchdog can re-kick it freely.
   */
  const recognitionActiveRef = useRef(false);

  /**
   * recognitionGenRef — monotonically increasing token identifying the CURRENT
   * recognizer instance. Each spawn increments it; every callback captures its
   * own value and bails if it no longer matches. A non-matching callback is
   * stale — it belongs to an instance we already stopped (e.g. a late onend
   * from the recognizer pause() just stopped) and must NOT mutate shared state
   * or schedule a respawn, or it would clobber the live instance and spawn a
   * second overlapping one right after a pause()/blockFor() turn.
   */
  const recognitionGenRef = useRef(0);

  /**
   * recognitionActivityRef — epoch ms of the last sign of life from the active
   * recognizer (spawn claim, onstart, or onresult). Used as a lease: if a
   * recognizer holds the slot but shows no lifecycle event for longer than
   * RECOGNITION_LEASE_MS, it is a zombie (onstart fired but onend/onerror never
   * did — OS/tab suspension) and is force-recovered on the next spawn attempt.
   * Without this, a zombie pins recognitionActiveRef true forever and the
   * conversation goes silent with no way to self-heal.
   */
  const recognitionActivityRef = useRef(0);

  const langCode = LANG_MAP[language] ?? "en-IN";
  // Keep a ref so that spawnRecognition always reads the *current* language,
  // even inside a closure that was created before uiLang changed.
  const langCodeRef = useRef(langCode);
  useEffect(() => { langCodeRef.current = langCode; }, [langCode]);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const createRecognitionInstance = useCallback(() => {
    if (!isSupported) return null;
    const w = window as AnyWindow;
    const SpeechAPI = w.webkitSpeechRecognition ?? w.SpeechRecognition;
    if (!SpeechAPI) return null;
    return new SpeechAPI();
  }, [isSupported]);

  /**
   * blockFor — prevents the continuous recognition loop from spawning
   * for at least `ms` milliseconds.  Call this in the TTS onEnd callback
   * to add a post-speech silence window so the mic doesn't pick up
   * room echo of the AI's voice.
   *
   * For short blocks (≤ 1500ms) a direct setTimeout wakeup is scheduled
   * so the mic restarts ~60ms after the block expires — without waiting
   * up to 250ms for the poll cycle.  Cuts post-TTS dead-mic time from
   * ~1200ms (800ms block + 250ms poll + API startup) to ~360ms
   * (300ms block + 60ms padding + API startup).
   *
   * Only one direct-wakeup timer is active at a time; blockFor() cancels
   * any previous pending timer before scheduling a new one.
   */
  const blockFor = useCallback((ms: number) => {
    blockedUntilRef.current = Date.now() + ms;

    // Cancel any pending direct-wakeup timer (prevents stacking)
    if (wakeTimerRef.current !== null) {
      clearTimeout(wakeTimerRef.current);
      wakeTimerRef.current = null;
    }

    if (ms > 0 && ms <= 1500 && shouldContinueRef.current) {
      wakeTimerRef.current = setTimeout(() => {
        wakeTimerRef.current = null;
        // Only fire if: loop still running AND block has fully expired
        if (shouldContinueRef.current && Date.now() >= blockedUntilRef.current) {
          spawnRecognitionRef.current?.();
        }
      }, ms + 60); // 60ms padding for audio tail / jitter
    }
  }, []);

  /**
   * pause — immediately stops any active recognition AND blocks new
   * sessions for a long window. Call this the moment the AI STARTS
   * speaking so the mic can never pick up the AI's own voice (the root
   * cause of echo/self-repeat on phones and laptops with speakers).
   * Call blockFor(short) afterwards (in the TTS onEnd) to release.
   */
  const pause = useCallback(() => {
    // Cancel any pending wakeup — blockFor() after TTS will schedule a new one
    if (wakeTimerRef.current !== null) {
      clearTimeout(wakeTimerRef.current);
      wakeTimerRef.current = null;
    }
    recognitionActiveRef.current = false;
    blockedUntilRef.current = Date.now() + 10 * 60 * 1000; // effectively "until resumed"
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setStatus("idle");
    setInterimTranscript("");
  }, []);

  const start = useCallback(
    (onResult?: (text: string) => void) => {
      if (!isSupported) {
        setError("Speech recognition is not supported. Use Chrome or Edge.");
        setStatus("error");
        return;
      }
      // Never interrupt an active continuous session — the live chat loop would
      // be permanently killed because start() sets shouldContinueRef to false.
      if (shouldContinueRef.current) return;
      shouldContinueRef.current = false;
      const recognition = createRecognitionInstance();
      if (!recognition) return;

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = langCodeRef.current;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => { setStatus("listening"); setTranscript(""); setInterimTranscript(""); setError(null); };

      recognition.onresult = (event: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => {
        let interim = "", final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i]!;
          if (r.isFinal) final += r[0]!.transcript;
          else interim += r[0]!.transcript;
        }
        if (final) { setTranscript(p => p + final); onResult?.(final); }
        setInterimTranscript(interim);
      };

      recognition.onerror = (event: { error: string }) => {
        if (event.error !== "aborted") { setError(`Error: ${event.error}`); setStatus("error"); }
      };

      recognition.onend = () => { setStatus("idle"); setInterimTranscript(""); };

      recognitionRef.current = recognition;
      try { recognition.start(); } catch { /* already started */ }
    },
    [isSupported, langCode, createRecognitionInstance]
  );

  // Continuous mode: auto-restarts after each phrase until stop() is called.
  // Respects blockedUntilRef — will delay spawning if the AI was recently speaking.
  const startContinuous = useCallback(
    (onPhrase: (text: string) => void) => {
      if (!isSupported) {
        setError("Speech recognition is not supported. Use Chrome or Edge.");
        setStatus("error");
        return;
      }
      shouldContinueRef.current = true;
      onPhraseRef.current = onPhrase;

      const spawnRecognition = () => {
        // Expose to blockFor so direct wakeups call back into this closure
        spawnRecognitionRef.current = spawnRecognition;

        if (!shouldContinueRef.current) return;

        // Single-flight guard: if a recognition instance is already spawning OR
        // actively listening, skip — that instance's own onend continues the
        // loop. This is what lets the poll loop and blockFor()'s direct wakeup
        // fire together safely, and makes startContinuous() idempotent so the
        // continuity watchdog can re-kick it without spawning a competitor.
        if (recognitionActiveRef.current) {
          // Stale-active (zombie) breaker: the slot is claimed but the recognizer
          // has shown no lifecycle event for the whole lease window — onstart
          // fired yet onend/onerror never did (OS/tab suspension). Left alone it
          // pins the slot forever and silences the chat. Invalidate its callbacks
          // (bump the generation so its late events are ignored), stop the zombie,
          // release the slot, and fall through to spawn a fresh instance. The
          // continuity watchdog's periodic startContinuous() is what drives us
          // back here to perform this recovery.
          if (Date.now() - recognitionActivityRef.current < RECOGNITION_LEASE_MS) return;
          recognitionGenRef.current++;
          try { recognitionRef.current?.stop(); } catch { /* ignore */ }
          recognitionActiveRef.current = false;
        }

        // Honour the post-speech block window.
        // Poll at most every 250ms so a later SHORT blockFor() can release a
        // long pause() window without waiting minutes.
        const remaining = blockedUntilRef.current - Date.now();
        if (remaining > 0) {
          setTimeout(spawnRecognition, Math.min(remaining + 80, 250));
          return;
        }

        const recognition = createRecognitionInstance();
        if (!recognition) return;

        // Claim the slot for the whole spawn+listen lifetime and stamp this
        // instance with its own generation token. Every callback below checks
        // isCurrent() and bails if the token no longer matches — meaning the
        // instance was superseded (e.g. a late onend from a recognizer we
        // stopped in pause()), so it must not mutate shared state or respawn.
        const myGen = ++recognitionGenRef.current;
        const isCurrent = () => myGen === recognitionGenRef.current;
        recognitionActiveRef.current = true;
        recognitionActivityRef.current = Date.now(); // lease heartbeat

        recognition.continuous = false;
        recognition.interimResults = true;
        // Use ref so mid-session language changes are picked up on next spawn
        recognition.lang = langCodeRef.current;

        recognition.onstart = () => {
          if (!isCurrent()) return;
          recognitionActivityRef.current = Date.now(); // lease heartbeat
          // Do NOT clear recognitionActiveRef here — the instance is now LIVE and
          // must keep the slot claimed until onend/onerror, or a poll tick or a
          // blockFor() direct wakeup would spawn a SECOND overlapping recognizer.
          // Two recognizers abort each other and silently kill the mic after a
          // turn or two (the "AI stops responding after 2 questions" bug).
          setStatus("listening");
          setInterimTranscript("");
          setError(null);
        };

        recognition.onresult = (event: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => {
          if (!isCurrent()) return;
          recognitionActivityRef.current = Date.now(); // lease heartbeat
          let interim = "", final = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const r = event.results[i]!;
            if (r.isFinal) final += r[0]!.transcript;
            else interim += r[0]!.transcript;
          }
          if (final) {
            setTranscript(p => p + final);
            onPhraseRef.current?.(final.trim());
          }
          setInterimTranscript(interim);
        };

        recognition.onerror = (event: { error: string }) => {
          // A stale instance's error belongs to a recognizer we already replaced;
          // ignore it so it can't release the live instance's slot.
          if (!isCurrent()) return;
          recognitionActiveRef.current = false; // Release slot on error too
          if (event.error === "not-allowed") {
            shouldContinueRef.current = false;
            setError("Microphone permission denied.");
            setStatus("error");
          }
        };

        recognition.onend = () => {
          // Ignore a late onend from a superseded instance — releasing the slot or
          // rescheduling here would clobber the current recognizer and could spawn
          // a second overlapping one (the post-turn double-spawn vector).
          if (!isCurrent()) return;
          recognitionActiveRef.current = false; // Always release on end
          setInterimTranscript("");
          if (shouldContinueRef.current) {
            setTimeout(spawnRecognition, 120);
          } else {
            setStatus("idle");
          }
        };

        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {
          recognitionActiveRef.current = false; // Release if start() throws
          // start() threw before any event fired, so onend won't run to continue
          // the loop — reschedule here so a transient failure can't kill it.
          if (shouldContinueRef.current) setTimeout(spawnRecognition, 250);
        }
      };

      spawnRecognition();
    },
    [isSupported, langCode, createRecognitionInstance]
  );

  const stop = useCallback(() => {
    shouldContinueRef.current = false;
    onPhraseRef.current = null;
    if (wakeTimerRef.current !== null) {
      clearTimeout(wakeTimerRef.current);
      wakeTimerRef.current = null;
    }
    recognitionActiveRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    recognitionRef.current = null;
    setStatus("idle");
    setInterimTranscript("");
  }, []);

  const reset = useCallback(() => {
    stop();
    setTranscript("");
    setError(null);
  }, [stop]);

  // Stop recognition when the component using this hook unmounts. Without this,
  // navigating away from a live conversation or interview leaves the recognition
  // loop running in the background — it keeps holding the mic and can make a
  // second AI reply on the page you just left (the "two AIs at once" bug), and
  // it competes with the new page's recognizer, breaking multi-turn continuity.
  useEffect(() => stop, [stop]);

  return {
    status,
    transcript,
    interimTranscript,
    error,
    isSupported,
    isListening: status === "listening",
    isContinuous: shouldContinueRef.current,
    start,
    startContinuous,
    stop,
    reset,
    /** Block the mic for ms milliseconds — call in TTS onEnd to prevent echo pickup */
    blockFor,
    /** Stop the mic and block it until released — call when AI STARTS speaking */
    pause,
  };
}
