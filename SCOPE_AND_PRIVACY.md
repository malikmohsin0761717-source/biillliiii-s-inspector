# v0.5 Scope and Privacy Boundaries

## Collected only after the user presses Start

- Foreground Windows process name (name only; no window title)
- CPU load percentage
- RAM used percentage and basic memory values
- System drive name and free space
- Timestamp and sample success/failure warning
- User-entered project ID and session goal

Sampling interval: approximately 10 seconds. A running PowerShell snapshot already in progress is allowed to finish before Pause/Stop is finalized, so the UI waits for that current read to complete. New sampling is stopped immediately.

## Not collected in this version

- Browser URLs, tabs, DOM, page text, screenshots or page images
- Window titles, document names or file contents
- Keystrokes, clipboard, camera, microphone or audio
- Email, password, OTP or payment content
- Cloud uploads, analytics or third-party telemetry

Known Windows process names for common email clients, password managers and payment/banking applications are excluded where identifiable. This list cannot identify every custom app. Browser process names may still appear (for example Chrome), but no site or page content is read.

## Controls

- Monitoring can start only after the user submits Start Session.
- Pause stops the sampling interval. Paused time is excluded from active duration.
- Resume restarts sampling.
- Stop & Save finalizes one session record in the selected project.
- One session ID prevents a duplicate record.
- A backup of `data/projects.json` is created before monitoring starts.
- An unfinished session found after a server restart is saved once with `Interrupted` status.
- The app binds to 127.0.0.1 only. No cloud service is connected.

## Important limitations

- This version is Windows-only for live monitoring.
- Application time is approximate because it is based on periodic samples.
- A 10-second interval can miss short app switches.
- It does not prove task completion; it records limited activity metadata only.
- Approved-site browser content monitoring is a later phase and is not enabled here.
- Sensitive process exclusions are best-effort, not a universal guarantee for all applications.


## Owner Authentication (v0.5)

Authentication is local-only. The owner password and recovery code are stored as salted scrypt hashes in `data/auth.json`; plaintext credentials are not written to disk. The recovery code is displayed once at setup and rotated after recovery. The session cookie is HttpOnly and SameSite=Strict, with a 10-minute idle timeout and 12-hour absolute lifetime. Logout/auto-lock pauses a running monitoring session for safety. All project, export, and monitoring APIs require an authenticated session.

This is an application access-control layer, not full-disk encryption. Anyone who can directly read or modify the local files under the Windows user account may still access or alter them. Keep Windows sign-in protected and maintain a separate backup. Cloud authentication and remote access are out of scope.
