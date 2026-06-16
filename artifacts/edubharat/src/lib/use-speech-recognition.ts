import { useState, useRef, useCallback } from "react";

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
  const recognitionRef = useRef<any>(null);
  const shouldContinueRef = useRef(false);
  const onPhraseRef = useRef<((text: string) => void) | null>(null);
  const langCode = LANG_MAP[language] ?? "en-IN";

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

  const start = useCallback(
    (onResult?: (text: string) => void) => {
      if (!isSupported) {
        setError("Speech recognition is not supported. Use Chrome or Edge.");
        setStatus("error");
        return;
      }
      shouldContinueRef.current = false;
      const recognition = createRecognitionInstance();
      if (!recognition) return;

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = langCode;
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

  // Continuous mode: auto-restarts after each phrase until stop() is called
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
        if (!shouldContinueRef.current) return;
        const recognition = createRecognitionInstance();
        if (!recognition) return;

        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = langCode;

        recognition.onstart = () => { setStatus("listening"); setInterimTranscript(""); setError(null); };

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
          if (event.error === "not-allowed") {
            shouldContinueRef.current = false;
            setError("Microphone permission denied.");
            setStatus("error");
          }
        };

        recognition.onend = () => {
          setInterimTranscript("");
          if (shouldContinueRef.current) {
            setTimeout(spawnRecognition, 200);
          } else {
            setStatus("idle");
          }
        };

        recognitionRef.current = recognition;
        try { recognition.start(); } catch { /* ignore */ }
      };

      spawnRecognition();
    },
    [isSupported, langCode, createRecognitionInstance]
  );

  const stop = useCallback(() => {
    shouldContinueRef.current = false;
    onPhraseRef.current = null;
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
  };
}
