import { Router } from "express";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const router = Router();

/**
 * Per-tutor voice overrides — each English Guru tutor gets a distinct accent.
 * Female tutors: all chosen for warmth/sweetness.
 * Male tutors: one Indian, one American, one British.
 * Keys match the `voiceStyle` field on TutorPersona in the frontend.
 */
const TUTOR_VOICE_MAP: Record<string, string> = {
  // Female tutors — distinct accents, all sweet/warm
  priya:  "en-IN-NeerjaNeural",       // Indian — warm, friendly
  meera:  "en-US-AriaNeural",         // American — professional & sweet (Maya Ma'am)
  neerja: "en-GB-SoniaNeural",        // British — clear & sweet (Neha Ma'am, pronunciation)

  // Male tutors — Indian / American / British
  rohit:  "en-IN-PrabhatNeural",      // Indian (Rohit Sir — corporate)
  arjun:  "en-US-ChristopherNeural",  // American (Arjun Sir — interview coach)
  rahul:  "en-GB-RyanNeural",         // British (Rahul Sir — grammar & writing)
};

// Microsoft Edge Neural voices for all 13 Indian languages + English
// Sourced from verified Microsoft voice list (all -Neural suffix voices)
const EDGE_VOICES: Record<string, { male: string; female: string }> = {
  English:   { male: "en-IN-PrabhatNeural",   female: "en-IN-NeerjaNeural" },
  Hindi:     { male: "hi-IN-MadhurNeural",    female: "hi-IN-SwaraNeural" },
  Tamil:     { male: "ta-IN-ValluvarNeural",  female: "ta-IN-PallaviNeural" },
  Telugu:    { male: "te-IN-MohanNeural",     female: "te-IN-ShrutiNeural" },
  Bengali:   { male: "bn-IN-BashkarNeural",   female: "bn-IN-TanishaaNeural" },
  Marathi:   { male: "mr-IN-ManoharNeural",   female: "mr-IN-AarohiNeural" },
  Gujarati:  { male: "gu-IN-NiranjanNeural",  female: "gu-IN-DhwaniNeural" },
  Kannada:   { male: "kn-IN-GaganNeural",     female: "kn-IN-SapnaNeural" },
  Malayalam: { male: "ml-IN-MidhunNeural",    female: "ml-IN-SobhanaNeural" },
  Urdu:      { male: "ur-IN-SalmanNeural",    female: "ur-IN-GulNeural" },
  Punjabi:   { male: "pa-IN-OjasNeural",      female: "pa-IN-VaaniNeural" },
  Odia:      { male: "or-IN-SukantNeural",    female: "or-IN-SubhasiniNeural" },
  Assamese:  { male: "as-IN-PriyomNeural",    female: "as-IN-YashicaNeural" },
};

/**
 * Strip AI role-label artifacts that sometimes leak into the spoken text.
 * e.g. "Priya Ma'am: Hello there!" → "Hello there!"
 *      "Ack: Right, I see."        → "Right, I see."
 * Also collapses multiple spaces.
 * Note: Edge TTS rejects SSML <break> tags when passed through toStream(),
 * so we rely solely on the neural voice's built-in punctuation-aware prosody.
 */
function cleanForTTS(text: string): string {
  return text
    .replace(/^[A-Za-zÀ-ÿ'\s]{2,30}:\s*/m, "")  // "TeacherName: " at start
    .replace(/\bAck:\s*/gi, "")
    .replace(/\bNext:\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

router.post("/tts", async (req, res) => {
  const {
    text,
    language = "English",
    gender = "female",
    voiceStyle,
  } = req.body as { text?: string; language?: string; gender?: "male" | "female"; voiceStyle?: string };

  if (!text?.trim()) {
    res.status(400).json({ error: "Missing 'text' field" });
    return;
  }
  // Cap input length — Edge TTS handles ~3000 chars reliably; reject oversized payloads
  if (text.trim().length > 3000) {
    res.status(400).json({ error: "Text too long (max 3000 characters)" });
    return;
  }

  // Use per-tutor voice when a voiceStyle is supplied; fall back to language-based selection.
  // For non-English languages, always use the language-native voice regardless of voiceStyle
  // (tutor voice overrides only apply when speaking English).
  const voices = EDGE_VOICES[language] ?? EDGE_VOICES["English"]!;
  const tutorVoice = language === "English" && voiceStyle ? TUTOR_VOICE_MAP[voiceStyle] : undefined;
  const voiceName = tutorVoice ?? (gender === "male" ? voices.male : voices.female);

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // cleanForTTS strips role-label echoes; toStream() uses Edge's built-in
    // neural prosody which already pauses naturally at punctuation.
    const cleaned = cleanForTTS(text.trim());
    const { audioStream } = tts.toStream(cleaned);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");

    audioStream.pipe(res);

    audioStream.on("error", () => {
      if (!res.headersSent) res.status(500).json({ error: "TTS stream error" });
      else res.end();
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: String(err) });
    }
  }
});

// Return the list of supported languages
router.get("/tts/voices", (_req, res) => {
  res.json(Object.keys(EDGE_VOICES));
});

export default router;
