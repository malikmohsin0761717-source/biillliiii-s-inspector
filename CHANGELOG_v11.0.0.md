# Biillliiii's Inspector v11.0.0 — Consolidated workspace release

## P0 — Security and ownership
- Local Owner session is now mandatory for local project, AI history, monitoring, reminder, report, settings and backup APIs.
- Supabase login alone no longer unlocks the local JSON workspace.
- Manual cloud sync requires both local Owner authentication and a separate cloud session.
- Existing Supabase RLS migration is retained as historical migration; read-only live-verification SQL and a two-account test guide are included.

## P1 — Version consistency
- Package, server health/startup, app console and UI footers now report v11.0.0.
- Historical migrations and old changelogs retain their original version labels rather than being rewritten.

## P2 — AI Chatbot, AI Teacher and work analysis
- Separate Chatbot and Teacher instructions/histories remain intact.
- Added a read-only evidence analyst mode for manually reviewed browser/desktop evidence.
- OpenAI stays disabled unless `OPENAI_API_ENABLED=true` and a server-side key are explicitly configured.
- Default model is `gpt-6-luna`; API usage may incur charges. No API key is included.

## P3 — Core features
- Added persistent local reminders, due/overdue alerts, optional browser notifications, real project summary reports and CSV/Markdown downloads.
- Added settings for approved desktop process names.
- Added workspace backup/restore for projects, reminders, settings and AI histories. Restore requires an exact confirmation phrase and creates a pre-restore safety backup. Owner credentials and API keys are excluded.

## P4 — Agent capabilities
- Added a manual-only Chrome Manifest V3 extension source. It asks permission per origin, blocks forms/sensitive page patterns, captures visible text only, and displays a reviewable JSON preview. It does not auto-send or run in the background.
- Added manual Windows UI Automation source for explicitly approved app process names. Password/sensitive controls and known private apps are blocked; unsupported apps return a clear status.
- No extension installation, Native Messaging registration, agent installation, background monitoring, or permission grant is performed.

## P5 — Release validation
- Added feature/security tests and a Windows acceptance checklist.
- Live Supabase two-account verification and actual Windows UIA/Chrome acceptance remain user-side checks.
