---
name: Edge TTS SSML constraints
description: What works and what breaks when sending SSML via msedge-tts toStream/rawToStream
---

## Rule
Never inject `<break>` SSML tags into text passed to Edge TTS via msedge-tts — they cause the service to return 0 bytes (silent failure, no error).

**Why:** Microsoft Edge TTS (via msedge-tts WebSocket protocol) rejects SSML containing `<break>` elements, whether inside `<prosody>` or at `<voice>` level. The stream ends immediately with 0 bytes and no error event.

**How to apply:**
- `toStream(plainText)` — works reliably. Neural voices handle punctuation-based prosody natively.
- `toStream(text, { rate: RATE.SLOW })` — works (enum values only).
- `toStream(text, { rate: "-6%" })` — BREAKS (percentage strings cause 0-byte response).
- `rawToStream(ssml)` with `<break>` — BREAKS (0 bytes even at `<voice>` level).
- For naturalness: rely on improved system prompts (shorter sentences, natural reactions) rather than SSML break tags.
- Role-label stripping (cleanForTTS) is safe and should be kept.
