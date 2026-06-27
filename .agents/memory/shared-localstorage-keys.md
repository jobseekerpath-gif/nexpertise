---
name: Shared localStorage keys
description: Keep localStorage keys consistent across hooks that read the same user domain.
---

# Shared localStorage keys

## Rule
When multiple hooks read the same user-domain data from localStorage, they must use the same key scheme (including user or guest scope).

## Why
Mismatched keys cause a feature to appear empty or stale in one view while the data exists in another. For example, a saved-jobs list written by `useSavedJobs` under `edubharat_saved_jobs_${userId}` must be read by analytics hooks using the same key, not a generic `edubharat_saved_jobs` key.

## How to apply
- Extract a shared `localKey(userId?)` helper when more than one hook touches the same localStorage domain.
- Use the same helper in both the write path and any read-only analytics hooks.
- Keep the same user-scoped vs. guest fallback convention everywhere.
