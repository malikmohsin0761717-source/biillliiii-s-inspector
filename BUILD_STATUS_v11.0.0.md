# v11.0.0 build status

## Source and privacy
- Reconstructed from the Library v0.9 development archive plus the v0.10.0 patch overlay.
- `data/projects.json`, `data/auth.json`, AI histories, archives, monitoring backups, `.env`, and other private runtime files are excluded from the release patch. Only an empty `data/projects.seed.json` is included.
- Fresh-install `data/projects.seed.json` is an empty store; an existing `data/projects.json` is never included or replaced by the patch.

## Automated build verification
- `npm run check`: PASS.
- `npm test`: 62 tests, 62 pass, 0 fail, 0 skipped.
- Includes local/cloud session isolation integration test using a fake Supabase server, reminder/report/backup integration tests, release consistency tests, extension manifest tests and desktop UIA parser tests. Test helpers copy only the empty seed fixture; they never copy the real local data directory.
- Node used in build environment: v22.16.0. User's Windows Node version was previously v24.22.1.

## Not live-verified
- Actual Supabase RLS metadata and two-account test: NOT VERIFIED. Read-only SQL and manual test guide included.
- OpenAI live API request: NOT VERIFIED; API remains disabled by default and no key is included.
- Chrome extension installation and runtime permission acceptance: NOT VERIFIED; source is manual-only and not installed.
- Windows PowerShell UI Automation execution: NOT VERIFIED; no PowerShell runtime was available in build environment.
- Final Windows fresh-install, restart, notification and restore acceptance: must be performed on the user's PC.

## Operational limits
- Local workspace remains single Local Owner account per local data folder.
- Cloud account can view its own RLS-filtered cloud projects and manually sync only when Local Owner is also authenticated.
- Cloud data is not automatically imported into local workspace.
- Reminders notify while the app/browser is open; no background Windows service is installed.
- Browser evidence is manually captured, previewed and pasted; never automatically transmitted.
