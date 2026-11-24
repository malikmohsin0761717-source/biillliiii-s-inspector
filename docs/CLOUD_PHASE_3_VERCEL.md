# Cloud Phase 3 — Vercel adapter

## What this branch adds
- A separate static cloud workspace under `cloud/`; the local-first `ui/` app is unchanged.
- Vercel Node functions under `api/` for Supabase email auth, Google PKCE callback, legacy project listing/manual project upsert, and owner-scoped workspace document CRUD.
- Supabase access and refresh tokens are stored only inside an AES-256-GCM encrypted, HttpOnly, Secure, SameSite cookie. The cookie is stateless across Vercel instances.
- Every database request uses the signed-in user's access token and Supabase RLS. The adapter does not use a service-role key.
- Workspace document payloads are limited to JSON objects up to 1 MiB; type and key validation also run in the API.

## Vercel project configuration
Set the Vercel project Root Directory to the repository root. The checked-in `vercel.json` publishes `cloud/` as the static output while Vercel discovers functions in `api/`.

Configure these environment variables in Vercel (Production/Preview as appropriate):
- `SUPABASE_URL`: URL of the dedicated Biillliiii Inspector Supabase project.
- `SUPABASE_PUBLISHABLE_KEY`: that project's publishable key. The legacy `SUPABASE_ANON_KEY` variable is accepted as a compatibility fallback.
- `BI_CLOUD_SESSION_SECRET`: a newly generated random secret containing at least 32 bytes. Keep it private; do not commit it or send it in chat.

Do not configure `SUPABASE_SERVICE_ROLE_KEY` for this adapter. Do not put any secret in browser code.

## Supabase Auth settings after a Vercel URL exists
Only after the owner has reviewed the target domain, add the exact deployed HTTPS URL to Supabase Auth Site URL / Redirect URLs. For Google OAuth, configure the Supabase provider and its callback allow-list as required by Supabase. The app's callback path is `/api/cloud-auth/callback`. These dashboard changes and live OAuth tests are not performed by this code patch.

## Important scope limits
- This is a cloud workspace foundation and document manager, not full feature parity with the local v11.0.1 dashboard.
- The local `server.js`, local JSON files, DPAPI key storage, Windows PowerShell monitoring, and local AI histories are not part of the Vercel deployment.
- The cloud page does not automatically import local projects or upload AI histories. Project upsert is an explicit API action and the cloud page currently lists projects read-only.
- Do not add `chatbot_history` or `teacher_history` sync without a separate explicit user action and review.
- No live Supabase data was imported or modified by this branch. No Vercel deployment, paid API request, or secret transfer is performed.

## Local verification
Run `npm test` and `npm run check` from the repository root. Live login, OAuth, RLS isolation, and Vercel deployment tests require a separate owner-approved acceptance run after environment setup.
