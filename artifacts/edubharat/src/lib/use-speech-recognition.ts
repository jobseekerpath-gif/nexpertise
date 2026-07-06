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
   * isSpawningRef — true from the moment spawnRecognition starts a new
   * recognition instance until onstart (success) or onerror fires.
   * Prevents the poll loop and a direct wakeup from both firing at nearly
   * the same time and creating two overlapping recognition sessions.
   */
  const isSpawningRef = useRef(false);

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
    isSpawningRef.current = false;
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

        // Single-flight guard: if we're already starting a recognition session
        // (between .start() and onstart/onerror), skip — the in-flight instance
        // will fire its callbacks and restart the loop itself.
        if (isSpawningRef.current) return;

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

        isSpawningRef.current = true; // Claim the in-flight slot

        recognition.continuous = false;
        recognition.interimResults = true;
        // Use ref so mid-session language changes are picked up on next spawn
        recognition.lang = langCodeRef.current;

        recognition.onstart = () => {
          isSpawningRef.current = false; // Instance is live — release the slot
          setStatus("listening");
          setInterimTranscript("");
          setError(null);
        };

        recognition.onresult = (event: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => {
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
          isSpawningRef.current = false; // Release slot on error too
          if (event.error === "not-allowed") {
            shouldContinueRef.current = false;
            setError("Microphone permission denied.");
            setStatus("error");
          }
        };

        recognition.onend = () => {
          isSpawningRef.current = false; // Always release on end
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
          isSpawningRef.current = false; // Release if start() throws
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
    isSpawningRef.current = false;
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
