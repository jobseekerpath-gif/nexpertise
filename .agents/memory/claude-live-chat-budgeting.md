---
name: Claude live-chat budgeting
description: Live tutoring should use small prompts, small token caps, and the smallest model that can answer well.
---

Live tutoring prompts should stay short, use only a compact recent history, and favor the cheapest capable Claude model first. Reduce output tokens aggressively for short replies, but do not claim or enforce a fixed per-response cost.

**Why:** API cost is driven by the actual tokens processed, so the only reliable control is to shrink prompt and output size while keeping response quality acceptable.

**How to apply:** for quick live chat, send only the latest turns plus learner context, keep replies concise, and route brief answers to the smallest model before falling back to larger ones if needed.