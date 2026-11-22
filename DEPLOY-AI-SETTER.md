# Deploy: AI setter (pilot: med spas)

An AI patient coordinator that works inside a client's GHL sub-account, following Tolu's setter SOP and the med spa playbook.

## What it does

- **New lead:** texts them within a minute (in opening hours). The first message leads with value and ends with a yes/no question. It also creates a GHL task for the team to call twice.
- **Replies:** answers questions honestly from the clinic's details: price, pain, downtime, results, who does the treatment, financing, insurance. It never gives medical advice or promises results.
- **Booking:** it asks permission and gets one more yes, then offers 2 real free times from the GHL calendar and books the consultation. The deal moves to your "booked" stage.
- **Follow-up when they go quiet:** on day 1, 3, 5, 8, 12 and 16, each in a different style (value, proof, straight talk, "we're all busy", value, last check-in). On the right days it also creates tasks for the Instagram DM and the selfie videos.
- **Safety:**
  - it stops at once on STOP or "not interested";
  - it hands over to the team (GHL task and tag) for medical problems, upset leads, people asking for a person, or appointment changes;
  - it steps back if a team member replies to the lead themselves;
  - it never claims to be a person.
- **In Scalency:** AI, then AI setter. Set the clinic's details and rules, connect GHL, try it in the test chat, and see every conversation.

If you haven't deployed `funnels-websites.zip` yet, do that release first (DEPLOY-FUNNELS.md).

## Part 1. Code (Command Prompt)

```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b ai-setter
tar -xf %USERPROFILE%\Downloads\ai-setter.zip
git add -A
git commit -m "AI setter: GHL connection, test chat, follow-ups"
git push -u origin ai-setter
```

On GitHub click **Compare & pull request**, then **Create pull request**. Don't merge yet.

## Part 2. Database (Supabase, SQL Editor)

1. **SQL Editor**, **New query**.
2. Open **SQL-10 ai_setter.txt**, copy everything, paste it in and click **Run**. It should say "Success".

## Part 3. The AI setter function (Supabase, Edge Functions)

1. **Edge Functions**, **Deploy a new function**, **Via Editor**.
2. Delete the sample code. Open **ai-setter-code.txt**, copy everything and paste it in.
3. Name it exactly `ai-setter` and click **Deploy function**.
4. **Important:** open `ai-setter` in the list. Find the setting called **Verify JWT** (sometimes "Enforce JWT verification"), turn it **off**, and save. GHL's webhooks can't sign in, so the function checks access itself.

It uses the same `ANTHROPIC_API_KEY` as the AI form builder, so there's nothing new to add.

## Part 4. Merge

Merge the pull request. Netlify takes about 3 minutes. The clock then runs the AI setter's follow-ups every minute.

## Part 5. Try the AI in Scalency (no GHL needed, 5 minutes)

1. In the sidebar, click **AI**, then **AI setter**, then **Set up an AI setter**. It opens with a demo med spa, "Glow Aesthetics".
2. Open **Test chat** and click **New lead comes in**. Read the first text.
3. Reply as the lead, and try:
   - "how much is botox?"
   - "does it hurt?"
   - "I'm breastfeeding, is that ok?" (it shouldn't give advice)
   - "are you a bot?"
   - "ok, what times do you have?", then pick one (it books in the pretend calendar)
   - "not interested"
4. Try **Send follow-up 1, 2, 3...** to see each follow-up style.
5. Change the clinic's details or prices on the **Clinic** tab. The test chat uses them straight away.

## Part 6. Connect the AutomateWithDave sub-account (15 minutes)

In GHL, in the AutomateWithDave sub-account:

1. **Calendar:** make sure there's a calendar for consultations (for example "Free consultation", 30 minutes) with availability set.
2. **Key:**
   1. Go to **Settings**, **Private Integrations**, **Create new integration**, and name it "Scalency AI setter".
   2. Tick the permissions listed on the **Connect GHL** tab in Scalency, create it, and copy the key.
3. In Scalency, open the AI setter, then **Connect GHL**:
   1. Paste the **Location ID** and the key, and click **Connect**.
   2. Choose the calendar, and optionally the pipeline and its stages, then click **Save calendar and pipeline**.
4. **Three GHL workflows.** In Scalency, click **Show the webhook addresses**. Then in GHL go to **Automation**, **Workflows**, **Create workflow**, **Start from scratch**, and make three. Each has one trigger and one **Webhook** action set to **POST**, with the address from Scalency.

   | Workflow name | Trigger | Webhook address |
   |---|---|---|
   | AI setter: new lead | Facebook Lead Form Submitted (or Form Submitted for the funnel's form) | the new lead address |
   | AI setter: lead replied | Customer Replied | the lead replied address |
   | AI setter: booked | Customer Booked Appointment | the booked address |

   In each workflow's **Settings**, turn on **Allow re-entry**, so every reply reaches the AI. Then **Save** and **Publish** each one.
5. If the sub-account already has automated first texts for new leads, pause them for the pilot, so leads don't get two first messages.

## Part 7. Test it for real

1. In Scalency, switch the AI setter to **Test mode** (top right). It now only talks to contacts tagged `ai-test`.
2. In GHL, make a contact for yourself and add the tag `ai-test`.
   - The sub-account's number may not be able to text a Nigerian phone. If so, give the test contact an email address and no phone number: the AI then uses email.
   - Or ask Tolu to test with his UK number.
3. Submit the lead form as that contact, or send a message in. The first text arrives within a minute.
4. Reply. Ask questions, then book. Check that the booking appears in the GHL calendar and the deal moves.
5. Everything shows under **Conversations** in Scalency.
6. When you're both happy, switch to **Live**.

If anything shows an error, send me a screenshot.
