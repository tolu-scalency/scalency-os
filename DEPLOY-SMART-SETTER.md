# Deploy: smarter AI setter, slimmer builder, short links, QR codes (24 Nov)

## What's in it

1. **AI setter**
   - Reads the lead before writing: source, ad or campaign, the page they were on, every form answer with its real question name, tags, and extra details on their Scalency contact. It mentions what they asked for and recommends the best-fitting service.
   - **How the AI gets them booked** (Business tab): offer 2 times, send the booking link, or both.
   - It never says "booked" unless the booking really went through. In the Test chat, bookings say "Test booking only (pretend calendar, nothing was booked)".
   - **When the AI joins** (Hours and follow-up tab): message new leads or not; answer anyone or only people it has messaged; only or never contacts with certain tags; how long it steps back after a team member replies.
   - Waits at least 10 seconds before answering (the Test chat waits too, with an "Answer now" link).
   - If the lead messages first ("hey"), it answers that first.
   - Shorter webhook addresses. The old ones keep working.
2. **Workflow builder:** one slim bar at the top with Draft/On, Approve and turn on, zoom, Full screen, Settings and Save. The workflow ID and Archive are in Settings.
3. **Short IDs and links:** links like /agents/f5991866 instead of the full long code. IDs show their first 8 characters, and the copy button still copies the whole ID. Old long links still work.
4. **Sites menu:** Websites and Domains are live. New **Domains** page lists every domain with its status and lets you add one. New **QR codes** page: pick a page, form or any web address, download PNG or SVG, with scans tagged as source "qr".
5. **Opportunities menu:** Opportunity list is live (the pipeline as a sortable list), with **Export to spreadsheet (CSV)**.

No database change this time.

## Part 1. AI setter code (Supabase, 3 minutes)

1. Supabase, **Edge Functions**, **ai-setter**, **Code** tab.
2. Click inside the code, **Ctrl+A**, **Delete**.
3. Open **ai-setter-code-v9.txt** in Notepad, **Ctrl+A**, **Ctrl+C**.
4. Click in the empty editor, **Ctrl+V**, then **Deploy updates**.
5. Open https://nldagscfswzzdhxsnygf.supabase.co/functions/v1/ai-setter. It should say **v9**.

## Part 2. Website (Command Prompt, 5 minutes)

Leave **smart-setter.zip** in Downloads. In Command Prompt, paste each line and press Enter. Check each line starts with `cd`, `git` or `tar` before pressing Enter.

```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b smart-setter
tar -xf %USERPROFILE%\Downloads\smart-setter.zip
git add -A
git commit -m "Smarter AI setter, slim builder bar, short links, QR codes, domains, opportunity list"
git push -u origin smart-setter
```

Check: after `git checkout -b` you see **Switched to a new branch**, and after `git commit` you see a number of **files changed** (not "nothing to commit"). If not, stop and send a screenshot.

Then open https://github.com/tolu-scalency/scalency-os/pull/new/smart-setter, click **Create pull request**, **Merge pull request**, **Confirm merge**. Netlify: wait for **Published** (this one takes about 4 minutes, as it installs the QR code tool).

## Part 3. Set up and test (15 minutes)

1. **AI setter, Business tab:** add your booking link and choose **How the AI gets them booked**. Change Location and Time zone if they still say Austin. **Save**.
2. **Hours and follow-up:** look at **When the AI joins**. For the pilot: message new leads ON, answer anyone, never tag `customer`, step back until handed back. **Save**.
3. **Connect GHL, step 3:** click **Show the webhook addresses**. They're shorter now. Optional: paste them into your 3 GHL workflows (the old ones keep working).
4. **Test chat:** reply "yes" and watch it wait, then offer times or the link.
5. **Real test:** in GHL, fill in your lead form as a new contact with the tag **ai-test**. The first message should mention what you picked in the form.
6. **Workflows:** open one. The top is now one bar. **Settings** shows the ID and Archive.
7. **Sites, QR codes:** make a code, scan it with your phone.
8. **Sites, Domains** and **Opportunities, Opportunity list:** check they open, and try **Export to spreadsheet**.

## If something's wrong

- Website: on GitHub open the merged pull request, click **Revert**, merge the revert.
- AI setter: paste **ai-setter-code-v8.txt** back and click **Deploy updates**.
