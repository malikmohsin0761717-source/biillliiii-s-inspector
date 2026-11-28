# Biillliiii Inspector Cloud Operations Guide

## Production

- Application: https://biillliiii-inspector-cloud-app.vercel.app
- Supabase project: `bvfxuagbnkzutcyzgjap`
- Cloud data is owner-scoped through Supabase Row Level Security.
- Local project files, local AI histories, and Windows monitoring are not automatically uploaded.

## Supabase Auth URLs

Open Authentication → URL Configuration:

1. Set Site URL to `https://biillliiii-inspector-cloud-app.vercel.app/`.
2. Add `https://biillliiii-inspector-cloud-app.vercel.app/**` to Redirect URLs.
3. For local PC testing, also add `http://localhost:4177/**` and `http://127.0.0.1:4177/**`. If using the older local dev port, add `http://localhost:3000/**` too.
3. Keep email confirmation enabled.

## Email delivery

Supabase's built-in SMTP is best-effort and limited to 2 emails per hour. It can restrict recipients to organization-authorized addresses. Use custom SMTP for dependable production delivery.

1. Create/choose a transactional email provider (for example Resend, Brevo, Postmark, or AWS SES).
2. Verify a sending domain and configure its SPF/DKIM records with the DNS provider.
3. Open Supabase Authentication → SMTP Settings.
4. Enable custom SMTP and enter the provider's host, port, username, password, sender address, and sender name.
5. Keep SMTP credentials only in Supabase settings. Never put them in browser code or chat.
6. Test a password recovery email to an account you control; verify Inbox and Spam.

A repeated signup for an already registered email does not create another account or guarantee a new confirmation email. Use Log in, Forgot password, or the new Resend verification email control when the original signup is still awaiting confirmation. Passwords are never sent in email. Supabase's default email sender is best-effort and rate-limited; custom SMTP is required for dependable delivery.

## Cloud AI

Cloud AI responses remain disabled unless both server-side Vercel Production variables are set:

- `OPENAI_API_ENABLED=true`
- `OPENAI_API_KEY=<secret>`

Optionally set `OPENAI_MODEL` to a model enabled for the API account. Do not add the key to `cloud/`, client JavaScript, Supabase publishable configuration, or repository files.

After setting Production variables, redeploy and check the AI readiness indicator in AI Chatbot, AI Teacher, and AI Project Inspector. A user prompt is retained in the user's own cloud history even when the AI provider is disabled.

## Cloud workspace data

- Projects: owner-authenticated CRUD in `public.projects`.
- Chatbot and Teacher: separate conversations in `public.ai_conversations`.
- Teacher goals and completed lessons: `public.ai_teacher_progress`.
- Records, Chats, Important, Stopped, Reminders, Alerts, Reports, and Settings notes: owner-scoped `public.workspace_documents`.
- All tables have Row Level Security enabled and owner-only policies.

## Windows monitoring

Live Monitoring of the user's Windows processes and desktop remains a local PC feature. Open the local Inspector from the cloud page on the same PC. Remote pairing or a background agent is not silently enabled.

## Verification

Run the CI workflows on GitHub after changes:

- Biillliiii Inspector CI
- Cloud Phase 3 checks

Production deployment is served by Vercel from the `main` branch. Verify the root page and `/api/cloud-auth/status` after each release.

## Apply the local PC auth fix

The repository includes `APPLY_LOCAL_AUTH_FIXES.ps1`. It updates only `cloud-auth.js`, `ui/app.js`, `ui/styles.css`, and the two cloud-auth tests. It creates a timestamped code backup, verifies SHA-256, runs `npm run check` and `npm test`, and restores the previous code files if verification fails. It does not copy or overwrite `.env`, `data/projects.json`, or `data/auth.json`.

1. Open the private GitHub repository, choose **Code → Download ZIP**, and extract it.
2. Open PowerShell in the extracted repository root.
3. Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\APPLY_LOCAL_AUTH_FIXES.ps1
```

The script defaults to the known local project folder. If the project is in a different folder, pass `-TargetPath "FULL\\PATH\\TO\\biillliiii_inspector_v5_development"`.
