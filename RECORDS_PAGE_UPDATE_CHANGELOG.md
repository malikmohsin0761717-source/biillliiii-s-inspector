# v0.5.1 Records Page Update

- Replaced fixed illustrative activity rows and sample counters with records derived from authenticated project data.
- Added real filters for sessions, decisions, checklist tasks, and memory updates.
- Added empty-state handling and dynamic category counts.
- Task completion is labelled `Marked done` unless the persisted item explicitly has `verified: true`.
- Added a small reusable records core module and unit tests.
- No server, authentication, monitoring, or project-data schema changes.
