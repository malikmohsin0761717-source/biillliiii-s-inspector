# v0.6.0 Phase 1 changes
- Added Supabase email auth endpoints and PKCE Google OAuth flow.
- Added server-side opaque cloud session cookies and refresh handling.
- Preserved local owner authentication as fallback.
- Added explicit/manual project cloud upsert endpoint and Settings confirmation UI.
- Added owner_id-based RLS migration for public.projects.
- Kept local JSON store and all existing project features intact; no automatic migration or upload.
