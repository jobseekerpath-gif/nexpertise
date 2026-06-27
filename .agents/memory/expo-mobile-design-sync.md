---
name: Expo mobile design sync
description: How to keep a new Expo mobile artifact visually consistent with an existing web artifact and avoid common first-build pitfalls.
---

When creating an Expo mobile companion for an existing web artifact, sync the design tokens before building screens.

**Rule:** Read the web artifact's `src/index.css` `:root` block (and `.dark` if present), convert HSL tokens to hex, and write them into `constants/colors.ts` with the same semantic names. Match border radius too.

**Why:** If the mobile palette is invented separately, the two artifacts feel like different products even when they share the same brand.

**How to apply:**
1. Extract `background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, and any tool-specific accent colors.
2. Add a `dark` key with the same token names if the web artifact has dark mode.
3. Create a `useTools()` hook (or similar) that derives tool icon colors from `useColors()` so dark-mode contrast is automatic instead of hardcoded.
