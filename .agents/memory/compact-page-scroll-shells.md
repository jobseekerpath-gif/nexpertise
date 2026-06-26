---
name: Compact page scroll shells
description: Full-viewport routes need an outer scroll path or they can feel frozen even when inner panes scroll.
---

Rule: compact full-viewport pages should still provide at least one obvious scroll container for the whole route, even if the main content is split into nested panes.

**Why:** when every visible section is height-constrained and only a nested panel scrolls, the page can look or feel locked on desktop/mobile and users think it is broken.

**How to apply:** when building a compact route, check the top-level shell and the first page wrapper for a real scroll path before assuming the inner panel is enough.