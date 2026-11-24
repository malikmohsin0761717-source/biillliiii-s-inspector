# v0.9.0 AI Workspace Completion — Apply Guide

## Is patch mein kya hai?
Yeh patch AI Teacher ke goals/lessons controls, AI history delete controls, aur optional project context sharing add karta hai.

## Apply karne se pehle
1. Apne active project folder ka ek naya backup bana lo. Backup ko project folder ke bahar rakho.
2. Confirm karo ke active project wahi hai jahan `package.json`, `server.js`, `auth.js`, `ai-provider.js`, `ui/` aur `tests/` maujood hain.

## Patch apply
ZIP ko active project folder ke root mein extract karo aur existing files overwrite karne ki Windows confirmation aaye to sirf in teen paths ke liye allow karo:
- `package.json`
- `ui/app.js`
- `ui/styles.css`

ZIP ke Markdown documents sirf changelog/guides hain. `data/`, `data/ai/`, `.env`, `node_modules/`, backups ya kisi aur folder ko replace nahi karna.

## Privacy behavior
- Project context checkbox default OFF hai.
- Project context bhejne ke liye project select karo, checkbox ON karo, phir `Send to AI` dabao.
- Sirf project identity, goal, last completed task, next step aur limited checklist items share hote hain. Notes, decisions aur session records share nahi hote.
- Context conversation history mein save hota hai aur aglay turns mein dobara bheja ja sakta hai.
- OpenAI disabled ho to messages local history mein hi save honge; koi API request nahi bheji jayegi.

## Testing
Tumhari instruction ke mutabiq abhi koi test mat chalao. Tamam implementation complete hone ke baad final combined testing round ek hi martaba hoga.
