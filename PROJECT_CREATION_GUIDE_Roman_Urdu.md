# Biillliiii's Inspector v0.5.3 — Project Creation Patch

## Kya naya hoga?

Projects page par **New Project** button ab real form kholega.

Form mein:
- Project Name — required, maximum 120 characters
- Project Type — Learning, Business, Personal, Work, Other
- Project Goal — required, maximum 1,200 characters
- Next Step — optional, maximum 600 characters
- Project Status — Planning (default), Active, On hold, Completed

Project ID server khud banayega: `BI-0001`, `BI-0002`, etc. Client apni taraf se ID force nahi kar sakta.

Save hone par project selected local workspace ke `projects.json` mein save hoga. Naye project ki checklist, decisions, sessions aur memory history empty rahengi. Project count update hoga aur uska detail page khulega. Live Monitoring page par project dropdown mein yeh project available ho jayega; monitoring apne aap start nahi hoti.

## Patch apply karne ka tareeqa

1. v0.5 server wali Command Prompt window mein `Ctrl + C` dabao.
2. Downloaded ZIP par Right Click > **Extract All...** karo.
3. Destination sirf yeh folder rakho:

   `C:\Programs  Pivates\Agent Start\Biillliiii_Inspector_v0.4_Automatic_Sessions\biillliiii_inspector_v5_development`

4. Same-name prompt aaye to **Replace the files in the destination** select karo.
5. Command Prompt mein `npm run check` chalao.
6. Phir `npm test` chalao aur poora result dekho.
7. Fresh workspace use karne ke liye server ko is command se start karo:

   `set "BI_DATA_DIR=data_fresh" && npm start`

8. Browser mein login karo > Projects > **New Project**. Form open hota hai ya nahi check karo.
9. Abhi form submit mat karo jab tak project ki details tayyar na hon. Save karne se naya project `data_fresh/projects.json` mein create hoga.

## Safety

- Patch mein `data`, `data_fresh`, `auth.json`, `projects.json`, `projects.seed.json`, monitoring backups ya `data_archive_2026-11-09` shamil nahi.
- Original v0.4 aur uska backup untouched rahenge.
- Owner Account/password change nahi hota.
- Project create karne ke liye authenticated owner login zaroori hai.
- Project save karne se monitoring start nahi hoti. Monitoring ke liye user ko alag se Start press karna hota hai.
