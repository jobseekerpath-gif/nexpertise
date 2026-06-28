---
name: Mobile tool AI calls
description: Expo tool/[id].tsx must use {prompt, system, maxTokens} body for /api/ai/chat — NOT messages array.
---

The Expo mobile tool detail screen (`artifacts/edubharat-mobile/app/tool/[id].tsx`) calls the API server's `/api/ai/chat` endpoint.

**Correct body format:**
```ts
{ prompt: userInput, system: systemPromptString, maxTokens: 400 }
```

**NOT:**
```ts
{ messages: [{ role: 'user', content: userInput }] }  // WRONG — this is what the endpoint rejects
```

**Why:** The AiChatBody Zod schema in @workspace/api-zod defines `prompt` (string) + optional `system` + `maxTokens`. The messages-array format was never supported.

**API base URL:** `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` — EXPO_PUBLIC_DOMAIN is set to $REPLIT_DEV_DOMAIN in the workflow env.

**Response:** `{ text: string }` — access via `data.text`.
