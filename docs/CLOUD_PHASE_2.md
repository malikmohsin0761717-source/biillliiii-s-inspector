# Cloud Phase 2 — Supabase workspace storage

## Scope
This phase adds an owner-scoped `public.workspace_documents` table for explicitly selected cloud workspace documents. The existing local JSON store remains unchanged and is not imported.

## Safety
- No local project, auth, or AI-history files are read or uploaded by this migration.
- AI chatbot and teacher histories remain local unless a future explicit sync action is designed and approved by the owner.
- The table is protected by row-level security for all CRUD operations.
- Anonymous users receive no table privileges.
- Each document is limited to a JSON object of at most 1 MiB.
- Supported document types are allow-listed in the migration.

## Apply manually
1. Open the separate Biillliiii Inspector Supabase project (not the Udhaar Khata project).
2. Open SQL Editor.
3. Review and run `supabase/migrations/202611240001_cloud_workspace_documents.sql`.
4. Run the read-only checks in `supabase/VERIFY_CLOUD_PHASE_2.sql`.
5. Confirm RLS is enabled, exactly four owner policies exist, and only authenticated users have table CRUD grants.
6. Because the first version of the migration was already applied, also run `supabase/migrations/202611240002_restrict_cloud_document_types.sql` once. It blocks direct cloud writes of local-only AI histories. It never deletes rows; if any such rows already exist, it stops and rolls back for review.
7. Re-run `supabase/VERIFY_CLOUD_PHASE_2.sql` and confirm the document-type constraint contains only `workspace`, `reminders`, `important`, `alerts`, and `settings`.

Do not run this migration in any other Supabase project.

## Not yet enabled
This schema alone does not turn on automatic cloud sync. The Vercel-compatible stateless authentication/API adapter and explicit user-controlled document sync are separate implementation work. Do not deploy or transfer an OpenAI key as part of this phase.
