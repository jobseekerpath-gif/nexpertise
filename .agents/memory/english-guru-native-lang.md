---
name: English Guru native-language speech I/O
description: How English Guru handles speech recognition + TTS voice when a native (helper) language is selected — two non-obvious rules that fix "AI never responds" and "AI doesn't speak English".
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
the AI still *replies* with native-language help. Do **not** blanket-force
English recognition for *supported* native languages — that breaks legitimate
native speech input (documented separately).

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

## Echo interaction

Cross-script echo (native recogniser transcribing the AI's English speech
phonetically into native script) defeats the Latin-token echo guard. Rule 1's
fallback makes the worst-affected languages recognise in English, so the content
echo guard works for them again. For *supported* native languages the recogniser
stays native, so the **time gate is the real defence**: mic is paused during AI
speech, then `blockFor(1500)` after it ends, plus a widened (~4500 ms) echo
window. Keep the greeting release path and the main-reply release path on the
**same** block duration or teacher-switch greetings can self-capture.
