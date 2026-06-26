---
name: English Guru compact layout
description: Live conversation should own the viewport so the chat stays visible without page scrolling.
---

English Guru's live conversation should use a full-viewport shell with no footer, and only the conversation/message panel should scroll. The latest response should stay pinned to the top of that panel.

**Why:** the tutor needs room for controls, status, and the active response without the browser page itself moving around.

**How to apply:** keep the route in a compact layout, avoid page-level scrolling in conversation mode, and preserve the chat panel as the only scroll container.