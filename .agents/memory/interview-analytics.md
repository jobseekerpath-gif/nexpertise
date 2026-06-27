---
name: Interview Ace analytics
description: Analytics persistence rule for Interview Ace to keep progress trends meaningful.
---

# Interview Ace analytics

## Rule
Persist exactly one analytics record per completed mock interview, not one per answered question.

## Why
Per-question tracking pollutes the progress chart and averages. Users want their score trend to show how each full interview went, not how each individual answer scored. One canonical session per completed report also avoids duplicate rows in the database and keeps the "last N interviews" trend consistent between local and server storage.

## How to apply
- Save analytics only after the full interview report is generated.
- Do not log intermediate answers as separate analytics sessions.
- Keep local and server storage aligned so offline users see the same session-level trend as logged-in users.
- Clean up legacy per-question rows on load so they do not distort charts.
