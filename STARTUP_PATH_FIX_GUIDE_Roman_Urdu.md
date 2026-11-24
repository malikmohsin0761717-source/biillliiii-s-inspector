# Startup Path Display Fix — Roman Urdu Guide

## Is update ka maqsad

Server start hone par ab fixed `data/projects.json` wala message nahi aayega. App jis workspace ko waqai use kar rahi hai, uska full path show hoga.

Agar tum yeh command chalao:

```cmd
set "BI_DATA_DIR=data_fresh" && npm start
```

to startup log mein yeh paths dikhne chahiye:

- `...\data_fresh`
- `...\data_fresh\projects.json`
- `...\data_fresh\auth.json`

Default `npm start` par `data` folder ke paths show honge.

## Apply karne ka tareeqa

1. Running app ko uski black Command Prompt window mein `Ctrl + C` se band karo.
2. ZIP ko extract karo.
3. Destination yeh v0.5 development folder rakho:

```text
C:\Programs  Pivates\Agent Start\Biillliiii_Inspector_v0.4_Automatic_Sessions\biillliiii_inspector_v5_development
```

4. `server.js` ko replace karo aur `tests` ke andar `startup-paths.test.js` add hone do.
5. `npm run check` chalao.
6. `npm test` chalao.
7. Fresh workspace ke liye yeh command use karo:

```cmd
set "BI_DATA_DIR=data_fresh" && npm start
```

8. Startup output mein teeno paths check karo.

## Safety

Yeh patch sirf `server.js` update karta hai aur ek test file add karta hai. Ismein `data`, `data_fresh`, `auth.json`, `projects.json`, archive ya monitoring samples shamil nahi hain. Koi existing data delete, move ya overwrite nahi hota.
