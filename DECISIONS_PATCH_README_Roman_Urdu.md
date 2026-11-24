# Biillliiii Inspector — Decisions Feature Patch

## Is patch mein kya add hota hai?

1. Decision ke saath optional reason save karna (maximum 2,000 characters).
2. Existing decision ka text aur reason edit karna.
3. Delete se pehle confirmation; sirf selected project ka decision delete hota hai.
4. Edit hone par `updatedAt` timestamp save hota hai.
5. Project Markdown export mein decision ki reason bhi aati hai.
6. Purane decisions jin mein reason field nahi, woh bhi supported rehte hain.

## Apply karne ka safe tareeqa

1. Biillliiii Inspector server band karein (`Ctrl+C`).
2. ZIP extract karein. `apply-decisions-patch.js` ko apne current v0.5 development folder ke root mein copy karein. `tests/decisions-feature.test.js` ko apne project ke `tests` folder mein copy karein.
3. Command Prompt usi development folder mein kholein.
4. Yeh command chalayein:

```cmd
node apply-decisions-patch.js
```

5. Script pehle exact code anchors aur JavaScript syntax check karti hai. Agar current source structure match na kare to files change kiye baghair STOP karegi.
6. Successful apply par `decisions-patch-backup-...` folder mein original `server.js`, `ui/app.js`, `ui/styles.css` ki backup copies banengi.
7. Script sirf in 3 source files ko update karti hai. `data`, `auth`, Owner Account, `projects.json`, `data_fresh`, archive aur monitoring data ko read/write nahi karti.

## Important compatibility note

Yeh patch supplied v0.5.5 source structure ke against tayyar hua hai. Agar current v0.5.6 Checklist patch ne same UI/API sections ko badla hai to patcher safe STOP karega; woh files ko force-overwrite nahi karega. STOP aaye to output share karein; manually merge karne ki zaroorat nahi.

## Verification after apply

Development folder mein:

```cmd
node --check server.js
node --check ui/app.js
npm test
```

`npm test` ka complete result share karein. Automated suite pass hone ke baad Decisions tab ka browser acceptance test karenge. Koi real decision add/delete karne ki zaroorat nahi; temporary test project/test data use karna hoga aur pehle uski exact approval li jayegi.

Patch ke baad focused source/UI checks:

```cmd
node --test tests/decisions-feature.test.js
```

Expected focused checks: 3 pass. Yeh source/UI wiring checks hain; complete API/browser acceptance ka substitute nahi.
