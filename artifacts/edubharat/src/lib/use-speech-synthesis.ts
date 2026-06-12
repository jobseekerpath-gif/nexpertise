import { useState, useRef, useCallback, useEffect } from "react";

const LANG_CODES: Record<string, string[]> = {
  Hindi: ["hi-IN", "hi"],
  Bengali: ["bn-IN", "bn-BD", "bn"],
  Tamil: ["ta-IN", "ta-LK", "ta"],
  Telugu: ["te-IN", "te"],
  Marathi: ["mr-IN", "mr"],
  Gujarati: ["gu-IN", "gu"],
  Kannada: ["kn-IN", "kn"],
  Malayalam: ["ml-IN", "ml"],
  Punjabi: ["pa-IN", "pa-Guru", "pa"],
  Odia: ["or-IN", "or"],
  Assamese: ["as-IN", "as"],
  Urdu: ["ur-IN", "ur-PK", "ur"],
  English: ["en-IN", "en-GB", "en-US"],
};

const INDIAN_ENGLISH_KEYWORDS = ["heera", "ravi", "india", "neerja", "priya", "veena"];

function pickVoice(voices: SpeechSynthesisVoice[], language: string): SpeechSynthesisVoice | undefined {
  const codes = LANG_CODES[language] ?? LANG_CODES["English"]!;

  if (language === "English") {
    // Prefer known Indian English voices by name
    const namedIndian = voices.find(v =>
      INDIAN_ENGLISH_KEYWORDS.some(k => v.name.toLowerCase().includes(k))
    );
    if (namedIndian) return namedIndian;

    // Exact en-IN locale
    const exactIN = voices.find(v => v.lang === "en-IN");
    if (exactIN) return exactIN;

    // Any en-IN prefix
    const anyIN = voices.find(v => v.lang.startsWith("en-IN"));
    if (anyIN) return anyIN;

    // Fallback to en-GB (sounds less American)
    const gb = voices.find(v => v.lang === "en-GB");
    if (gb) return gb;
  }

  // For Indian languages: exact code match first
  for (const code of codes) {
    const exact = voices.find(v => v.lang === code);
    if (exact) return exact;
  }
  // Prefix match
  for (const code of codes) {
    const prefix = code.split("-")[0]!;
    const found = voices.find(v => v.lang.startsWith(prefix));
    if (found) return found;
  }
  return undefined;
}

async function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    const handler = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", handler, { once: true });
    // Fallback if event never fires
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
  });
}

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(
    typeof window !== "undefined" && "speechSynthesis" in window
  );
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Preload voices on mount
  useEffect(() => {
    if (isSupported) { void getVoices(); }
  }, [isSupported]);

  const speak = useCallback(
    async (text: string, language = "English", onEnd?: () => void) => {
      if (!isSupported || !text.trim()) return;
      window.speechSynthesis.cancel();

      const voices = await getVoices();
      const utterance = new SpeechSynthesisUtterance(text);

      const voice = pickVoice(voices, language);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = LANG_CODES[language]?.[0] ?? "en-IN";
      }

      // Indian English speech profile
      utterance.rate = 0.88;   // slightly slower — clearer for learners
      utterance.pitch = 1.05;  // natural pitch
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => { setIsSpeaking(false); onEnd?.(); };
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported]
  );

  const stop = useCallback(() => {
    if (isSupported) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
  }, [isSupported]);

  return { isSpeaking, isSupported, speak, stop };
}
