# v0.5 Source Test Results

## Automated checks run in build environment

- `npm run check` — PASS.
- `npm test` — 12 tests PASS, 0 FAIL, 0 SKIP in the Linux build environment.
- Owner setup, username/password validation and duplicate setup protection — PASS.
- Password hash and recovery-code hash verification (no plaintext stored) — PASS.
- Wrong password rejection and correct login — PASS.
- Protected project APIs — unauthenticated request returns 401 — PASS.
- Cross-origin requests and mutation requests without the same-origin marker are rejected — PASS.
- Logout revokes the session — PASS.
- Password recovery uses the recovery code and rotates the code — PASS.
- 10-minute idle timeout logic (short test timeout) locks the session and pauses an active monitor — PASS.
- Authentication setup/login/recovery leave the project JSON bytes unchanged — PASS.
- Authenticated project memory/checklist/decision/session persistence after server restart — PASS.
- Monitoring API access control and interrupted-session recovery — PASS.
- Monitoring-core timer, app-usage summary and privacy script tests — PASS.

## Not yet verified on the user's Windows PC

- Chrome visual rendering of first-run setup, login and recovery screens.
- Manual account setup and recovery code saving.
- Real-time 10-minute inactivity behaviour in the browser.
- Logout/auto-lock pause behaviour with actual PowerShell monitoring active.
- Windows PowerShell snapshot execution after login.

Build tests ran in Linux. Windows-specific PowerShell and actual browser interaction must be checked on the user's PC before final acceptance.
