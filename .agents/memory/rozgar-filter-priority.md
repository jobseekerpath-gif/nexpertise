---
name: Rozgar filter vs profile priority
description: How Rozgar job-search filters must relate to the student profile, and the two-layer filtering trap.
---

# Rozgar filter vs profile priority

When building the Rozgar job query, the user's explicit FILTER values
(city / experience / sector) must take priority over the student profile's
location. The query hook takes an opts object and prefers `opts.city` over
`profile.preferredCity || profile.location`.

**Why:** Rozgar filters in TWO layers: (1) the backend `/api/jobs/search` query
targets a city (Adzuna `where`, Google News place) and ranks by it, and (2) the
client `filterJobs` applies a STRICT `job.location.includes(city)` filter. If a
filter value is not sent to the backend query, two bugs appear together — the UI
shows "filter = Lucknow" while results are for the profile city (Assam), AND the
client strict-filter then removes every fetched (Assam) job, so the list can go
empty. The fetch must target the same city the client filters on.

**How to apply:** any new job filter that narrows *which* jobs exist (not just
re-ranks) must be threaded through to the backend query params, not only applied
client-side. Re-ranking-only preferences can stay client-side.
