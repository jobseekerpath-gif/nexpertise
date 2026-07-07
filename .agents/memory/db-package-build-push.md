---
name: DB package build & push gotchas
description: Monorepo @workspace/db typecheck/push gotchas — emitted .d.ts rebuild and drizzle interactive prompt on runtime-owned tables.
---

Two non-obvious gotchas when changing the shared `@workspace/db` package (`lib/db`) schema.

## api-server typechecks against the EMITTED declarations, not the source
- The api-server uses TypeScript **project references** to `@workspace/db`, so it resolves types from `lib/db`'s compiled `.d.ts`, NOT from the `.ts` source.
- After editing a schema file (e.g. adding a column/table), api-server's typecheck keeps seeing the OLD shape until you rebuild lib/db's declarations: `cd lib/db && pnpm exec tsc -p tsconfig.json`.
- Incremental builds can skip emitting. If the rebuild doesn't pick up the change, delete `lib/db/dist` and `lib/db/tsconfig.tsbuildinfo` to force a clean re-emit, then typecheck api-server again.
- **How to apply:** any `@workspace/db` schema edit → rebuild lib/db declarations BEFORE trusting an api-server typecheck result (green OR red).

## drizzle push goes INTERACTIVE on tables it doesn't own
- The session store (`connect-pg-simple`) creates a `user_sessions` table at runtime that is NOT in the drizzle schema. `drizzle-kit push` sees an unknown table and prompts an interactive create/rename resolver, which HANGS a non-interactive `pnpm run push`.
- Fix: `tablesFilter: ["!user_sessions"]` in `lib/db/drizzle.config.ts` so push ignores runtime-owned tables.
- **Why / how to apply:** when a library creates its own tables at runtime, exclude them from drizzle's `tablesFilter` or push blocks forever on a prompt you can't answer.
