---
name: Progress tab shell gating
description: How to handle empty states in multi-tab dashboards without blocking access to tabs with partial data.
---

# Progress tab shell gating

## Rule
Always render the tab shell in a multi-tab dashboard. Let each tab own its own empty state instead of blocking the entire page with a global empty-state guard.

## Why
A page-level "no data" gate prevents users from reaching tabs that may have partial data. For example, a user who has saved jobs but has not yet started English Guru or Interview Ace still needs to open the Career tab. Per-tab empty states keep every section reachable while giving clear CTAs where data is missing.

## How to apply
- Render the tab bar and tab content container regardless of total data count.
- Validate the active tab key against the allowed set and fall back to the default tab (e.g., overview) for malformed or missing hash values.
- Implement `EmptyState` inside each tab component for its own no-data case.
