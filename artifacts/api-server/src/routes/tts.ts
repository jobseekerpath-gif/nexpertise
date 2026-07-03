import { Router } from "express";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const router = Router();

// Microsoft Edge Neural voices for all 13 Indian languages + English
// Sourced from verified Microsoft voice list (all -Neural suffix voices)
const EDGE_VOICES: Record<string, { male: string; female: string; locale: string }> = {
  English:   { male: "en-IN-PrabhatNeural",   female: "en-IN-NeerjaNeural",    locale: "en-IN" },
  Hindi:     { male: "hi-IN-MadhurNeural",    female: "hi-IN-SwaraNeural",     locale: "hi-IN" },
  Tamil:     { male: "ta-IN-ValluvarNeural",  female: "ta-IN-PallaviNeural",   locale: "ta-IN" },
  Telugu:    { male: "te-IN-MohanNeural",     female: "te-IN-ShrutiNeural",    locale: "te-IN" },
  Bengali:   { male: "bn-IN-BashkarNeural",   female: "bn-IN-TanishaaNeural",  locale: "bn-IN" },
  Marathi:   { male: "mr-IN-ManoharNeural",   female: "mr-IN-AarohiNeural",    locale: "mr-IN" },
  Gujarati:  { male: "gu-IN-NiranjanNeural",  female: "gu-IN-DhwaniNeural",    locale: "gu-IN" },
  Kannada:   { male: "kn-IN-GaganNeural",     female: "kn-IN-SapnaNeural",     locale: "kn-IN" },
  Malayalam: { male: "ml-IN-MidhunNeural",    female: "ml-IN-SobhanaNeural",   locale: "ml-IN" },
  Urdu:      { male: "ur-IN-SalmanNeural",    female: "ur-IN-GulNeural",       locale: "ur-IN" },
  Punjabi:   { male: "pa-IN-OjasNeural",      female: "pa-IN-VaaniNeural",     locale: "pa-IN" },
  Odia:      { male: "or-IN-SukantNeural",    female: "or-IN-SubhasiniNeural", locale: "or-IN" },
  Assamese:  { male: "as-IN-PriyomNeural",    female: "as-IN-YashicaNeural",   locale: "as-IN" },
};

/**
 * Convert plain text to SSML with natural sentence pauses.
 * - Strips "Role: " label prefixes that AI sometimes echoes back
 * - Escapes XML special characters
 * - Adds <break> tags after sentence-ending punctuation for natural rhythm
 * - Uses a slightly slower prosody rate so speech feels conversational, not rushed
 */
function buildSSML(text: string, voiceName: string, locale: string): string {
  // Strip common role-label artifacts AI sometimes echoes ("Priya Ma'am:", "Ack:", "Next:")
  const stripped = text
    .replace(/^[A-Za-zÀ-ÿ'\s]{2,30}:\s*/m, "")   // "TeacherName: " at start
    .replace(/\bAck:\s*/gi, "")
    .replace(/\bNext:\s*/gi, "")
    .replace(/\(.*?\)/g, " ")                        // remove parenthetical asides that sound awkward when read
    .replace(/\s{2,}/g, " ")
    .trim();

  // Escape XML special characters
  const escaped = stripped
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  // Add natural pauses: long after sentence ends, short after commas/semi-colons
  const withBreaks = escaped
    .replace(/([.!?])\s+/g, '$1<break time="380ms"/> ')
    .replace(/([.!?])$/g, '$1<break time="380ms"/>')
    .replace(/([,;])\s+/g, '$1<break time="130ms"/> ')
    .replace(/\.\.\./g, '<break time="500ms"/>');

  // -6% rate = slightly slower than neural default, feels more human and less rushed
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${locale}">
  <voice name="${voiceName}">
    <prosody rate="-6%" pitch="0%">
      ${withBreaks}
    </prosody>
  </voice>
</speak>`;
}

router.post("/tts", async (req, res) => {
  const {
    text,
    language = "English",
    gender = "female",
  } = req.body as { text?: string; language?: string; gender?: "male" | "female" };

  if (!text?.trim()) {
    res.status(400).json({ error: "Missing 'text' field" });
    return;
  }
  // Cap input length — Edge TTS handles ~3000 chars reliably; reject oversized payloads
  if (text.trim().length > 3000) {
    res.status(400).json({ error: "Text too long (max 3000 characters)" });
    return;
  }

  const voices = EDGE_VOICES[language] ?? EDGE_VOICES["English"]!;
  const voiceName = gender === "male" ? voices.male : voices.female;
  const locale = voices.locale;

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // Use rawToStream with custom SSML so we can inject natural <break> pauses.
    // toStream() only accepts plain text; rawToStream() accepts full SSML.
    const ssml = buildSSML(text.trim(), voiceName, locale);
    const { audioStream } = tts.rawToStream(ssml);

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
