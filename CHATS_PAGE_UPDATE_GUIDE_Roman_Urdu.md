# Chats Page Update — Roman Urdu Guide

## Kya badla hai?

- Chats page par purani 3 example conversations hata di gayi hain.
- Ab `0 conversations` aur `No conversations yet` nazar aayega.
- Saaf likha hoga ke chat syncing connected nahi aur ChatGPT/email conversations automatically read/import nahi hoti.
- Koi chat import, cloud sync, account connection, ya background collection add nahi ki gayi.

## Install karne ka tareeqa

1. v0.5 server ko `Ctrl + C` se band karo.
2. ZIP ko `biillliiii_inspector_v5_development` folder mein Extract All karo.
3. Same-name files ke liye `Replace the files in the destination` select karo.
4. Command Prompt mein `npm run check` chalao.
5. Uske baad `npm test` chalao.
6. Tests successful hon to Fresh Workspace mode mein start karo:

   `set "BI_DATA_DIR=data_fresh" && npm start`

7. Login karke Chats page kholo aur verify karo ke `No conversations yet` show hota hai.

## Safety

Is patch mein `data`, `data_fresh`, `auth.json`, `projects.json`, archive, ya monitoring backups shamil nahi. Original v0.4 aur old archive untouched rehte hain.
