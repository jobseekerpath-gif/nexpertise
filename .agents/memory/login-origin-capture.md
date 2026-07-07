---
name: Login-origin capture (IP + geo)
description: Why a "user IP/location not captured" report is usually a false alarm, and the one invariant that prevents a real gap
---

- **Invariant: every login path must record sign-in origin.** It is easy to add a new auth entry point and forget to wire in origin capture — that is exactly how the password admin-login path ended up recording nothing while the other login paths worked. When adding any login path, make recording the sign-in origin part of its success branch.

- **A "user IP/location is not captured" report is usually NOT a broken pipeline.** Check these two first, in order:
  1. **Historical rows.** Accounts that last logged in *before* the feature shipped have empty origin columns and cannot be backfilled (the past IP no longer exists). They populate on their next login.
  2. **Null-hiding UI.** The admin directory hid fields whose value was null, so pre-feature users showed *no* origin fields at all — which reads as "the feature is missing." Origin fields must render a visible placeholder (e.g. "Not recorded") instead of disappearing.

- **Prove the pipeline with one fresh login, don't judge from old rows.** Before touching capture code, do a single new sign-in and inspect that user's row — capture almost always turns out to be working.

- **Why:** login-origin data is inherently forward-looking. Almost every "not captured" complaint is stale rows plus a UI that hides nulls, not a broken capture path — so verify before "fixing," and make the UI distinguish "not recorded" from "field doesn't exist."
