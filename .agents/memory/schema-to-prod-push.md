---
name: Schema reaches prod on Publish (never manual prod DDL)
description: How EduBharat schema changes get to the production DB on Replit, and the hard rule against manual prod migration.
---

# Rule
Production schema on Replit managed Postgres is applied AUTOMATICALLY by the Publish flow: on
Publish, Replit introspects dev + prod, computes a SQL diff, prompts the user to confirm any
rename (else rename = drop+add = data loss), and applies it to prod. That is the ONLY supported
way to change the prod schema.

The agent must NEVER:
- run DDL against prod (drizzle-kit push on a prod URL, psql $PROD_URL; `executeSql
  environment:"production"` is read-only anyway and rejects DDL),
- write a migrate-prod script,
- add `db:push` / `push-force` / `drizzle-kit push` to the deploy build command, or
- add startup-time CREATE/ALTER "self-heal" DDL to the app entrypoint.

# Correct flow after any schema change
1. Edit the source of truth: `lib/db/src/schema/*.ts`.
2. Apply to the DEV db: `pnpm --filter @workspace/db run push` (or `push-force`). Post-merge setup
   does this automatically after a task merge.
3. Verify the feature in dev.
4. Tell the user to (re-)Publish; the publish diff carries the change to prod. Additive changes
   (new column w/ default, new table) apply cleanly; renames/destructive alters show a confirm prompt.

**Why:** manual prod DDL / deploy-time db:push / startup DDL are all unsafe (run on every deploy,
can lose data) and are explicitly prohibited by the database skill. Classic wrong turn: "prod
missing a column" → agent writes a push script; the right answer is always re-publish.
**Correction:** an earlier version of this note said to "drizzle-kit push to the prod DB at
deploy" — that is WRONG; do not do it.
