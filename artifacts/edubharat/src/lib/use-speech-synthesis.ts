import { useState, useRef, useCallback } from "react";

const LANG_VOICE_MAP: Record<string, string[]> = {
  Hindi: ["hi-IN", "hi"],
  Bengali: ["bn-IN", "bn"],
  Tamil: ["ta-IN", "ta"],
  Telugu: ["te-IN", "te"],
  Marathi: ["mr-IN", "mr"],
  Gujarati: ["gu-IN", "gu"],
  Kannada: ["kn-IN", "kn"],
  Malayalam: ["ml-IN", "ml"],
  Punjabi: ["pa-IN", "pa"],
  Odia: ["or-IN", "or"],
  Assamese: ["as-IN", "as"],
  Urdu: ["ur-PK", "ur"],
  English: ["en-IN", "en-GB", "en-US"],
};

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(
    typeof window !== "undefined" && "speechSynthesis" in window
  );
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(
    (text: string, language = "English", onEnd?: () => void) => {
      if (!isSupported) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const langCodes = LANG_VOICE_MAP[language] ?? LANG_VOICE_MAP["English"]!;
      const voices = window.speechSynthesis.getVoices();
      const matched = voices.find((v) =>
        langCodes.some((code) => v.lang.startsWith(code))
      );
      if (matched) utterance.voice = matched;
      utterance.lang = langCodes[0]!;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        onEnd?.();
      };
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported]
  );

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  return { isSpeaking, isSupported, speak, stop };
}
