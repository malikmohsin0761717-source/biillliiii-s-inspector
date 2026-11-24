# v0.5 — Monitoring Start Guard

- Disabled Project selector, activity input and Start session button when no saved projects exist.
- Added an explanatory empty-workspace message.
- Added client-side form submission guards for empty and unknown projects.
- Added server-side empty workspace (409) and unknown project (404) checks before platform/script checks and before safety-backup creation.
- Added API regression tests that verify no session, store mutation, or monitor backup is created for blocked requests.
- Added a UI guard regression test.
- Does not modify project data, authentication data, archive, or monitoring capture code.
