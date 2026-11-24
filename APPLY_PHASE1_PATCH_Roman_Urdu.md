# Phase 1 Patch Apply Guide (Roman Urdu)

## Pehle safety
- Yeh patch `v5_development` ke code files update karta hai.
- Apna existing `data` folder, `data_archive_*`, `data_fresh`, `.env`, backups aur `node_modules` bilkul replace na karein.
- Patch ZIP mein koi personal `data` folder ya `.env` file shamil nahi.
- Apply karne se pehle active project folder ki ek separate backup copy bana lein.

## Apply karne ka tareeqa
1. ZIP extract karein.
2. Extracted patch ke andar jo files/folders hain unhein active `biillliiii_inspector_v5_development` folder mein copy karein.
3. Windows pooche ke matching code files replace karni hain to sirf backup banane ke baad replace allow karein.
4. `data` folder ko merge/replace karne ki zaroorat nahi; patch mein data folder nahi hai.
5. `.env.example` sirf template hai. Isay `.env` banakar bharna optional hai; Supabase configuration alag step hai.
6. Supabase migration file sirf tayyar ki gayi hai. SQL Editor mein khud se run na karein jab tak uska separate review/approval na ho.

## Patch ke baad
`npm start` se app launch hoti hai. Supabase variables na hon to local owner login pehle ki tarah kaam karta rahega. Cloud login tab tak available nahi hoga jab tak `.env`, Supabase Email provider, redirect URL aur migration configure na hon.

Automated local tests patch build par 32/32 pass hue. Yeh live Supabase, Google OAuth provider ya RLS behavior ka proof nahi hai.
