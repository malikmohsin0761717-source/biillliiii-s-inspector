# v11.0.1 — Windows Acceptance Test (Roman Urdu)

Yeh guide local automated tests ke baad manual PC/browser checks ke liye hai. Har check user khud kare. Koi cloud login, API activation, extension installation ya monitoring start is guide se automatically nahi hota.

## A. App + local data
1. App ko normal `npm start` se kholo aur Local Owner login karo.
2. Dashboard par Reminders card ka number check karo. Yeh incomplete reminders ki count honi chahiye; `Reminder scheduling is not enabled` nahi dikhna chahiye.
3. Reminders page par ek temporary test reminder banao, Dashboard par wapas jao aur count +1 verify karo. Phir test reminder ko manually delete karo.
4. Important page par ek temporary test note banao. Edit dabao, title aur text badlo, save ke baad updated values check karo. Phir test note delete karo.
5. App refresh karo; asli projects aur login/session normal rehne chahiye.

## B. Browser notifications (optional; separate user choice)
1. Settings par sirf tab Enable browser notifications dabao jab tum browser permission dena chahte ho.
2. Browser prompt ko tum khud review/approve karo. Permission deny karna bhi theek hai.
3. App/browser band hone par background notification guarantee nahi hai. Native Windows notification service is patch ka hissa nahi.

## C. Chrome extension (NOT installed by patch)
- Installation ko abhi skip kar sakte ho. Agar future mein separately approve karo, pehle non-sensitive test domain use karo, per-domain permission review karo, manual capture aur preview check karo. Sensitive pages/forms par test mat karo.

## D. Desktop Inspector (NOT activated by patch)
- Is patch ne agent start nahi kiya. Future separately approved test mein sirf Notepad jaisi non-sensitive app allow karo; password/email/payment apps approve na karo.

## E. Cloud and AI
- Supabase live RLS / two-account test alag authorization aur credentials maangta hai; is patch ne run nahi kiya.
- OpenAI API default OFF hai. Is release test mein koi live OpenAI call nahi hoti.

## Record the result
Har item ko `PASS`, `FAIL`, ya `NOT TESTED` likho. Agar unexpected data, permission prompt, ya error aaye to ruk jao; repeated attempts ya data reset mat karo.
