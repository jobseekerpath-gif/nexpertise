---
name: Live chat news/current-events enrichment
description: DuckDuckGo Instant Answer API enriches AI context for news queries in English Guru live chat, so AI answers naturally instead of refusing.
---

## What was built

Two-part system added so English Guru's AI tutor can answer news/current-events questions naturally:

### Backend: GET /api/ai/web-context?q=<query>
In `artifacts/api-server/src/routes/ai.ts`:
- Fetches `https://api.duckduckgo.com/?q=QUERY&format=json&no_html=1&skip_disambig=1` with 3.5s server-side timeout.
- Returns `{ context: string }` — picks `AbstractText > Answer > Definition > RelatedTopics (including nested Topics)` up to 400 chars.
- Returns `{ context: "" }` on any error (graceful degradation).
- Free API, no key needed.

### Frontend: `handleConvPhrase` in `english-guru.tsx`
- `NEWS_RE` regex matches specific news/sports/finance phrases (cricket score, ipl result, election winner, petrol price, gold price, sensex, box office, etc.) — intentionally specific to avoid false-positives on generic words.
- If matched: fetches `/api/ai/web-context?q=...` with 1500ms client timeout before calling stream.
- Injects context as `"Live web context (use naturally if relevant): ..."` into system prompt.
- System prompt rule: "If asked about news… share what you know confidently using 'from what I know'. Do NOT say you have no internet access."

## Key design decisions
- 1500ms client timeout — fast enough to not feel like a delay; DuckDuckGo usually responds in 300-800ms.
- NEWS_RE must be specific (not `current`, `today`, `result` alone) — these occur in ordinary lesson contexts and would add unnecessary latency.
- Web context is enrichment only — if it fails or returns empty, the AI still responds using its training knowledge.
- AI is instructed not to say "I can't access the internet" — instead it says "from what I know" and answers from training data (covers up to early 2025).
