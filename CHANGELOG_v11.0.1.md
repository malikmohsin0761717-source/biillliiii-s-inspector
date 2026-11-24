# Biillliiii's Inspector v11.0.1 — P3–P6 Consolidated Finalization

## Changes
- Dashboard reminder card now reports the number of saved, open reminders and links to reminder management.
- Important personal items can now be edited; server validates title/content and persists the update locally.
- Release version is consistently reported as v11.0.1 by the package, server health/startup, visible UI, and Chrome extension manifest.
- Release verification and regression coverage updated for the new version and Important-item editing.

## Preserved safety defaults
- OpenAI remains disabled by default; no real API calls are made by tests.
- Cloud sync remains manual and requires existing authentication/confirmation.
- Chrome extension and Windows Desktop Inspector remain source-only/manual; this patch does not install or activate them.
- No private workspace data, credentials, .env files, or backups are included.

## Verification boundary
Automated local tests do not replace live Supabase RLS, actual Chrome installation, or Windows UI Automation acceptance. Those remain separate user-controlled checks.
