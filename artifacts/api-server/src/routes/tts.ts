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

// Indic (Devanagari … Malayalam) + Arabic (Urdu) script ranges — mirrors the
// native-script detection used on the client in english-guru.tsx.
const NATIVE_SCRIPT = /[\u0900-\u0D7F\u0600-\u06FF]/;
const NATIVE_SCRIPT_G = /[\u0900-\u0D7F\u0600-\u06FF]/g;
const LATIN = /[A-Za-z]/;
const LATIN_G = /[A-Za-z]/g;

/**
 * Split text into consecutive runs of native-script vs English/Latin so each run
 * can be spoken by its OWN neural voice. Neutral characters (spaces, digits,
 * punctuation) attach to the run in progress so we never fragment on them; every
 * returned segment therefore contains at least one real letter (a wholly-neutral
 * input yields a single non-native segment).
 */
function segmentByScript(text: string): Array<{ text: string; native: boolean }> {
  const segments: Array<{ text: string; native: boolean }> = [];
  let curNative: boolean | null = null;
  let buf = "";
  for (const ch of text) {
    const isNative = NATIVE_SCRIPT.test(ch);
    const isLatin = LATIN.test(ch);
    if (!isNative && !isLatin) {
      buf += ch; // neutral — keep it with whatever run we're building
      continue;
    }
    if (curNative === null) {
      curNative = isNative;
      buf += ch;
    } else if (isNative === curNative) {
      buf += ch;
    } else {
      segments.push({ text: buf, native: curNative });
      buf = ch;
      curNative = isNative;
    }
  }
  if (buf.trim()) segments.push({ text: buf, native: curNative ?? false });
  return segments;
}

/** Synthesize one voice+text to a COMPLETE MP3 buffer, for stitching segments. */
async function synthToBuffer(voiceName: string, text: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);
  const chunks: Buffer[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    audioStream.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    audioStream.on("end", () => resolve(Buffer.concat(chunks)));
    audioStream.on("error", reject);
  });
}

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
      // ── Mixed-script path ────────────────────────────────────────────────
      // Split the reply into native-script and English runs and voice each with
      // its own neural voice, then stitch the MP3s into one continuous stream.
      // So "confident എന്നാൽ ആത്മവിശ്വാസം" says the English word in a natural
      // English voice and the meaning in a true Malayalam accent — instead of one
      // voice reading the other script like a robot. Every segment is the same
      // 24kHz / 48kbit / mono CBR MP3, so byte-concatenation plays back gaplessly.
      const segments = segmentByScript(cleaned);
      if (segments.length > 1 && segments.length <= 8) {
        const buffers = await Promise.all(
          segments.map((seg) =>
            synthToBuffer(seg.native ? nativeVoice : englishVoice, seg.text),
          ),
        );
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-store");
        res.end(Buffer.concat(buffers));
        return;
      }
      // One script only (or too many fragments to stitch cleanly): a single
      // voice, chosen by which script dominates the reply.
      const nativeCount = cleaned.match(NATIVE_SCRIPT_G)?.length ?? 0;
      const latinCount = cleaned.match(LATIN_G)?.length ?? 0;
      await streamVoice(res, nativeCount > latinCount ? nativeVoice : englishVoice, cleaned);
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
