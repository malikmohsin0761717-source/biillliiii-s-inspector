# v0.5.1 Test Isolation Fix

## Is patch ki zaroorat kyun pari?
- `BI_DATA_DIR=data_fresh` CMD mein set rehne se child test servers temporary test folder ke `data` ki bajaye `data_fresh` use kar rahe thay.
- Real development `data/auth.json` test fixture mein copy ho raha tha, jis se Owner Setup test pehle se configured account dekh sakta tha.

## Is patch mein kya change hai?
- Teen test files ke temporary server processes explicitly `BI_DATA_DIR=data` use karte hain.
- Temporary test fixtures mein copied `auth.json` remove hota hai, sirf temporary folder ke andar.
- Tumhare actual `data`, `data_fresh`, `data_archive_2026-11-09` aur auth files ko touch nahi kiya jata.

## Apply
1. v0.5 server band karo (`Ctrl+C`, phir `Y` agar poochhe).
2. ZIP ko sirf `biillliiii_inspector_v5_development` root folder mein extract karo.
3. `Replace the files in the destination` select karo.
4. `npm run check`, phir `npm test` chalao.
5. Test processes ab inherited `BI_DATA_DIR=data_fresh` ignore karke temporary `data` fixture use karenge.

Yeh patch sirf `tests/auth-api.test.js`, `tests/local-memory.test.js`, aur `tests/monitoring-api.test.js` update karta hai. Application runtime files aur user data change nahi hote.
