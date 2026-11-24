# v0.5 Patch Apply Guide — Roman Urdu

**Yeh ZIP full application backup nahi; source patch hai.** Isay sirf `biillliiii_inspector_v5_development` ke existing root folder par extract karein.

1. v0.5 server agar chal raha ho to `Ctrl+C` se band karein.
2. Patch ZIP par right-click → `Extract All` karein.
3. Destination ke liye apna existing `biillliiii_inspector_v5_development` folder select karein — uske andar koi naya nested folder na banayein.
4. Extract ke baad overwrite prompt aaye to listed source files ke liye overwrite allow karein.
5. `data` folder mein kuch overwrite nahi hoga; patch mein `data/projects.json`, `data/auth.json`, ya koi `data` file shamil nahi.
6. v5 folder ke Command Prompt mein `npm run check` chalayein.
7. Agar successful ho to `npm test` chalayein. Expected result: 12 tests pass.
8. Dono checks pass hon to `npm start` chalayein aur `http://127.0.0.1:4177` kholo.
9. Pehli baar Owner Account setup karein. Recovery code ko save kiye baghair continue na karein.

**Kabhi bhi patch ZIP ko original `biillliiii_inspector_v4` ya `biillliiii_inspector_v4_TESTED_BACKUP` folder par extract na karein.**
