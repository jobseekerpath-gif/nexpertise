---
name: English Guru native-language speech I/O
description: How English Guru handles speech recognition + TTS voice when a native (helper) language is selected — rules that fix "AI never responds", "AI doesn't speak English", and the native-mode self-echo ("teacher replies to itself").
---

# English Guru — native-language speech I/O

English Guru lets a student pick a **native helper language** while practising English.
Two rules keep the live voice conversation working for ALL 13 languages.

## Rule 1 — browser speech RECOGNITION has no model for several Indian languages; fall back, never loop

The browser Web Speech API (Chrome/Edge → Google engine) does **not** recognise
every BCP-47 code we can name. Known gaps:
- **Assamese `as-IN`** and **Odia `or-IN`** — no recognition model at all.
- **Punjabi** — the engine expects **`pa-Guru-IN`** (Gurmukhi-tagged), not `pa-IN`.

An unsupported code makes `recognition.start()` fire `onerror`
(`language-not-supported`) → `onend` → the continuous loop respawns with the
same bad code → it **never captures audio**, so the AI never gets input. This is
the "teacher never responds in <language>" bug — it looks like the AI is broken
but the mic simply never produced a transcript.

**Fix pattern (in `use-speech-recognition.ts`):** keep a session-level
`Set` of codes the engine rejected, and resolve the spawn language through a
fallback chain `en-IN → en-US` when the chosen code is in that set. On a
`language-not-supported` error, record the *spawn* language (capture it in the
spawn closure so `onerror` sees the right value) — `onend` reschedules right
after and the next spawn uses the fallback. Never blacklist the terminal
fallback (`en-US`) or you reintroduce the infinite loop.

**Why en-IN is an acceptable fallback here:** English Guru is English-first; a
student whose spoken native language can't be recognised can still TYPE it, and
the AI still *replies* with native-language help. (See Rule 3: recognition is now
*adaptive* — English by default, native only right after a native reply — so this
fallback only matters inside the rare native-recognition window.)

## Rule 2 — voice replies in English by default, because the AI speaks mostly English

The AI is prompted to respond **MOSTLY in simple English** (the native language
is only an occasional "helping hand"). So voicing every reply with the *native*
neural voice (e.g. Malayalam) made it read English text with a heavy, wrong
accent — the "teacher isn't speaking English" bug.

**Fix pattern (now SERVER-SIDE in the TTS route):** greetings are always voiced
`"English"`. For a normal reply the client sends `language:"English"` +
`nativeLanguage:uiLang` and the **server** picks the voice per script-run (see the
per-segment section below): English/Latin runs → the tutor's English voice,
native-script runs → the native voice. A single-script reply collapses to one
voice by the same **script-count** rule (native voice only when Indic/Arabic
chars `\u0900-\u0D7F`, `\u0600-\u06FF` outnumber Latin). This keeps English
pronunciation correct while pronouncing a predominantly-native gloss properly.
Edge case: *romanised* native text stays on the English voice — acceptable.
(The client's own script-count now drives ONLY recognition — Rule 3 — not TTS.)

## Rule 3 — recognition follows the language the AI just SPOKE (adaptive), not the helper setting

**This supersedes the earlier "keep the recogniser on the native language for
supported languages" stance.** The recogniser language is driven by a
`recognitionLang` state (default `"English"`), NOT by `uiLang`:
- set to the reply's spoken language after every AI turn (English by default;
  native only when that reply is native-script-majority),
- reset to `"English"` on the teacher-switch greeting and whenever the
  helper-language dropdown changes.

**Why:** the AI speaks *mostly English*, so the mic should listen in English most
of the time (better English recognition) and flip to the native language only
right after a native explanation — exactly when the student is most likely to
answer in it. Crucially this makes any **speaker echo come back in the SAME
script the AI just spoke**, so the *content* echo-guard can finally match and drop
it in every mode. Cross-script echo (native recogniser transcribing the AI's
English into native script → zero Latin overlap → guard misses) was the confirmed
"teacher replies to its own voice" bug, worst in Malayalam.

**Why this is NOT the "blanket-force English" anti-pattern Rule 1 warns about:**
native input is preserved right after a native reply (the moment it matters), and
the unsupported-language fallback (Rule 1) is unaffected. Changing
`recognitionLang` is continuity-safe: it only updates `langCodeRef`; it does NOT
stop/restart the live mic — the next spawn picks up the new code (mic is paused
for the whole AI turn + `blockFor(1500)`, so the state applies well before it
reopens).

**How to apply:** never regress this to `useSpeechRecognition(uiLang)`. The time
gate (mic pause during speech + `blockFor(1500)` + ~4500 ms window; greeting and
main-reply release paths on the SAME duration or teacher-switch greetings
self-capture) is still the first line of defence, but the content guard now backs
it up in native modes too.

## Native-accent explanations use PER-SEGMENT server-side TTS (supersedes the earlier turn-level rule)

When a reply mixes native script + English (e.g. glossing an English word:
"confident എന്നാൽ ആത്മവിശ്വാസം"), one voice for the whole reply mispronounces the
other script — the native voice reads the English word like a robot, and vice
versa. The user explicitly rejected this "for all native languages".

**Contract:** the TTS route (`/api/tts`) takes an OPTIONAL `nativeLanguage`. When
present, it splits the cleaned reply into consecutive native-script vs Latin runs,
synthesizes each run with its OWN Edge neural voice (native vs English/tutor) in
parallel, and **concatenates the MP3 buffers into ONE response body**. All
segments share the exact same output format (24 kHz / 48 kbit / mono CBR MP3), so
byte-concatenation plays back gaplessly. Only genuinely mixed replies
(`segments > 1`, capped `<= 8`) take this buffered path; single-script replies and
callers that omit `nativeLanguage` (greetings, Interview Ace) stay on the ORIGINAL
single-voice STREAMING path (no added latency).

**Why this reverses the earlier "turn-level, never per-segment" note:** that note
rejected per-segment because *client-side sequential* fetches add 1-2 s gaps and
Edge SSML multi-voice is fragile (0-byte audio). Doing the split + concat
**server-side into one blob** avoids BOTH: the client still does one fetch → one
blob → one `onEnd`, so the delicate audio-singleton / mic-release / echo guards
are untouched, and there are no inter-segment gaps.

**How to apply:** keep the mixed-voice logic SERVER-SIDE; never move it back to the
client (it would reintroduce gaps and risk the echo/mic pipeline). Never inject
SSML `<break>` tags or percentage rate strings (0-byte audio — see
`edge-tts-ssml.md`). If a segment synth fails before headers, the route 500s and
the client's non-OK branch fires `onEnd` (mic recovers) — a silent turn, but safe.
