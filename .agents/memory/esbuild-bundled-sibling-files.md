---
name: esbuild bundled sibling-file hazard
description: Bundled Node packages that locate sibling files at runtime via import.meta/__dirname resolve to the BUNDLE dir, not the package dir — silently breaking file loads (migrations, templates, assets).
---

# The hazard
A package that resolves sibling files with `path.resolve(__dirname, "./something")`, where `__dirname` derives from `import.meta.url`, breaks when esbuild bundles the server into a single file. The bundled `__dirname` points at the *bundle's* dir, not the package's, so `existsSync(dir) === false` and the load returns early — often **silently** if no logger is passed.

**Symptom:** a feature that depends on those files (SQL migrations, templates, static assets) does nothing, with no error. Downstream failures ("relation X does not exist") appear far from the real cause.

**Fix (in build.mjs):** after esbuild, copy the package's sibling dir (e.g. `dist/migrations`) into the app build at the path the bundled `__dirname` resolves to. Fail the build if the source dir is empty, so an upstream layout change can't silently reintroduce the bug.

**Why prefer copy over externalizing:** externalizing moves the package to runtime module resolution and can crash the whole server on a resolve miss; copying keeps the blast radius limited to that one feature.

# Historical note
This was first hit with the `stripe-replit-sync` package's `runMigrations()` (SQL resolved to the bundle dir → empty `stripe` schema). EduBharat no longer ships any Stripe code — payments are UPI (see credit-system.md) — but `stripe-replit-sync` may still linger in `pnpm-workspace.yaml`. The general bundling lesson stands for any esbuild-bundled package that reads sibling files at runtime.
