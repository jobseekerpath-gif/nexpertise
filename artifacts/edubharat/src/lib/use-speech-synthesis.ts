import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceGender = "male" | "female" | "auto";

export type SpeakOptions = {
  voiceGender?: VoiceGender;
  voiceStyle?: string;
  rate?: number;
  pitch?: number;
};

const LANG_CODES: Record<string, string[]> = {
  Hindi:     ["hi-IN", "hi"],
  Bengali:   ["bn-IN", "bn-BD", "bn"],
  Tamil:     ["ta-IN", "ta-LK", "ta"],
  Telugu:    ["te-IN", "te"],
  Marathi:   ["mr-IN", "mr"],
  Gujarati:  ["gu-IN", "gu"],
  Kannada:   ["kn-IN", "kn"],
  Malayalam: ["ml-IN", "ml"],
  Punjabi:   ["pa-IN", "pa-Guru", "pa"],
  Odia:      ["or-IN", "or"],
  Assamese:  ["as-IN", "as"],
  Urdu:      ["ur-IN", "ur-PK", "ur"],
  English:   ["en-IN", "en-GB", "en-US"],
};

// Natural speech rates per language (how fast each language is typically spoken)
const LANG_RATE: Record<string, number> = {
  Hindi:     0.88,
  Bengali:   0.85,
  Tamil:     0.82,
  Telugu:    0.83,
  Marathi:   0.87,
  Gujarati:  0.86,
  Kannada:   0.83,
  Malayalam: 0.80,
  Punjabi:   0.90,
  Odia:      0.84,
  Assamese:  0.85,
  Urdu:      0.88,
  English:   0.86,
};

// Natural pitch adjustments per language
const LANG_PITCH: Record<string, { male: number; female: number }> = {
  Hindi:     { male: 0.90, female: 1.10 },
  Bengali:   { male: 0.88, female: 1.12 },
  Tamil:     { male: 0.85, female: 1.08 },
  Telugu:    { male: 0.87, female: 1.10 },
  Marathi:   { male: 0.90, female: 1.10 },
  Gujarati:  { male: 0.88, female: 1.08 },
  Kannada:   { male: 0.86, female: 1.08 },
  Malayalam: { male: 0.85, female: 1.06 },
  Punjabi:   { male: 0.92, female: 1.12 },
  Odia:      { male: 0.88, female: 1.08 },
  Assamese:  { male: 0.87, female: 1.08 },
  Urdu:      { male: 0.89, female: 1.10 },
  English:   { male: 0.92, female: 1.12 },
};

const FEMALE_VOICE_KEYWORDS = [
  "heera", "neerja", "priya", "veena", "ananya", "aarti", "aarthi",
  "lakshmi", "meera", "sita", "swathi", "shreya", "radha", "female", "woman",
  "zira", "hazel", "susan", "karen", "samantha", "victoria", "moira",
];
const MALE_VOICE_KEYWORDS = [
  "ravi", "rohit", "arjun", "rahul", "karan", "rohan", "mohan", "amit", "veer",
  "aditya", "sachin", "pranav", "male", "man", "daniel", "david",
  "george", "james", "mark", "tom", "fred", "alex",
];
const INDIAN_ENGLISH_KEYWORDS = [
  "heera", "ravi", "india", "neerja", "priya", "veena",
  "microsoft heera", "microsoft neerja", "microsoft ravi", "google indian",
];

const STYLE_KEYWORDS: Record<string, string[]> = {
  priya: ["priya", "heera", "neerja", "female", "woman"],
  neerja: ["neerja", "heera", "priya", "female", "woman"],
  meera: ["meera", "lakshmi", "aarti", "aarthi", "shreya", "sita"],
  rohit: ["rohit", "ravi", "arjun", "rahul", "karan", "male", "man"],
  arjun: ["arjun", "rohit", "ravi", "rahul", "karan", "male", "man"],
  rahul: ["rahul", "rohit", "ravi", "arjun", "karan", "male", "man"],
};

function genderMatch(v: SpeechSynthesisVoice, gender: VoiceGender): boolean {
  const n = v.name.toLowerCase();
  if (gender === "female") return FEMALE_VOICE_KEYWORDS.some(k => n.includes(k));
  if (gender === "male")   return MALE_VOICE_KEYWORDS.some(k => n.includes(k));
  return true;
}

function styleMatch(v: SpeechSynthesisVoice, style?: string): boolean {
  if (!style) return true;
  const keywords = STYLE_KEYWORDS[style];
  if (!keywords) return true;
  const n = v.name.toLowerCase();
  return keywords.some(k => n.includes(k));
}

