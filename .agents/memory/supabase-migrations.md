---
name: Supabase migrations application
description: How schema/RLS migrations in supabase/migrations relate to the live DB in this project
---

# Supabase migrations must be applied externally

SQL files in `supabase/migrations/` are the deliverable, but they are NOT auto-applied to the database the app uses.

**Why:** The app talks to a hosted Supabase project via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Only the anon key is available in this environment (no service role key / no direct Supabase Postgres connection string). The `DATABASE_URL` / `PGUSER` env vars point to an unused Replit built-in Postgres (`host: helium`, db `heliumdb`), NOT Supabase — running SQL there does nothing for the app.

**How to apply:** The user must run new migrations against their Supabase project (dashboard SQL editor or CLI). Until applied, DB-dependent features (e.g. new columns, RLS changes) will fail at runtime even though `tsc` passes. Always flag this in the final report when a version adds a migration.
