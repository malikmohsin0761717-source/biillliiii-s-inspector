# Biillliiii Inspector v0.8.0 — Secure AI Backend Foundation

- Added separate server-side OpenAI instruction sets for AI Chatbot and AI Teacher.
- Added an owner-protected Responses API endpoint for each mode.
- API requests are disabled by default. `OPENAI_API_ENABLED=true` and a server-only `OPENAI_API_KEY` are both required before any request can be sent.
- No API key is included, no `.env` file is created or changed, and no live API request is made by this patch or its tests.
- Responses API requests use `store:false`, a configurable model, bounded message history, bounded output, a timeout, and a local per-minute request cap.
- Local histories remain separate and are not automatically uploaded to Supabase.
- Browser refresh login persistence is intentionally not changed; it is deferred to the next version as agreed.
- Fixed local owner login persistence across browser refresh. Manual logout remains available; the existing 10-minute inactivity timeout and 12-hour maximum session lifetime remain unchanged.
- Removed duplicate AI page history/submit listeners so one user submit produces one save/send flow.
