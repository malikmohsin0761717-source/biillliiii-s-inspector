# v0.8.0 — Secure AI Backend Foundation

## Is patch mein kya hai?
- AI Chatbot aur AI Teacher ke liye alag server-side instructions.
- Owner-login protected OpenAI Responses API routes.
- API requests default mein band hain. Jab tak server par `OPENAI_API_ENABLED=true` aur `OPENAI_API_KEY` dono na hon, koi OpenAI request nahi ja sakti.
- Is patch mein koi API key, `.env` file, paid request, Supabase upload, ya live connection shamil nahi.
- OpenAI request ka provider-side storage `store:false` hai. Local conversation history app ke apne computer par hi rahegi.

## Important permission boundary

Yeh code foundation hai, API activation nahi. API key banana/lagana, paid API usage enable karna, ya pehli live request bhejna alag approval maangta hai. Is waqt `OPENAI_API_ENABLED` ko true na karein aur API key add na karein.

## Patch apply karne ka safe tareeqa
1. Current active project ka backup rakhein.
2. ZIP ko pehle alag temporary folder mein extract karein.
3. ZIP ke andar diye gaye files ko unke matching relative paths par active project mein copy/replace karein.
4. `data`, `data_archive_*`, `data_fresh`, `.env`, `node_modules`, aur backups ko kabhi replace na karein. Is patch mein in folders/files ka content shamil nahi hona chahiye.
5. Final testing implementation ke end par combined taur par hogi, jaisa user ne kaha hai.

## API settings (future, separate approval only)
- `OPENAI_API_ENABLED=false` (default; keep disabled)
- `OPENAI_API_KEY=` (blank; do not add until separately approved)
- `OPENAI_MODEL=gpt-6-astra` (configurable model name)

API key sirf server environment mein rahegi, browser code mein nahi.

## Login refresh fix

- Browser refresh par local owner login barqarar rahega.
- Manual Logout ab bhi session clear karega.
- 10-minute inactivity timeout aur 12-hour maximum session lifetime unchanged hain.
- Yeh refresh persistence us waqt tak hai jab local server process chal raha ho; server restart ke baad purana in-memory session dobara valid nahi hota aur login ki zaroorat ho sakti hai.
