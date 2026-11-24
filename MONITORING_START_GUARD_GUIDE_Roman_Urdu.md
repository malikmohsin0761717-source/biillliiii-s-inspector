# Biillliiii's Inspector v0.5 — Monitoring Start Guard

## Is patch mein kya update hota hai?

Sirf v0.5 development folder ke ye code/test files:

- `server.js` — monitoring start se pehle saved project list aur selected project validate karta hai.
- `ui/app.js` — zero projects par Project dropdown, activity field aur Start session button disabled rakhta hai; clear explanation dikhata hai.
- `ui/styles.css` — disabled fields/button aur empty-state message ka visual style.
- `tests/monitoring-api.test.js` — empty workspace aur invalid project ke server-side rejection tests.
- `tests/monitoring-ui.test.js` — disabled UI state ka test.

## Safety

- `data_fresh` patch mein nahi hai.
- `data_archive_2026-11-09` patch mein nahi hai.
- `auth.json` / `projects.json` patch mein nahi hain.
- `monitoring` folder aur monitoring collection code patch mein nahi hain.
- Original v0.4 aur uska backup change nahi honge.
- Patch khud monitoring start nahi karta.

## Apply karne ka tareeqa

1. v0.5 server ko `Ctrl+C` se band karo.
2. ZIP ko Extract All karo.
3. Destination ye folder rakho:
   `C:\Programs  Pivates\Agent Start\Biillliiii_Inspector_v0.4_Automatic_Sessions\biillliiii_inspector_v5_development`
4. Agar Windows same-name prompt dikhaye to **Replace the files in the destination** select karo.
5. Command Prompt mein ye commands chalao:

```cmd
npm run check
npm test
```

Dono ka result review karo. Uske baad Fresh Workspace ke saath server start karna ho to:

```cmd
set "BI_DATA_DIR=data_fresh" && npm start
```

## Expected behaviour

- `data_fresh/projects.json` mein zero projects hon to Start session disabled, project selector/activity input disabled aur explanation visible hogi.
- Server API request ke zariye bhi empty workspace mein monitoring start nahi hogi; response `409` hoga.
- Agar selected project ID saved workspace mein maujood na ho to response `404` hoga.
- Dono blocked cases mein monitoring session ya pre-session backup create nahi hoga.
- Jab tak workspace mein koi real saved project nahi hota, monitoring OFF rahegi.

**Note:** Projects page par project creation functionality is build mein abhi available nahi hai. Isliye abhi Start disabled rehna expected hai. Project creation ko baad ke separately approved development step mein implement kiya ja sakta hai.
