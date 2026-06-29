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

**Fix layers:**
1. `blockFor(ms)` added to `useSpeechRecognition` — sets `blockedUntilRef = Date.now() + ms`
2. `spawnRecognition()` in `startContinuous` checks `blockedUntilRef`; if blocked, reschedules itself after remaining time + 80ms
3. Every `synth.speak(...)` call in Interview Ace passes `() => speech.blockFor(1200)` as onEnd
4. English Guru's `handleConvPhrase` calls `speech.blockFor(1200)` in speak onEnd before setting convFlowState
5. English Guru also has a 700ms `setTimeout` before calling `startContinuous` (double protection)

**Why:** 1200ms post-speech silence prevents recognition from spawning while room echo of AI voice is still audible (especially laptop/phone speakers).

## API Limits
- `/api/tts` rejects text > 3000 characters
- Streams `audioStream` from `msedge-tts`'s `tts.toStream()` result (returns `{ audioStream, metadataStream }` — use `audioStream` not result directly)

## Key Files
- Backend: `artifacts/api-server/src/routes/tts.ts`
- Frontend hook: `artifacts/edubharat/src/lib/use-edge-tts.ts`
- Recognition: `artifacts/edubharat/src/lib/use-speech-recognition.ts` (has blockFor)
