import { useState, useRef, useCallback } from "react";

export type SpeechRecognitionStatus = "idle" | "listening" | "processing" | "error";

const LANG_MAP: Record<string, string> = {
  Hindi: "hi-IN",
  Bengali: "bn-IN",
  Tamil: "ta-IN",
  Telugu: "te-IN",
  Marathi: "mr-IN",
  Gujarati: "gu-IN",
  Kannada: "kn-IN",
  Malayalam: "ml-IN",
  Punjabi: "pa-IN",
  Odia: "or-IN",
  Assamese: "as-IN",
  Urdu: "ur-IN",
  English: "en-IN",
};

export function useSpeechRecognition(language = "English") {
  const [status, setStatus] = useState<SpeechRecognitionStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(
    (onResult?: (text: string) => void) => {
      if (!isSupported) {
        setError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
        setStatus("error");
        return;
      }

      const SpeechRecognitionAPI =
        (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ??
        window.SpeechRecognition;

      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = LANG_MAP[language] ?? "en-IN";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setStatus("listening");
        setTranscript("");
        setInterimTranscript("");
        setError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        if (final) {
          setTranscript((prev) => prev + final);
          onResult?.(final);
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error !== "aborted") {
          setError(`Recognition error: ${event.error}`);
          setStatus("error");
        }
      };

      recognition.onend = () => {
        setStatus("idle");
        setInterimTranscript("");
      };

      recognitionRef.current = recognition;
      recognition.start();
    },
    [isSupported, language]
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    stop();
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, [stop]);

  return {
    status,
    transcript,
    interimTranscript,
    error,
    isSupported,
    isListening: status === "listening",
    start,
    stop,
    reset,
  };
}
