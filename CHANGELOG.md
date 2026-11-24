# Changelog

## v0.5.0 — Automatic local session recording

- Added user-triggered Windows foreground-process and basic system-health sampling.
- Added 10-second sampling interval, Start / Pause / Resume / Stop controls.
- Added automatic session history records under the selected project.
- Added per-session unique IDs and duplicate protection.
- Added approximate app usage, sample count, CPU/RAM averages and warning capture.
- Added pause-aware active duration calculation.
- Added one-time interrupted-session recovery after a server restart.
- Added a pre-session backup of the local project JSON.
- Kept the local-only host restriction and existing project memory API.
- No browser URLs/page contents, window titles, documents, keystrokes, clipboard, camera or microphone capture.
- Package excludes the live `projects.json` file to protect user data during upgrade; copy the existing v0.3 data file before first launch.


## v0.5.0 — Login-First Owner Workspace

- Added first-run owner account setup, login, logout, and recovery-code password reset.
- Added salted scrypt password/recovery hashes in a separate `data/auth.json` file.
- Added HttpOnly, SameSite=Strict session cookie and in-memory sessions.
- Protected project, export, and monitoring APIs; added same-origin mutation checks.
- Added 10-minute idle auto-lock and 12-hour maximum session lifetime.
- Running monitoring is paused when the owner session locks or expires.
- Removed the demo dashboard bypass and delayed project loading until successful authentication.
- Existing `data/projects.json` schema and contents are not migrated or rewritten by owner setup.
