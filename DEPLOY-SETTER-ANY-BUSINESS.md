# Deploy: AI setter for any business (23 Nov)

## What's in it

1. **Better conversations.** The first message asks about the lead instead of "mind if I explain…?". A "yes" now gets the key detail and 2 times in the same message. No more two yes/no questions in a row.
2. **Any business, not just clinics.** A "Business type" box (med spa, dental, home services, coaching, real estate, gym, other). Each sets the AI's wording, the questions it expects and its safety rules, and has a **Fill in example details** button.
3. **Your instructions box.** Write extra rules in plain words ("Always ask their postcode"). The Test chat uses them straight away, even before saving.
4. **GHL contacts in Scalency.** New GHL leads are copied into Scalency contacts automatically, and a **Copy all GHL contacts into Scalency** button brings in everyone already there. One way only, no duplicates, and copied contacts aren't messaged by Scalency.
5. **Time dropdowns** instead of typing times (AI setter hours, workspace settings, workflow "wait until" and time conditions).
6. **Bigger workflow builder,** with a **Full screen** button. The step panel no longer follows you down the page.

This update has a database change (SQL-11), so do the parts in this order.

## Part 1. Database (Supabase, 2 minutes)

1. Open Supabase and click **SQL Editor** in the left menu.
2. Click **New query**.
3. Open **SQL-11 ghl_contacts.txt** in Notepad, press **Ctrl+A**, then **Ctrl+C**.
4. Paste it into the editor and click **Run**.
5. You should see **Success. No rows returned**.

## Part 2. AI setter code (Supabase, 3 minutes)

1. In the left menu click **Edge Functions**, then **ai-setter**, then the **Code** tab.
2. Click inside the code, press **Ctrl+A**, then **Delete**.
3. Open **ai-setter-code-v8.txt** in Notepad, press **Ctrl+A**, then **Ctrl+C**.
4. Click in the empty editor and press **Ctrl+V**.
5. Click **Deploy updates** and wait for the green message.
6. Open https://nldagscfswzzdhxsnygf.supabase.co/functions/v1/ai-setter in a new tab. It should say **v8**.

## Part 3. Website (Command Prompt, 5 minutes)

1. Leave **setter-any-business.zip** in your **Downloads** folder.
2. Press the Windows key, type `cmd`, press Enter.
3. Paste each line and press Enter after each one. Check every line starts with `git` or `cd` or `tar`.

```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b setter-any-business
tar -xf %USERPROFILE%\Downloads\setter-any-business.zip
git add -A
git commit -m "AI setter for any business, instructions, GHL contacts, time dropdowns, bigger builder"
git push -u origin setter-any-business
```

After `git checkout -b` you must see **Switched to a new branch**. If it says the branch already exists, use `setter-any-business-2` in that line and in the push line.

4. On GitHub click **Compare & pull request**, **Create pull request**, **Merge pull request**, **Confirm merge**.
5. In Netlify, **Deploys**, wait about 3 minutes for **Published**.

## Part 4. Set it up and test (15 minutes)

1. In Scalency open **AI setter**, then your setter, then the **Business** tab.
2. Choose the business type. To test a different kind of business, pick it and click **Fill in example details**.
3. Change **Location** and **Time zone** to the real ones (they still say Austin from the demo).
4. Add anything in **Your instructions**, then click **Save**.
5. **Test chat**: start a conversation and reply "yes" to the first message. The AI should give the key detail and offer 2 times straight away.
6. **Connect GHL** tab, bottom: click **Copy all GHL contacts into Scalency**. When it finishes, open **Contacts**: your GHL contacts are there with source GHL.
7. Real test: in GHL make a new contact with your email or phone and the tag **ai-test**, and add it to the **AI setter: new lead** workflow. It also appears in Scalency **Contacts** within a minute.
8. **Workflows**: open any workflow and click **Full screen**. Press **Esc** to come back.

## If something's wrong

- Website: on GitHub open the merged pull request, click **Revert**, then merge the revert.
- AI setter: paste **ai-setter-code-v7.txt** back into the Code tab and click **Deploy updates**.
- SQL-11 only changes when copied GHL contacts start Scalency workflows. It's safe to leave in place.
