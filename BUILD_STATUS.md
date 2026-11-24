# Biillliiii's Inspector v0.5 — Build Status

**Milestone:** Login-first local owner workspace
**Base:** v0.4 automatic local session recording
**Build version:** 0.5.0

## Implemented in this patch

- First-run local Owner Account creation.
- Password and recovery-code hashing using Node.js `crypto.scrypt` with random salts.
- One-time recovery code display; recovery rotates the code.
- Login, logout and password recovery APIs.
- HttpOnly, SameSite=Strict session cookie; in-memory session token hashes.
- 10-minute idle timeout and 12-hour absolute session lifetime.
- Five failed login/recovery attempts trigger a 15-minute lockout.
- Project, export, memory, checklist, decision, session and monitoring APIs require an authenticated owner session.
- Same-origin checks and custom marker for state-changing API requests.
- Logout/auto-lock pauses an active Windows monitoring session.
- Initial UI opens the Owner Login / First Setup screen; project data is loaded only after valid authentication. Each fresh page launch requires an explicit login; a prior page session is locked and any running monitoring is paused.
- Demo “Explore dashboard” and demo-login routes no longer provide a dashboard bypass.
- Authentication data is separated into `data/auth.json`; `data/projects.json` is not modified by owner setup/login/recovery.
- Existing monitoring and project persistence tests updated for authentication.

## Automated validation performed in the build environment

- `npm run check` — PASS.
- `npm test` — 12/12 PASS.
- Auth setup and duplicate setup protection — PASS.
- Password hash and one-time recovery-code storage checks — PASS.
- Wrong password rejection and successful login — PASS.
- Protected APIs, cross-origin rejection and missing same-origin marker — PASS.
- Logout revokes access — PASS.
- Recovery resets password and rotates recovery code — PASS.
- Server-side idle expiry and monitoring pause — PASS.
- Project data bytes unchanged by auth setup/login/recovery — PASS.
- Existing memory persistence, monitor API and monitoring-core tests — PASS.

## Still requires validation on the user's Windows PC

- Visual first-run Owner Account setup in Chrome.
- Manual login, logout and recovery form usability.
- Real 10-minute browser inactivity lock.
- Windows monitoring pauses when workspace locks, then requires manual Resume after login.
- Windows PowerShell foreground-app sampling continues to work after authentication.

The automated tests were run in a Linux build environment. They verify server/API logic, not actual browser rendering or PowerShell execution on the user's Windows desktop. Do not mark Windows acceptance complete until the user verifies it locally.

## Important security limitation

`data/projects.json` remains plaintext local JSON. Password hashing and API authorization protect application access, but this is not full-disk encryption and does not stop someone who has direct access to the Windows account/filesystem. Keep Windows sign-in protected and maintain a separate backup.


## v0.6.0 Phase 1 (prepared locally; cloud not activated)
- Optional Supabase email auth and PKCE Google OAuth routes/UI added.
- Existing local owner login remains as fallback.
- Manual cloud project upsert is user-initiated and warns that matching cloud rows are updated.
- RLS migration prepared in `supabase/migrations/202611160001_phase1_projects_rls.sql`.
- No Supabase connection, SQL execution, Google provider setup, or local data upload performed.
- Local automated suite: 32/32 passing; live Supabase and two-user RLS verification remain pending.
