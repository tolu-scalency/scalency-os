# Deploy: workspace update (22 Nov)

## What's in it

1. **The client's business name everywhere.** The sidebar shows the workspace name at the top (its first letter when the sidebar is closed). The browser tab says "Contacts · Glow Aesthetics", not "Scalency OS". Team invites and test emails come from the business name. "Scalency AI" is now "AI assistant". The login and sign-up pages still say Scalency OS, because that's the platform.
2. **AI setter conversations in the Inbox.** Inbox has two tabs: **Emails and texts** and **AI setter**. The AI setter tab shows every lead the AI is talking to in GHL: the lead's messages, the AI's replies, and what it did (booked, handed over, stepped back). Each one has **Open in GHL**, **Hand back to the AI** and **Stop the AI for this lead**.
3. **Delete contacts.** From the contact page (**Delete contact**), or tick several in the Contacts list and click **Delete**.
4. **Workflow menu.** The "..." button on each workflow: **Open**, **Duplicate**, **Copy to another workspace**, **Move to another workspace**, **Delete**. Copies always arrive switched off. Webhook workflows get a new address so a copy never takes the original's leads.
5. **A confirmation before every delete,** in a proper box, not the browser's grey pop-up.
6. **New webhook addresses.** In the AI setter, Connect GHL, step 3: **New addresses**. The old ones stop working straight away.

No database change this time.

## Why the last update "didn't work"

Nothing was wrong with what you did. Two separate things:

- **Netlify "Cancelled" is normal for that update.** It only changed the AI setter function, which isn't part of the website. Netlify sees no website change and skips the build. This update does change the website, so Netlify will build it.
- **The AI setter function never updates from GitHub.** It only changes when you paste the code into Supabase (Part 2). Part 3 shows you how to check it's live.

## Part 1. Website code (Command Prompt, 5 minutes)

```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b workspace-update
tar -xf %USERPROFILE%\Downloads\workspace-update.zip
git add -A
git commit -m "Business name branding, AI setter inbox, deletes with confirmation, workflow menu"
git push -u origin workspace-update
```

On GitHub click **Compare & pull request**, **Create pull request**, then **Merge pull request** and **Confirm merge**.

Netlify takes about 3 minutes. This time it should say **Published**, not Cancelled.

## Part 2. AI setter function (Supabase, 3 minutes)

1. Open Supabase, then **Edge Functions** in the left menu.
2. Click **ai-setter** (the one that's already there; don't make a new one).
3. Click the **Code** tab.
4. Click inside the code, press **Ctrl+A** to select all of it, then **Delete**. The editor should now be empty.
5. Open **ai-setter-code-v3.txt** in Notepad, press **Ctrl+A**, **Ctrl+C**.
6. Click back in the Supabase editor and press **Ctrl+V**.
7. Click **Deploy updates** (bottom right). Wait for the green "deployed" message.
8. Check **Verify JWT** is still **off** (in the function's **Details** tab).

## Part 3. Check it's live (1 minute)

Open this address in your browser (it's safe, it shows no secrets):

```
https://nldagscfswzzdhxsnygf.supabase.co/functions/v1/ai-setter
```

You should see: `"version": "v3 (22 Nov): email threads, quote stripping"`.

If you see `Use POST.` instead, the old code is still live: go back to Part 2.

## Part 4. Test (10 minutes)

**Website**
1. Refresh Scalency. The sidebar shows your workspace's name, and the browser tab ends with it.
2. Workflows: click "..." on a test workflow, then **Duplicate**. Then delete the copy: the confirmation box appears first.
3. Contacts: tick a test contact, click **Delete**, confirm.
4. Inbox: click the **AI setter** tab. Your earlier test leads are there with every message.

**AI setter email threading** (needs a fresh contact, as the old thread started with the old subject)
1. In GHL, create a new contact with only your email (no phone) and the tag **ai-test**.
2. Add them to the **AI setter: new lead** workflow.
3. The opener arrives with the subject "Your enquiry with ...". Reply to it.
4. The AI's answer should arrive **in the same email thread**, and it shouldn't mention your quoted text.
5. In Scalency, Inbox, **AI setter**: the whole conversation is there.

If emails still land in spam: that's GHL's shared sending domain. The fix is a dedicated sending domain in the GHL sub-account (Settings, Email Services). We can set that up together.

## If something's wrong

To undo the website part: on GitHub open the merged pull request, click **Revert**, then merge the revert.
