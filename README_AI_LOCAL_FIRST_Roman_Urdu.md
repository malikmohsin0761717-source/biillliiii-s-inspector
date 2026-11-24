# Inspector AI Suite v0.7.0 — Local-first foundation

## Is patch mein kya hai
- Sidebar mein separate AI Chatbot aur AI Teacher pages.
- Dono modes ki conversation history alag JSON files mein local `data/ai/` ke andar save hoti hai.
- AI Teacher ka learning notes/progress alag file mein save hota hai.
- APIs local owner session ke peeche protected hain (local ya authenticated cloud owner session).
- Conversations aur messages ki length/count limits hain; JSON writes temporary file + rename se hoti hain.
- Existing `projects.json`, `auth.json`, monitoring aur project records ko AI feature update nahi karta.

## Important limitation
Yeh milestone **AI conversation notebook + local persistence** hai. Abhi OpenAI API connected nahi; is liye user message save hota hai aur UI clearly batati hai ke AI reply abhi available nahi. Koi API key, paid request, external transmission ya cloud upload nahi hota.

## Local files
- `data/ai/chatbot/conversations.json`
- `data/ai/teacher/conversations.json`
- `data/ai/teacher/learning-progress.json`

Yeh files first use par banengi. Patch ZIP mein `data/`, `.env`, owner credentials ya user history shamil nahi.

## Apply
Extract ZIP, phir uske andar ki `server.js`, `package.json`, `ui/` aur `tests/ai-local-storage.test.js` files ko active v0.6.0 project mein matching paths par copy/replace karein. `data/` ko copy/replace na karein. Pehle se banaya hua project backup safe rakhein.

## Verification
Project folder mein:
```powershell
npm.cmd test
npm.cmd run check
```
AI tests local owner login ke baad separate storage verify karte hain. Live browser verification user ke system par agla step hai.
