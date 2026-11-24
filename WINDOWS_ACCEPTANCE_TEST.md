# Windows Acceptance Test — Required on the user's PC

This checklist must be completed on Windows 10/11. The build container used for source checks is not Windows and cannot execute the PowerShell foreground-window APIs.

1. Start the local server and open the Live monitoring page.
2. Confirm status is OFF and no sampling starts before the Start button.
3. Select BI-0001 and enter a clear test goal.
4. Press Start. Confirm the app shows RUNNING and a safety backup appears in `data`.
5. Wait at least 22 seconds. Confirm the sample count increases (normally 2–3 samples) and active app / CPU / RAM appear.
6. Switch from Chrome to Notepad for at least 15 seconds. Confirm app usage summary includes both if each was foreground at a sample time. Short switches may be missed.
7. Press Pause. Wait 15 seconds. Confirm sample count remains unchanged and active elapsed time does not increase.
8. Press Resume. Wait at least 12 seconds. Confirm sample count increases again.
9. Press Stop & Save and confirm. Confirm one new `Automatic` session appears under BI-0001 → Session History.
10. Confirm session has a unique ID, duration, samples, average CPU/RAM, approximate app usage, and warning count/list if errors occurred.
11. Refresh the browser and restart the local server. Confirm the same single session remains; no duplicate appears.
12. Confirm manual session entries remain labelled Manual and automatic entries remain Automatic.
13. Start another test, then stop the server without pressing Stop. Start the server again. Confirm the unfinished session appears once with `Interrupted` status.
14. Confirm no window titles, URLs, page text, file contents, keystrokes, clipboard, camera or microphone data appears in the record.

Pass only if all applicable checks succeed. If PowerShell sampling fails, do not call the Windows integration test complete; send the full warning text for debugging.
