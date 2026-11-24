# Supabase RLS verification — v11.0.0

## What the code now enforces

- A Supabase session alone does **not** unlock the local JSON workspace.
- Local project, AI history, reminder, report and backup APIs require the local Owner session.
- Manual cloud sync requires both the local Owner session and a separately signed-in Supabase account.
- Cloud project upserts use the user's access token; the migration's `owner_id default auth.uid()` and owner-scoped RLS policies remain the database boundary.
- No service-role key is used by the application.

## Read-only metadata check

Run `supabase/VERIFY_RLS_v11.0.0.sql` in the intended Supabase project's SQL Editor. Confirm:

1. `public.projects` exists and `rls_enabled` is `true`.
2. Four authenticated policies exist: SELECT, INSERT, UPDATE and DELETE.
3. Every policy's `qual` / `with_check` is scoped to `auth.uid() = owner_id` (the expression may be normalized by PostgreSQL).
4. `anon` has no table privileges.

## Required two-account verification (not performed by this patch build)

Use two disposable test accounts, A and B, and only test project records:

1. Sign in as A and create/sync a project with a unique test code.
2. Sign in as B and attempt to select A's row by its project code/UUID. It must return no row / deny access.
3. As B, attempt UPDATE and DELETE on A's row. No change must occur.
4. As B, attempt INSERT with `owner_id` set to A's UUID. RLS must reject it.
5. As A, confirm A can read/update/delete A's own test row.
6. Delete the disposable test rows using their owning accounts after verification.

Do not use a service-role key for these checks; it bypasses RLS. Never put tokens or service-role keys in the browser, ZIP, source control or logs.

**Status:** Source migration reviewed; automated tests verify policy text and local-session isolation. Live Supabase metadata and two-account isolation remain **NOT VERIFIED** until the above checks are completed against the actual project.
