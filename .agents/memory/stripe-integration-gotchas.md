---
name: Stripe integration gotchas (Replit connector + stripe-replit-sync)
description: Two non-obvious, time-costly failures when wiring Stripe via the Replit connector and the stripe-replit-sync package inside a bundled Node server.
---

# Replit Stripe connector credential field names
The Replit-managed Stripe connector exposes credentials under `settings.secret` and
`settings.publishable` (also `account_id`, `mcp`, `claim_url`) — NOT `settings.secret_key`.
Reading `settings.secret_key` returns undefined, so the client silently logs
"Stripe not connected" even though the connector is healthy and bound to the repl.
**How to apply:** read `settings.secret ?? settings.secret_key` (fallback) when pulling the
key out of the connection. Confirm live field names at runtime with `listConnections("stripe")`
(needs a non-empty name arg) inside a `"use impure"` fn.

# esbuild bundling silently breaks stripe-replit-sync migrations (zero tables)
`stripe-replit-sync`'s `runMigrations()` locates its SQL files via
`path.resolve(__dirname, "./migrations")`, where `__dirname` derives from `import.meta.url`.
When the API server bundles everything into a single `dist/index.mjs` (esbuild), that
`__dirname` resolves to the *bundle's* dir, not the package's. `connectAndMigrate` then hits
`existsSync(dir) === false` and returns early. Because `initStripe` calls
`runMigrations({ databaseUrl })` WITHOUT a logger, this is completely SILENT.
**Symptom:** the `stripe` schema exists but is EMPTY — zero tables, no `stripe._migrations`
tracker — and webhook setup later fails with `relation "stripe.accounts" does not exist`.
The money path (checkout/confirm via `getUncachableStripeClient`) still works because it never
touches the sync tables; only the webhook backup + data sync break.
**Fix (in build.mjs):** after esbuild, copy the package's `dist/migrations` into the app's build
`dist/migrations` (the path the bundled `__dirname` resolves to). Fail the build if the source
dir has zero `.sql` files, so an upstream layout change can't silently reintroduce the bug.
**Why prefer copy over externalizing:** externalizing moves the package to runtime module
resolution and would crash the WHOLE server on a resolve miss; copying keeps the blast radius
limited to Stripe. This __dirname/file-relative hazard applies to any esbuild-bundled package
that reads sibling files at runtime.
