# Biillliiii's Inspector v0.5.3 — Project Creation Build Status

## Implemented

- Real New Project button and inline creation form on the Projects page.
- Fields: required project name, type, required goal, optional next step, and status.
- Server-side authenticated `POST /api/projects` endpoint.
- Server-generated sequential IDs (`BI-0001`, `BI-0002`, etc.); client-provided IDs are ignored.
- Server validates text lengths, supported project types/statuses, and a workspace project limit.
- New project records start with empty checklist, decisions, sessions, and memory history.
- New project is saved to the currently selected local data directory (`BI_DATA_DIR`).
- UI refreshes project count and opens the new project after save; the monitoring selector can then use it.
- User-entered project-card fields are HTML-escaped before rendering.
- Added project creation API and UI regression tests.

## Validation performed in build workspace

- `npm run check` — PASS.
- `node --test tests/projects-api.test.js tests/projects-ui.test.js` — 3/3 PASS.
- API integration test covers unauthenticated rejection, invalid name/type/status, server-generated IDs, sequential ID assignment, empty record initialization, and disk persistence in an isolated temporary workspace.

Run the complete `npm test` suite after applying the patch on the user's Windows project, because that folder contains the full Windows monitoring implementation and existing regression tests.

## Data protection

The patch does not contain `data`, `data_fresh`, `auth.json`, `projects.json`, seed data, monitoring backups, or the old archive. Creating a project changes only the project store selected by `BI_DATA_DIR` when the user submits the form.
