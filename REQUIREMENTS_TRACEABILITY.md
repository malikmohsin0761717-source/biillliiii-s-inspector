# v0.5 Requirements Traceability

| Requirement | Implementation | Verification |
|---|---|---|
| User must explicitly start monitoring | POST `/api/monitor/start` only from Start Session form | Windows manual acceptance test |
| Select one project per session | projectId stored in active monitor and final session | Core and Windows test |
| Sample foreground process name | `monitoring/windows-snapshot.ps1` | Windows manual acceptance test |
| Sample CPU/RAM/drive health | PowerShell CIM snapshot | Windows manual acceptance test |
| Approximately 10-second interval | Server sampling timer | Windows manual acceptance test |
| Pause stops new samples | Pause endpoint clears timer and awaits current sample | Windows manual acceptance test |
| Paused duration excluded | `activeDurationMs()` | Unit tests |
| Resume continues same session | Resume endpoint reuses same session ID | Windows manual acceptance test |
| Stop creates automatic session entry | Stop endpoint pushes source `automatic-monitoring` | Core tests + Windows test |
| Prevent duplicate records | Unique session ID and duplicate check | Core recovery test; Windows manual test |
| Persist active monitoring state | Active monitor and samples stored in project JSON | Interrupted-recovery integration test |
| Recover server interruption | Startup recovery makes one `interrupted` record | Integration test |
| Keep project data local | JSON data store, localhost-only server | Existing integration tests |
| Keep user data during upgrade | Package excludes personal projects.json; guide requires manual copy | Packaging inspection |
| Exclude page/URL/keyboard/clipboard content | No browser extension or such APIs in v0.5 | Source review |

## Owner Login-First (v0.5.0)

| Requirement | Implementation | Verification |
|---|---|---|
| First-run Owner Account | POST `/api/auth/setup`; one setup only | `auth-api.test.js` |
| Password stored as salted hash | `crypto.scrypt` in `auth.js`; separate `data/auth.json` | Auth file plaintext exclusion test |
| One-time recovery code | Random 40-character code; only salted hash saved; rotates on recovery | `auth-api.test.js` |
| Login and lockout | POST `/api/auth/login`; five failed attempts cause 15-minute lockout | Auth API test and code audit |
| Logout | POST `/api/auth/logout`; session token revoked | `auth-api.test.js` |
| Auto-lock | 10-minute idle timeout; 12-hour absolute lifetime | Idle expiry integration test |
| Dashboard requires login | Client loads projects only after successful login; showDashboard guard | Source review + API tests |
| Project and monitoring API protection | Auth session required before reading project store/routes | Unauthenticated API requests return 401 |
| CSRF/origin checks | allowed loopback Origin + `X-Requested-With` marker for mutations | Cross-origin/missing-marker tests |
| Lock pauses monitoring | Last session expiry/logout pauses running monitor | Idle expiry integration test |
| Project data preserved | Auth file separate from projects JSON | Auth test verifies project JSON bytes unchanged |
| No automatic cloud connection | Local-only server and local JSON storage | Source review |
