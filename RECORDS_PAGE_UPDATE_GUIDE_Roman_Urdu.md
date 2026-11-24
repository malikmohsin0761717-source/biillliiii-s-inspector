# Biillliiii's Inspector v0.5.1 — Records Page Update

## Yeh update kya karta hai?
- Records page ab hard-coded sample rows/counts use nahi karta.
- Data current authenticated workspace ke `projects` response se aata hai.
- Sessions, decisions, checklist tasks, aur project memory updates timeline mein dikhte hain.
- Filters: All records, Sessions, Decisions, Tasks, Memory updates.
- Empty workspace par sab category counts 0 aur `No records yet` dikhega.
- Owner-marked checklist task ko `Marked done` kaha jata hai; `Verified` sirf tab jab saved item mein `verified: true` ho.
- Test results ko Records mein nahi dikhaya jata, kyunki app abhi test-run history ko workspace data ke roop mein save nahi karti.

## Apply karne ka safe tareeqa
1. Agar v0.5 server chal raha hai to us Command Prompt mein `Ctrl + C` dabao. Agar `Terminate batch job (Y/N)?` aaye to `Y` likho aur Enter dabao.
2. Is ZIP ko **sirf** `biillliiii_inspector_v5_development` folder mein Extract All karo.
3. Same-name prompt aaye to `Replace the files in the destination` select karo.
4. Is patch mein ye existing files replace hongi:
   - `package.json`
   - `ui\index.html`
   - `ui\app.js`
   - `ui\styles.css`
5. Ye nayi files add hongi:
   - `ui\records-core.js`
   - `tests\records-core.test.js`
6. `data`, `data_fresh`, `data_archive_2026-11-09`, `auth.json`, `projects.json`, `server.js`, `auth.js`, aur `monitoring` folder is patch mein nahi hain—unhein change nahi kiya jayega.
7. Command Prompt mein `npm run check` chalao. Successful ho to normal prompt wapas aayega aur koi error nahi hoga.
8. `npm test` chalao. Records ke 3 naye tests bhi existing suite ke saath chalenge.
9. Fresh workspace ke liye server ko isi command se start karo:
   `set "BI_DATA_DIR=data_fresh" && npm start`
10. Dashboard > Records kholo. Fresh workspace mein expected counts 0 honge aur `No records yet` message aayega.

## Important
- `data_fresh` aur archive files ko manually delete, move, ya edit mat karo.
- Original v0.4 aur uska backup untouched rakho.
- Live Monitoring ko is Records UI patch ke test ke liye start karne ki zaroorat nahi.
