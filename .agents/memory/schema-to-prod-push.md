---
name: DB schema reaches prod via drizzle-kit push
description: This project has no runtime migrations; schema changes must be pushed to the prod DB at deploy or prod crashes.
---

`lib/db` uses `drizzle-kit push` (scripts: `push` / `push-force`) as the source of truth. The `.sql` files under `lib/db/migrations/` are leftovers and are **NOT** applied at runtime — nothing calls a migrator for the app schema at startup (the only runtime `runMigrations` call is stripe-replit-sync's own tables, unrelated to the app schema).

**Why:** after adding a column/table (e.g. `users.credits`, `credit_transactions`), dev works because you ran `pnpm --filter @workspace/db run push` against the dev DB — but production has a separate `DATABASE_URL`. Skip the prod push and the deployed app throws "column/relation does not exist".

**How to apply:** after any schema change, at/just before deploy, run a drizzle push against the **production** database (see the database skill's "push dev to prod" flow). Do not add a runtime migrator or trust the `migrations/*.sql` files — that would diverge from the project's established pattern.
