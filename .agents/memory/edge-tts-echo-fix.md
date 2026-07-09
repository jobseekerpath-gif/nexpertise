---
name: Edge TTS + Echo/Loopback fix
description: How EduBharat TTS works (Edge Neural voices via API) and how echo prevention is implemented
---

## TTS Architecture
- All AI speech in Live Conversation + Interview Ace routes through **`useEdgeTTS`** hook (`use-edge-tts.ts`)
- Hook POSTs to `/api/tts` (api-server) → msedge-tts streams audio/mpeg → played via `<Audio>` element
- Same `{ isSpeaking, isSupported, speak, stop }` interface as the old `useSpeechSynthesis`
- `useSpeechSynthesis` (browser Web Speech API) is still present but no longer used in those two pages

## Voice Mapping (from attached Python reference file)
All 13 Indian languages supported with male + female Microsoft Neural voices:
- English: en-IN-PrabhatNeural (M), en-IN-NeerjaNeural (F)
- Hindi: hi-IN-MadhurNeural (M), hi-IN-SwaraNeural (F)
- Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Urdu, Punjabi, Odia, Assamese — all in EDGE_VOICES map in `artifacts/api-server/src/routes/tts.ts`

## Echo/Loopback Prevention
Root cause: mic picks up AI voice from speakers (bad on laptop + mobile) because:
1. Recognition restarts too quickly after TTS ends
2. Room echo / reverb lingers beyond the audio stream end event

**Fix layers (current):**
1. `blockFor(ms)` in `useSpeechRecognition` — sets `blockedUntilRef = Date.now() + ms`; direct wakeup timer fires at `ms + 60ms` for blocks ≤ 3000ms
2. `spawnRecognition()` checks `blockedUntilRef`; polls every 250ms if blocked
3. `suppressResultsBeforeRef` — set to `Date.now() + 300` in every `onstart` (both `start()` and `startContinuous()`); `onresult` silently drops results that arrive before the suppress-until timestamp (prevents the engine from delivering audio it captured from the speaker before AGC/VAD calibrated)
4. English Guru `releaseGreeting` + `releaseTurn`: `blockFor(2500)` — 2.56s post-speech dead-mic for devices without hardware AEC (laptop/phone speakers)
5. Echo content guard in `handleConvPhrase`: 6000ms window (was 4500ms), no word-count cap (was ≤14 words), 0.85 overlap threshold

**Why 2500ms:** 1500ms was too short for laptop/phone speakers with no hardware AEC; room echo of a multi-sentence AI reply can linger 2-3s. Combined with 300ms warmup suppression, effective echo-free window is ~2.8s.

**Interview Ace:** still uses `blockFor(400)` for auto-listen retry (different purpose, Q&A format); not changed.

## Cross-script echo (native-language live chat)
English Guru keeps a NATIVE-language recognizer (the app advertises native input), so when the AI speaks English the recognizer often transcribes that English audio PHONETICALLY into the native script. A word-overlap echo guard comparing Latin-script tokens then misses it, and the AI "hears itself" and repeats.
**Fix (do NOT force English recognition — it breaks legit native input):** lean on TIME-based guards (the post-speech `blockFor` window + a wider "ignore input for N ms after AI speech ended" window), feed more recent turn history into the prompt, and add an explicit "never restate your own previous message" instruction. Keep ALL post-AI-speech release paths (including the tutor-switch greeting) on the SAME block duration — a stray shorter one leaves that path under-protected.

## Native-language voice selection (anti-robotic fix)

Per-character segment stitching (old approach) rendered 1-3 word fragments without sentence context, so each clip had its own prosodic ramp → robotic on concatenation.

**Current approach (single-voice selection):**
- Native-script chars ≥ 25 % of total script chars → native voice (e.g. `hi-IN-SwaraNeural`) for the WHOLE text
- < 25 % native → tutor English voice (e.g. `en-GB-SoniaNeural`) for the WHOLE text
- Indian Neural voices handle English code-switches naturally (they're trained on mixed data)
- 25% threshold: "confidence means आत्मविश्वास" = 41% native → Hindi voice ✓; "Of course let me help" = 0% → English ✓

**Why not split:** stitching two voices at character boundaries sounds robotic because each fragment has no prosodic context from the surrounding sentence.

## API Limits
- `/api/tts` rejects text > 3000 characters
- Streams `audioStream` from `msedge-tts`'s `tts.toStream()` result (returns `{ audioStream, metadataStream }` — use `audioStream` not result directly)

## Key Files
- Backend: `artifacts/api-server/src/routes/tts.ts`
- Frontend hook: `artifacts/edubharat/src/lib/use-edge-tts.ts`
- Recognition: `artifacts/edubharat/src/lib/use-speech-recognition.ts` (has blockFor)
