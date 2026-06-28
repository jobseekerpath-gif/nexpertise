---
name: Replit secret naming with spaces
description: Replit stores secrets with spaces in names; code must handle both underscore and space variants.
---

Replit lets users create secrets with spaces in the name (e.g. "GOOGLE CLIENT ID", "GEMINI API KEY"). Node.js `process.env["GOOGLE CLIENT ID"]` reads these correctly, but `process.env.GOOGLE_CLIENT_ID` or `process.env["GOOGLE_CLIENT_ID"]` does NOT.

**Rule:** Whenever reading an env var that might have been set with a space, use both variants:
```ts
const apiKey = process.env["GEMINI_API_KEY"] ?? process.env["GEMINI API KEY"];
const clientId = process.env["GOOGLE_CLIENT_ID"] ?? process.env["GOOGLE CLIENT ID"];
```

**Why:** This is a common source of auth breakage in EduBharat. The Google OAuth and Gemini integrations failed entirely because the code only read the underscore form.

**How to apply:** Any time an integration (Google, Gemini, Resend, etc.) stops working and the key is confirmed set in Replit — check whether the secret name uses spaces vs underscores. Add the `?? process.env["NAME WITH SPACE"]` fallback.
