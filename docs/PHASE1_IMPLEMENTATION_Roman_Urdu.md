# Phase 1 — Email/Google Auth + Supabase RLS (v0.6.0)

## Kya implement hua
- Existing local owner login, recovery code, lockout aur timeout barqarar.
- Optional Supabase email signup/login/password-reset request.
- Google OAuth ka PKCE authorization/callback flow.
- Cloud session opaque HttpOnly SameSite=Strict cookie mein; access/refresh tokens browser localStorage mein nahi.
- Cloud-authenticated session existing local workspace APIs ko unlock kar sakta hai; local JSON data local hi rehta hai.
- Settings mein manual cloud sync control. Sync se pehle exact project count aur existing matching cloud records update hone ki confirmation aati hai.
- Supabase projects table ke liye owner-scoped RLS SQL migration.
- No service-role key, no automatic data migration, no automatic sync.

## Abhi kya nahi hua
- Aapke Supabase project se koi connection nahi kiya.
- SQL migration run nahi ki.
- Google provider enable/configure nahi kiya.
- Local `data/projects.json` upload nahi ki.
- Do alag Supabase users ke saath live RLS isolation test nahi hua.
- Cloud sync one-way manual upsert hai; cloud se local download/merge abhi shamil nahi.

## Local configuration (jab aap alag se tayyar hon)
1. Supabase dashboard mein Project URL aur Publishable key hasil karein.
2. Project root mein `.env.example` ki copy `.env` naam se banayein.
3. Sirf `SUPABASE_URL` aur `SUPABASE_PUBLISHABLE_KEY` values fill karein. `service_role` ya secret key kabhi yahan na rakhein.
4. Supabase Auth mein Email provider enable karein. Email confirmation policy apni marzi se set karein.
5. Google provider tabhi enable karein jab Google OAuth Client ID/Secret Supabase dashboard mein khud configure karne ka alag approval/decision ho.
6. Supabase Auth URL Configuration mein Site URL `http://127.0.0.1:4177` aur Redirect URL `http://127.0.0.1:4177/api/cloud-auth/callback` allow karein.
7. SQL migration ko review karke hi Supabase SQL Editor mein manually run karein: `supabase/migrations/202611160001_phase1_projects_rls.sql`.
8. `npm start` chalayein. `.env` automatically read hogi (Node 20.6+).

## Data safety
- Existing local `data` folder ko patch se replace nahi karna.
- Migration cloud mein empty table create karti hai; local files par asar nahi.
- Manual sync mein matching `project_code` wali cloud row update ho sakti hai. Sync confirmation ko dhyan se parhein.
- Supabase dashboard ka SQL execution aur Google OAuth provider setup user-controlled separate actions hain.
