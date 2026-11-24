# Deploy: AI setter ready for demos + lead reactivation (24 Nov)

## What's in it

1. **Speed to lead:** new leads get the first message straight away, any time of day (Hours and follow-up, ticked by default). Follow-ups and reactivation still wait for your hours.
2. **Never sends twice:** if the business already messaged the lead in the last 30 minutes (a slow send, or the button clicked twice), the AI doesn't send the first message again. This is the likely cause of the "email not sent" mark in GHL.
3. **Your scripts:** Business tab, **Example replies (your scripts)**. Paste Tolu's scripts there; the AI copies the tone and style.
4. **Lead reactivation:** new **Reactivation** tab. Tag old leads in GHL, check who it would message, start. One friendly message each (with an optional comeback offer), up to 2 follow-ups, 10 to 50 an hour within your hours. Leads booked, stopped, with the team or messaged in the last 14 days are left alone. Stop any time.
5. Conversations show how each one started (Reactivation, Messaged in).

This update has a database change (SQL-12). Do the parts in this order.

## Part 1. Database (Supabase, 2 minutes)

1. Supabase, **SQL Editor**, **New query**.
2. Open **SQL-12 setter_reactivation.txt** in Notepad, **Ctrl+A**, **Ctrl+C**, paste, click **Run**.
3. You should see **Success. No rows returned**.

## Part 2. AI setter code (Supabase, 3 minutes)

1. **Edge Functions**, **ai-setter**, **Code** tab.
2. Click inside, **Ctrl+A**, **Delete**.
3. Paste **ai-setter-code-v10.txt**, click **Deploy updates**.
4. Open https://nldagscfswzzdhxsnygf.supabase.co/functions/v1/ai-setter. It should say **v10**.

## Part 3. Website (Command Prompt, 5 minutes)

Leave **setter-demo-ready.zip** in Downloads. Paste each line, press Enter, and check each starts with `cd`, `git` or `tar`:

```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b setter-demo-ready
tar -xf %USERPROFILE%\Downloads\setter-demo-ready.zip
git add -A
git commit -m "AI setter demo-ready: instant first message, no double sends, scripts, lead reactivation"
git push -u origin setter-demo-ready
```

After `git commit` you must see **files changed**. Then open https://github.com/tolu-scalency/scalency-os/pull/new/setter-demo-ready, **Create pull request**, **Merge pull request**, **Confirm merge**, and wait for **Published** in Netlify.

## Part 4. Get the demo ready (20 minutes)

1. **Business tab:** Location and Time zone (not Austin), real booking link, paste any scripts you have. **Save**.
2. **Hours and follow-up:** check **Message new leads straight away, any time** is ticked. **Save**.
3. **Demo by text, not email**, until a sending domain is set up in GHL. Put your own phone number on the test contact.
4. Test: new GHL contact with your phone, tag **ai-test**, add to **AI setter: new lead**. Reply, pick a time, check the booking lands in the GHL calendar.
5. **Reactivation test:** tag 2 or 3 of your own test contacts (each also tagged **ai-test**) with `reactivate-test`. Reactivation tab, tag `reactivate-test`, **Check who it would message**, **Start reactivation**. The first message goes within a few minutes.

## If something's wrong

- Website: revert the merged pull request on GitHub.
- AI setter: paste **ai-setter-code-v9.txt** back and **Deploy updates**.
- SQL-12 only adds a column and widens a check. It's safe to leave in place.
