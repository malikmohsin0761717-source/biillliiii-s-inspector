# Biillliiii's Inspector v0.5 — Roman Urdu Start Guide

## v0.5 mein kya naya hai?

- First launch par local Owner Account setup hota hai.
- Uske baad dashboard se pehle Login screen aati hai.
- Password aur recovery code salted `scrypt` hashes ki form mein alag `data/auth.json` file mein save hote hain; plain password save nahi hota.
- Project, memory, checklist, decisions, exports aur monitoring APIs login ke baghair access nahi hotin.
- Login cookie `HttpOnly` aur `SameSite=Strict` hai.
- 10 minute user inactivity par workspace auto-lock hota hai; 12 ghante maximum session lifetime hai.
- Logout ya auto-lock ke waqt agar Windows monitoring chal rahi ho to safety ke liye pause hoti hai. Dobara login ke baad use manually Resume karna hoga.
- Password recovery ke liye one-time recovery code use hota hai. Successful recovery ke baad naya code issue hota hai.
- Existing local project data `data/projects.json` mein hi rehta hai. Authentication alag `data/auth.json` mein hai.
- Cloud, Google/Facebook login, multi-user aur browser extension is build mein nahi hain.

## Patch install karne se pehle

1. Original v0.4 aur `v0.4_TESTED_BACKUP` folders ko bilkul untouched rakhein.
2. Sirf `biillliiii_inspector_v5_development` folder par kaam karein.
3. Agar v0.5 server chal raha hai to Command Prompt mein `Ctrl+C` dabayein. Agar `Terminate batch job (Y/N)?` aaye to `Y` aur Enter karein.
4. Patch ZIP ko extract karte waqt destination **v5 development folder** select karein. ZIP ke andar files root par hain; unhein isi folder ke andar merge/overwrite karna hai.
5. Windows overwrite confirmation de to existing source files overwrite karne ki permission dein. Patch ZIP mein `data` folder ya `projects.json` shamil nahi, isliye project records overwrite nahi honge.

## First verification

v5 development folder ke Command Prompt mein:

```cmd
npm run check
```

Syntax check complete hone par:

```cmd
npm test
```

Expected: 12 tests pass. Windows PC par non-Windows-only guard test skip ho sakta hai; isay failure nahi samjha jata.

## App start karna

```cmd
npm start
```

Browser mein yeh local address kholo:

`http://127.0.0.1:4177`

### Pehli dafa

1. Owner username set karo (3–32 characters; letters, numbers, dot, underscore aur hyphen).
2. Password kam az kam 12 characters ka rakho. Aisi passphrase choose karo jo kisi doosre account par use na hoti ho.
3. Password confirm karo.
4. Create Owner Account dabao.
5. App ek 40-character recovery code sirf ek dafa dikhayegi. Isay likh kar ya trusted password manager mein save kar lo.
6. Checkbox tick karke confirm karo ke recovery code save kar liya. Phir Login screen par jao.
7. Apne Owner username aur password se login karo.

**Recovery code bohat zaroori hai:** Password bhoolne par isi se reset hoga. App isay baad mein dobara display nahi kar sakti. Recovery ke baad purana code invalid aur naya code issue hota hai.

## Normal use

- Har fresh app page launch par dobara Owner Login zaroori hai. Agar previous browser session abhi active ho, nayi page load usay lock karegi aur chalti monitoring ko safety ke liye pause karegi.
- Login ke baad hi project data load hoga.
- Top bar ka **Lock / Logout** button workspace lock karega.
- 10 minute tak mouse/keyboard/touch activity na ho to workspace auto-lock hoga.
- Running monitoring logout/auto-lock par pause ho jati hai. Login ke baad Live Monitoring page se manually Resume kar sakte hain.
- Server restart ke baad dobara login karna hoga; server-side sessions memory mein rehte hain.

## Security aur privacy ki limitations

- Server sirf `127.0.0.1` par listen karta hai.
- Mutation API requests same-origin marker aur allowed local Origin check karti hain.
- Password/recovery code ka plain text disk par save nahi hota; `data/auth.json` mein salted hashes hote hain.
- `data/projects.json` abhi plain JSON file hai; v0.5 usay encrypt nahi karta. Login application/API access control hai, full-disk/file encryption nahi. Windows account password aur device security zaroori hain.
- Jis shakhs ko tumhare Windows account ya project folder ka direct access hai, woh local files ko directly read/modify kar sakta hai. Is threat ko login screen akeli prevent nahi karti.
- HTTP local loopback par use hota hai, isliye session cookie par `Secure` flag nahi lagaya gaya; cookie `HttpOnly` aur `SameSite=Strict` hai.
- Agar recovery code kho jaye aur password bhi bhool jao, account recovery manually `data/auth.json` ko rename/reset karne se hi possible hogi. Yeh local filesystem access ka limitation hai; isse project data delete nahi hota, lekin account dobara setup karna padta hai.

## v0.5 mein kya nahi hai?

- Cloud login ya remote access
- Google/Facebook OAuth
- Multi-user roles
- Projects JSON encryption
- Approved website/page-content reading
- AI analysis ya automatic task judgement
- Screenshot, keylogging, clipboard, camera ya microphone monitoring


## v0.6.0 — Phase 1 Auth + Cloud Security
Is version mein optional Supabase email login, Google OAuth PKCE, password recovery, aur owner-scoped RLS migration ka code tayyar hai. Local owner login fallback hai. Supabase connection, SQL run, Google provider setup aur existing local data upload automatic nahi hain. Tafseel ke liye `docs/PHASE1_IMPLEMENTATION_Roman_Urdu.md` dekhein.
