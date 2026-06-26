import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceGender = "male" | "female" | "auto";

export type SpeakOptions = {
  voiceGender?: VoiceGender;
  rate?: number;
  pitch?: number;
};

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
const FEMALE_VOICE_KEYWORDS = ["heera", "neerja", "priya", "veena", "ananya", "aarti", "aarthi", "lakshmi", "sita", "swathi", "shreya", "radha"];
const MALE_VOICE_KEYWORDS = ["ravi", "arjun", "rahul", "karan", "rohan", "mohan", "amit", "veer", "aditya", "sachin", "pranav"];

function pickEnglishVoice(voices: SpeechSynthesisVoice[], gender: VoiceGender): SpeechSynthesisVoice | undefined {
  const indian = voices.filter(v => v.lang.startsWith("en-IN") || v.lang.startsWith("en-"));

  const matchByGender = (keywords: string[]) =>
    indian.find(v => keywords.some(k => v.name.toLowerCase().includes(k)));

  if (gender === "female") {
    return matchByGender(FEMALE_VOICE_KEYWORDS)
      ?? indian.find(v => v.lang === "en-IN")
      ?? indian.find(v => v.lang.startsWith("en-IN"))
      ?? indian.find(v => v.lang === "en-GB")
      ?? indian[0];
  }

  if (gender === "male") {
    return matchByGender(MALE_VOICE_KEYWORDS)
      ?? indian.find(v => v.lang === "en-IN")
      ?? indian.find(v => v.lang.startsWith("en-IN"))
      ?? indian.find(v => v.lang === "en-GB")
      ?? indian[0];
  }

  // Auto mode: prefer known Indian English voices by name, then locale.
  const namedIndian = indian.find(v =>
    INDIAN_ENGLISH_KEYWORDS.some(k => v.name.toLowerCase().includes(k))
  );
  if (namedIndian) return namedIndian;

  return indian.find(v => v.lang === "en-IN")
    ?? indian.find(v => v.lang.startsWith("en-IN"))
    ?? indian.find(v => v.lang === "en-GB")
    ?? indian[0];
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  language: string,
  gender: VoiceGender = "auto",
): SpeechSynthesisVoice | undefined {
  const codes = LANG_CODES[language] ?? LANG_CODES["English"]!;

  if (language === "English") {
    return pickEnglishVoice(voices, gender);
  }

  // For Indian languages: exact code match first
  for (const code of codes) {
    const exact = voices.filter(v => v.lang === code);
    if (exact.length > 0) {
      if (gender === "female") {
        const female = exact.find(v => FEMALE_VOICE_KEYWORDS.some(k => v.name.toLowerCase().includes(k)));
        if (female) return female;
      }
      if (gender === "male") {
        const male = exact.find(v => MALE_VOICE_KEYWORDS.some(k => v.name.toLowerCase().includes(k)));
        if (male) return male;
      }
      return exact[0];
    }
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
    async (text: string, language = "English", onEnd?: () => void, options: SpeakOptions = {}) => {
      if (!isSupported || !text.trim()) return;
      window.speechSynthesis.cancel();

      const voices = await getVoices();
      const utterance = new SpeechSynthesisUtterance(text);

      const voice = pickVoice(voices, language, options.voiceGender ?? "auto");
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = LANG_CODES[language]?.[0] ?? "en-IN";
      }

      // Indian English speech profile
      utterance.rate = options.rate ?? (language === "English" ? 0.9 : 0.92);
      utterance.pitch = options.pitch ?? (options.voiceGender === "male" ? 0.98 : 1.06);
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
