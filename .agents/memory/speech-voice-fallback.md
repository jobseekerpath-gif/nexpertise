---
name: Speech voice fallback
description: Browser speech voices vary a lot, so voice selection must be resilient rather than exact.
---

Browser TTS voice inventories are inconsistent across devices and browsers. Prefer locale/name matching for Indian voices, but always fall back to pitch, rate, and the closest available English voice when the ideal male/female voice is missing.

**Why:** the same browser can expose different voices on different machines, and relying on one exact voice name makes the tutor feel broken when that voice is absent.

**How to apply:** when adding a new speaking flow, keep the voice chooser fuzzy, expose gender/style preferences, and treat tone controls as the main way to make speech feel warmer or more masculine/feminine.