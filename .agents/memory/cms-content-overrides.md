---
name: CMS content overrides
description: How editable page text works on EduBharat — DB stores only overrides; client code holds the authoritative defaults.
---

Admin-editable page text (home hero, credits hero, etc.) uses an override model, not a full CMS.

## The pattern (do not invert it)
- **Defaults live in the client code** as the inline `fallback` argument to `useContent(key, fallback)`. That fallback is the display source of truth — the app renders correctly against an EMPTY content table.
- The DB (`site_content` table) stores **only overrides** — a row exists for a key only if an admin changed it. `GET /content` returns the override map; `useContent` shows the override when present, else the code fallback.
- `CONTENT_REGISTRY` (client) exists ONLY so the admin editor can discover/label editable keys. It is NOT used for display and is NOT the default source.
- **Why:** keeping defaults in code means new keys work immediately without a migration/seed, the app never shows blank text if the content table is empty, and copy changes are code-reviewed by default. Seeding defaults into the DB would create two sources of truth that drift.
- **How to apply:** to add editable text, add the key to `CONTENT_REGISTRY` AND call `useContent(key, "the default text")` at the render site. Never write defaults into `site_content`; never remove the inline fallback.
