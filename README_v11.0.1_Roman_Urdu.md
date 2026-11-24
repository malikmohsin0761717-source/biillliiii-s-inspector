# Biillliiii's Inspector v11.0.1 — Roman Urdu Guide

## Important safety
- Sirf Local Owner login local projects aur private local data unlock karta hai.
- Supabase cloud login akela local projects nahi khol sakta. Manual sync ke liye Local Owner + cloud account dono sign-in hone chahiye.
- OpenAI API default OFF hai. `.env.example` ko dekh kar `.env` sirf tab banao jab tum paid API usage samajh kar alag se enable karna chaho. API usage par charges lag sakte hain.
- Browser extension install nahi ki gayi. Extension folder ko Chrome mein add karna alag action hai. Har domain pe permission aur capture user click se hoti hai.
- Desktop UIA default OFF hai. Settings mein process name approve karna aur manual check dabana zaroori hai.

## Reminders / Alerts
1. Reminders page par title aur due date/time likho.
2. Optional project select karke Save reminder dabao.
3. Alerts page mein next 24 hours aur overdue reminders dikhenge.
4. Browser/Windows notifications ke liye Settings mein Enable browser notifications dabao aur browser permission khud approve karo.
5. App/browser band ho to reminders background mein notify nahi karte.

## Reports
- Reports page saved projects se summary banata hai.
- CSV aur Markdown download real saved counts use karte hain.
- Private notes, AI conversation content, passwords aur API keys report mein include nahi.

## Backup / Restore
- Settings → Download workspace backup.
- Restore ke liye JSON backup select karo aur exact phrase `RESTORE WORKSPACE` type karo.
- Restore se pehle automatic safety backup banta hai.
- Owner auth file aur server `.env` key backup mein nahi hoti. AI chat history backup mein hoti hai; agar tumne chat mein koi private text likha tha to woh bhi backup mein aa sakta hai.

## AI modes
- Chatbot aur Teacher ki local histories separate hain.
- OpenAI request sirf enabled server configuration aur explicit Send/Analyze click par jati hai.
- Default model `gpt-6-luna` hai; API use paid ho sakta hai. `.env` mein API key kabhi browser code mein mat dalo.

## Verification status
- Local syntax/tests automated build environment mein chalaye gaye.
- Live Supabase RLS: user ke actual project par verify karna baqi.
- Windows PowerShell UIA aur Chrome extension: Windows/Chrome par manual acceptance test baqi.
- Extension installation, cloud connection, OAuth, database migration aur API enablement automatically nahi ki gayi.

## Cloud account aur local owner ka farq
- Local Owner login is PC ke local projects, reminders, important notes, reports aur AI histories kholta hai.
- Supabase cloud login akela local files nahi khol sakta.
- Settings mein cloud login ke baad `View my cloud projects` se sirf signed-in account ke RLS-filtered cloud records read-only dekh sakte ho.
- `Review & sync local projects` ke liye Local Owner + cloud login dono chahiye. Sync matching project codes ko update kar sakta hai; is liye confirmation dialog ko dhyan se parho.
- Cloud projects ko local workspace mein automatic import/overwrite nahi kiya jata.

## Chrome extension (manual source only)
1. `browser-extension` folder Chrome Extensions ke Developer mode mein `Load unpacked` se add karna ek alag installation action hai; patch khud install nahi karta.
2. Toolbar icon par click karke current domain ko alag se approve karo.
3. Har page par capture button tumhare click ke baad hi chalega. Forms aur known sensitive pages block hain.
4. Extension JSON preview dikhati hai; app ya AI ko automatic send nahi hota.
5. JSON review karke Inspector page ke evidence box mein paste karo. Sirf `Analyze reviewed evidence with AI` dabane par configured AI endpoint ko bheja jayega.
6. Approved domain remove karne se permission revoke hoti hai.

## Desktop UI Automation
1. Settings mein process names save karo, misaal `notepad, code` ( `.exe` suffix ke baghair ).
2. Inspector mein `Check approved desktop app` manually dabao.
3. UIA sirf supported Text controls read karta hai; window title, keystrokes, screenshots, clipboard aur input values nahi.
4. Password/private apps, password controls aur possible email/OTP/payment text block karne ki koshish hoti hai. Filters perfect guarantee nahi dete; is liye sirf non-sensitive apps approve karo.
5. Unsupported app par `Not verified` / blocked status aa sakta hai.

## Live verification jo abhi baqi hai
- Supabase SQL verification aur two-account RLS test tumhare actual Supabase project mein run karna baqi hai. Existing v0.6.0 migration historical file hai; is patch ne usay automatically run ya rewrite nahi kiya.
- OpenAI live API call nahi ki gayi; API default OFF hai aur key tumhein khud server `.env` mein set karni hogi.
- Chrome extension actual Chrome mein install/test nahi hui.
- Windows UI Automation script is build environment mein execute nahi hui; tumhare Windows PC par pehle non-sensitive test app ke sath acceptance check zaroori hai.

## Windows par one-run release verification

Patch apply hone ke baad project folder mein PowerShell khol kar yeh command chala sakte ho:

```powershell
.\scripts\verify-release.ps1
```

Yeh syntax, 69 automated tests, PowerShell scripts ka parse (execute nahi), extension manifest aur release version check karta hai. Tests temporary folders aur empty seed fixture use karte hain; existing `data/projects.json`, `data/auth.json` aur `.env` ko open/copy/modify nahi karte. Is command se Supabase migration, OpenAI API, extension installation ya desktop monitoring enable nahi hoti.
