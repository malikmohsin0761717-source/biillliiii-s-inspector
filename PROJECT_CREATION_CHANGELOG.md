# v0.5.3 — Local Project Creation

- Replaced the Projects page's non-functional New Project toast with a working inline creation form.
- Added required project name, type, and goal fields; optional next step; and project status selection.
- Added authenticated `POST /api/projects` with server-side validation.
- Project IDs are generated on the server (`BI-0001`, `BI-0002`, etc.); client-provided IDs are ignored.
- New projects start with empty checklist, decisions, sessions, and memory history.
- Projects save only to the currently selected local data directory (`BI_DATA_DIR`).
- Newly created projects update the UI and become selectable on Live Monitoring; monitoring does not auto-start.
- Project-card fields supplied by the owner are HTML-escaped before rendering.
- Added project creation API and UI regression tests.
- No personal data, authentication file, archive, or monitoring capture logic is included in this patch.
