import { Router, type Response } from "express";
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
    // Strip AI role-label prefixes — "TeacherName: " or "Ack:" / "Next:" at line start
    .replace(/^[A-Za-zÀ-ÿ'\s]{2,30}:\s*/m, "")
    .replace(/\bAck:\s*/gi, "")
    .replace(/\bNext:\s*/gi, "")
    // Strip markdown action/emote words in asterisks — *smiles warmly*, *chuckles*, etc.
    .replace(/\*[^*]{1,40}\*/g, "")
    // Strip markdown bold (**text**) and italic (*text* or _text_)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Strip markdown headers — ## Heading → Heading
    .replace(/^#{1,6}\s+/gm, "")
    // Strip parenthetical stage directions — (smiles), (pause), (laughs)
    .replace(/\([^)]{1,30}\)/g, "")
    // Strip leading/trailing quote marks the model sometimes wraps around output
    .replace(/^\s*["'"]/m, "")
    .replace(/["'"]\s*$/m, "")
    // Collapse extra whitespace
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Indic (Devanagari … Malayalam) + Arabic (Urdu) script char counts.
// Used to decide which voice dominates a mixed-script reply.
const NATIVE_SCRIPT_G = /[\u0900-\u0D7F\u0600-\u06FF]/g;
const LATIN_G = /[A-Za-z]/g;

/** Stream a single voice straight to the response (default, low-latency path). */
async function streamVoice(res: Response, voiceName: string, text: string): Promise<void> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  audioStream.pipe(res);
  audioStream.on("error", () => {
    if (!res.headersSent) res.status(500).json({ error: "TTS stream error" });
    else res.end();
  });
}

router.post("/tts", async (req, res) => {
  const {
    text,
    language = "English",
    gender = "female",
    voiceStyle,
    nativeLanguage,
  } = req.body as {
    text?: string;
    language?: string;
    gender?: "male" | "female";
    voiceStyle?: string;
    nativeLanguage?: string;
  };

  if (!text?.trim()) {
    res.status(400).json({ error: "Missing 'text' field" });
    return;
  }
  // Cap input length — Edge TTS handles ~3000 chars reliably; reject oversized payloads
  if (text.trim().length > 3000) {
    res.status(400).json({ error: "Text too long (max 3000 characters)" });
    return;
  }

  // cleanForTTS strips role-label echoes / stage directions; the neural voices
  // pause naturally at punctuation.
  const cleaned = cleanForTTS(text.trim());
  if (!cleaned) {
    res.status(400).json({ error: "No speakable text" });
    return;
  }

  // Voice for English/Latin runs: the tutor's English neural voice when a
  // voiceStyle is given, else the gender-appropriate en-IN voice.
  const englishVoice =
    (voiceStyle ? TUTOR_VOICE_MAP[voiceStyle] : undefined) ??
    (gender === "male" ? EDGE_VOICES["English"]!.male : EDGE_VOICES["English"]!.female);

  // Voice for native-script runs: only when a real, supported native language is
  // supplied (absent for greetings / Interview Ace / English-only mode).
  const nativeVoices =
    nativeLanguage && nativeLanguage !== "English" ? EDGE_VOICES[nativeLanguage] : undefined;
  const nativeVoice = nativeVoices
    ? (gender === "male" ? nativeVoices.male : nativeVoices.female)
    : undefined;

  try {
    if (nativeVoice) {
      // ── Single-voice selection ────────────────────────────────────────────
      // Per-character segment stitching (previous approach) rendered each
      // script-boundary fragment — often just 1–3 words — without surrounding
      // sentence context.  Each clip therefore had its own prosodic ramp,
      // causing a mechanical, "robotic" quality on concatenation.
      //
      // Microsoft's Indian Neural voices are trained on code-switched data and
      // pronounce English words naturally in an Indian accent, so one voice
      // reading the full sentence always sounds more natural than two voices
      // stitched at character boundaries.
      //
      // Choice rule:  native-script chars ≥ 25 % of total script chars
      //               → native voice  (handles English code-switches naturally)
      //               < 25 %          → tutor English voice (mostly English reply)
      const nativeCount = cleaned.match(NATIVE_SCRIPT_G)?.length ?? 0;
      const latinCount  = cleaned.match(LATIN_G)?.length ?? 0;
      const totalScript = nativeCount + latinCount;
      const useNative   = totalScript > 0 && nativeCount / totalScript >= 0.25;
      await streamVoice(res, useNative ? nativeVoice : englishVoice, cleaned);
      return;
    }

    // ── Default single-voice path (unchanged behaviour) ────────────────────
    const langVoices = EDGE_VOICES[language] ?? EDGE_VOICES["English"]!;
    const tutorVoice = language === "English" && voiceStyle ? TUTOR_VOICE_MAP[voiceStyle] : undefined;
    const primaryVoice = tutorVoice ?? (gender === "male" ? langVoices.male : langVoices.female);
    await streamVoice(res, primaryVoice, cleaned);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: String(err) });
    } else {
      res.end();
    }
  }
});

// Return the list of supported languages
router.get("/tts/voices", (_req, res) => {
  res.json(Object.keys(EDGE_VOICES));
});

export default router;