function pickEnglishVoice(voices: SpeechSynthesisVoice[], gender: VoiceGender, style?: string): SpeechSynthesisVoice | undefined {
  const allEnglish = voices.filter(v => v.lang.startsWith("en-"));
  if (allEnglish.length === 0) return undefined;

  // Priority 1 — native-sounding English (en-GB / en-US / en-AU) with gender/style match.
  // These voices are usually higher quality and less "synthetic accent" than en-IN voices.
  const nativeEnglish = allEnglish.filter(v => /^en-(GB|US|AU|CA|IE|NZ|ZA)$/i.test(v.lang));
  const nativeStyle = nativeEnglish.filter(v => styleMatch(v, style) && genderMatch(v, gender));
  if (nativeStyle.length > 0) return nativeStyle[0];
  const nativeGender = nativeEnglish.filter(v => genderMatch(v, gender));
  if (nativeGender.length > 0) return nativeGender[0];
  if (nativeEnglish.length > 0) return nativeEnglish[0];

  // Priority 2 — any English voice matching gender keyword
  const genMatch = allEnglish.filter(v => styleMatch(v, style) && genderMatch(v, gender));
  if (genMatch.length > 0) return genMatch[0];
  const genFallback = allEnglish.filter(v => genderMatch(v, gender));
  if (genFallback.length > 0) return genFallback[0];

  // Priority 3 — en-GB as closest to a neutral Indian cadence without being synthetic
  return allEnglish.find(v => v.lang === "en-GB") ?? allEnglish[0];
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  language: string,
  gender: VoiceGender = "auto",
  style?: string,
): SpeechSynthesisVoice | undefined {
  if (language === "English") {
    return pickEnglishVoice(voices, gender, style);
  }

  const codes = LANG_CODES[language] ?? LANG_CODES["English"]!;

  // Step 1 — exact locale match
  for (const code of codes) {
    const pool = voices.filter(v => v.lang === code);
    if (pool.length === 0) continue;
    if (style) {
      const styleMatchVoice = pool.find(v => styleMatch(v, style) && (gender === "auto" || genderMatch(v, gender)));
      if (styleMatchVoice) return styleMatchVoice;
    }
    if (gender !== "auto") {
      const genMatch = pool.find(v => genderMatch(v, gender));
      if (genMatch) return genMatch;
    }
    return pool[0];
  }

  // Step 2 — prefix match (e.g. "hi" for "hi-IN")
  for (const code of codes) {
    const prefix = code.split("-")[0]!;
    const pool = voices.filter(v => v.lang.startsWith(prefix));
    if (pool.length === 0) continue;
    if (style) {
      const styleMatchVoice = pool.find(v => styleMatch(v, style) && (gender === "auto" || genderMatch(v, gender)));
      if (styleMatchVoice) return styleMatchVoice;
    }
    if (gender !== "auto") {
      const genMatch = pool.find(v => genderMatch(v, gender));
      if (genMatch) return genMatch;
    }
    return pool[0];
  }

  // Step 3 — fallback to Indian English (voice still carries Indian cadence)
  return pickEnglishVoice(voices, gender, style);
}

async function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    const handler = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", handler, { once: true });
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
  });
}

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(
    typeof window !== "undefined" && "speechSynthesis" in window
  );
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (isSupported) { void getVoices(); }
  }, [isSupported]);

  const speak = useCallback(
    async (text: string, language = "English", onEnd?: () => void, options: SpeakOptions = {}) => {
      if (!isSupported || !text.trim()) return;
      window.speechSynthesis.cancel();

      const voices = await getVoices();
      const utterance = new SpeechSynthesisUtterance(text);
      const genderOpt = options.voiceGender ?? "auto";

      const voice = pickVoice(voices, language, genderOpt, options.voiceStyle);
      if (voice) {
        utterance.voice = voice;
        // Use the voice's native lang when it's a native language voice,
        // otherwise force the target language code so the engine pronounces it correctly.
        const targetCode = LANG_CODES[language]?.[0] ?? "en-IN";
        utterance.lang = voice.lang.startsWith(targetCode.split("-")[0]!)
          ? voice.lang
          : targetCode;
      } else {
        utterance.lang = LANG_CODES[language]?.[0] ?? "en-IN";
      }

      // Per-language natural rate & pitch
      const langPitch = LANG_PITCH[language] ?? LANG_PITCH["English"]!;
      const baseRate = options.rate ?? (LANG_RATE[language] ?? 0.86);
      const basePitch = options.pitch ?? (
        genderOpt === "male"   ? langPitch.male :
        genderOpt === "female" ? langPitch.female :
        (langPitch.male + langPitch.female) / 2
      );

      // For English, use a slightly slower, lower pitch delivery to sound more natural and less robotic
      utterance.rate = language === "English" ? Math.min(baseRate, 0.82) : baseRate;
      utterance.pitch = language === "English" ? Math.min(basePitch, 1.0) : basePitch;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend   = () => { setIsSpeaking(false); onEnd?.(); };
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
