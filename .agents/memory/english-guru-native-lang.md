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

**Fix pattern (in `english-guru.tsx`):** greetings are always voiced `"English"`.
For a normal reply, pick the voice by **counting scripts**: use the native voice
only when Indic/Arabic characters (`\u0900-\u0D7F`, `\u0600-\u06FF` for Urdu)
outnumber Latin letters (a heavier native "help" moment); otherwise voice it in
English. This keeps English pronunciation correct while still pronouncing a
predominantly-native gloss properly. Edge case: *romanised* native text stays on
the English voice — acceptable.

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

## Native-accent explanations are TURN-LEVEL, not per-segment

When the student explicitly asks for the *meaning* of an English word/sentence in
their native language, the AI is prompted to answer MOSTLY in native script
(short, meaning-focused) then return to English next turn. The script-majority
TTS heuristic (Rule 2) then voices that reply in the native accent. This is
deliberately **turn-level** — do NOT split one reply into native+English segments
played with different voices: sequential TTS fetches add 1-2 s gaps per segment
(choppy, violates the "instantly" ask) and Edge SSML multi-voice is fragile. One
voice per reply, chosen by script majority, is the contract.
