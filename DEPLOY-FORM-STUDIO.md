# Deploy: Form Studio and access-based menus

What's in it:

- **Form Studio**: the rebuilt form editor. Drag and drop sections of one to four columns, questions, headings, text, images, dividers and spacers. Multi-step forms, show-when rules, scoring with good-fit and not-a-fit outcomes, styling, desktop and mobile view, live preview, undo and redo, autosave.
- **New form dialog**: start from 11 templates (with live previews), from scratch, or **Build with AI** (describe the form, the AI drafts it, you check it, then open it in Form Studio).
- **Saves people who stop part way** once they've given an email or phone number.
- **Access-based menus**: team members only see the parts of the app they've been given access to, and buttons they can't use are hidden.

There are 5 parts. Do them in this order.

---

## Before you start

If you haven't deployed `forms.zip` (the first version of forms) yet, unzip `forms.zip` first in step 1, then `form-studio.zip` straight after it, so the newer files win.

## 1. Put the code on a new branch (Command Prompt)

```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b form-studio
tar -xf %USERPROFILE%\Downloads\form-studio.zip
git add -A
git commit -m "Form Studio, AI form builder and access-based menus"
git push -u origin form-studio
```

Then on GitHub, open a pull request from `form-studio` into `main`. Don't merge it yet.

## 2. Run the database changes (Supabase)

1. Supabase, open the project, then **SQL Editor**, then **New query**.
2. Open `supabase/migrations/20261123090000_forms.sql` from the zip, copy all of it, paste it in, click **Run**. It's safe to run again if you've already run it.
3. New query again. Open `supabase/migrations/20261124090000_forms_v2.sql`, copy all of it, paste it in, click **Run**.
4. Each should say "Success. No rows returned".

## 3. Create the AI form function (Supabase)

1. Supabase, then **Edge Functions**, then **Deploy a new function**, then **Via Editor**.
2. Name it exactly: `ai-form`
3. Delete the sample code. Open `supabase/functions/ai-form/index.ts` from the zip, copy all of it, paste it in.
4. Click **Deploy function**. Leave "Verify JWT" switched on.

It uses the same `ANTHROPIC_API_KEY` secret as the AI setup assistant, so there's nothing new to add. Each workspace can make 30 AI drafts a day.

## 4. Merge

Merge the pull request. Netlify deploys on its own (about 3 minutes).

## 5. Test

1. Log in at os.scalency.us and open **Forms**, then **New form**.
2. **Templates**: click "Free AI audit (scorecard)", try it on the left, then **Use this template**.
3. In Form Studio: drag "Long answer" from the left onto the form, drag a "2 columns" section in, drag a question into the new columns. Press Ctrl+Z to undo. Click a question and change its label on the right.
4. Click **Preview** and go through all the steps.
5. **Publish**, open **Share and embed**, open the link and fill it in. Check Contacts and the **Submissions** tab (it should show the score and whether they're a good fit).
6. Back on Forms: **New form**, **Build with AI**, click one of the examples, then **Draft my form**. Wait about 15 seconds, check the draft, then **Open in Form Studio**.
7. Access: in Settings, Members, give a test member access without "Manage sites and forms". Log in as them: Forms is gone from the menu, and going to os.scalency.us/forms shows "You don't have access to this".

## If something goes wrong

- **"The AI is not set up yet"**: the `ANTHROPIC_API_KEY` secret is missing in Supabase, Edge Functions, Secrets.
- **AI draft says "Please sign in again"**: sign out, sign in, try again.
- **Forms page errors after merging**: step 2 was skipped. Run both SQL files, then refresh.
- To undo the whole release: on GitHub, open the merged pull request and click **Revert**. The database changes can stay; they don't break the old version.
