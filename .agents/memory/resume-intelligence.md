---
name: Resume Intelligence module
description: Key decisions and gotchas for the Resume Intelligence page in EduBharat
---

## Section parsing strategy
The AI response is parsed via regex matching each of 8 exact section headings (e.g. "Overall Assessment:", "Contact & Header:"). The pattern uses a lookahead for the next heading to bound each section. A raw-text fallback renders if fewer than 3 sections parse — covers cases where the LLM uses different formatting.

**Why:** LLMs sometimes prefix with `##` or omit colons; the regex handles `(?:##?\s*)?Title[:\n]` variants.

**How to apply:** When adding new sections, append to REPORT_SECTIONS array and include the exact title in the prompt — they must match exactly (case-insensitive).

## Score extraction
`extractScore()` accepts `"Score: XX/100"`, `"XX/100"`, and `"XX%"` patterns. Validates 0–100 range. Used both in the overall hero and per section for mini-score chips.

## Prompt structure
Prompt requests exactly 8 sections with exact heading names. Asking for specific score formats (`"Score: XX/100"`) within each section makes sub-score extraction reliable without structured JSON (which Gemini sometimes ignores).

## Route layout
Uses `compact showFooter={false}` layout (same as English Guru, Interview Ace, Rozgar Samachar) — gives full-viewport scrollable space without the standard footer.
