---
name: Avatar lip movement (talking portraits)
description: How tutor/interviewer photos "talk" while TTS plays, and which approaches were rejected and why.
---

Tutor and interviewer portraits (shared `AnimatedAvatar`, used by Interview Ace + English Guru) show a subtle lip/jaw movement while the AI is speaking, to feel more human.

## Approach: CSS "puppet-jaw" on the real photo
- While `isSpeaking && imageSrc`, a `PhotoMouth` overlay mounts: a copy of the SAME photo, masked to a TIGHT band over the mouth/chin with a feathered CSS gradient mask, doing a small jaw-drop (a slight downward `translateY` plus a tiny `scaleY`) toggled open/closed by a self-scheduling randomized timer (natural talking cadence).
- It only mounts while speaking, so the idle photo is pixel-identical to before. `FallbackSVG` keeps its own SVG mouth animation for the no-image / failed-image case.
- Deliberately subtle. Lip movement on a static AI photo is inherently approximate; the goal is "alive", not accurate phoneme sync.
- **Keep the amplitude TINY — a large `scaleY` reads as "the face is being stretched/pulled", which the user twice called fake.** Prefer a small downward `translateY` (a jaw-drop feel) over a big vertical scale, on a tight mask band. It was tuned down from `scaleY(1.06)` on a wide band to `~translateY(0.7%)+scaleY(1.025)` on a ~49–66% band. Real phoneme sync on a static photo isn't achievable here (see rejected approaches), so subtlety — not bigger motion — is the only lever.

## Animate ONLY the mouth band — never the chest/neck
- The `PhotoMouth` mask must be a horizontal BAND over the mouth/jaw only (roughly mid-face), fully transparent ABOVE the upper lip AND BELOW the jaw so the neck, collar, and chest are never part of the moving copy. Hinge the `scaleY` transform-origin at the upper lip so the "jaw" opens downward without dragging the throat/chest.
- **Why:** an earlier mask reached too low, so the `scaleY` visibly pumped the chest/collar. A user flagged chest movement as unacceptable ("vulgar", especially on the female teacher). Only the lips/jaw may move.
- **How to apply:** if the effect ever looks like the body is "breathing", the mask is too tall — raise its lower edge, don't just reduce the scale.

## Rejected approaches (do not re-attempt without new capability)
- **Audio-amplitude drive (AudioContext AnalyserNode on the TTS audio element):** would route the shared TTS `<audio>` through the Web Audio graph, which risks breaking the hard-won autoplay unlock — a known severe, user-visible regression (see tts-autoplay-unlock / tts-global-singleton). Not worth it for a cosmetic effect.
- **Generated open-mouth frames + crossfade:** `generateImage` is text-to-image only (no img2img/inpainting), so a second "mouth open" frame doesn't match the original face — it morphs/glitches. Skip until an image-edit/inpaint capability exists.

**Why:** keep the lip effect fully decoupled from the audio pipeline. The animation must never touch the TTS audio element or its autoplay/unlock path.
**How to apply:** any future "make avatars more realistic" request should extend the CSS overlay (or add a real talking-head video/model), not tap the live audio graph.
