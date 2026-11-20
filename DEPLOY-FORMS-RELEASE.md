# Deploy: Forms (everything in one release)

This one zip has all the forms work: Form Studio, templates, Build with AI, access-based menus, the fixes for links and embeds, workspace links, no Scalency icon on forms, duplicate, uploads and signatures, views and conversion, and team alerts.

It replaces form-studio.zip. If you already opened a pull request for `form-studio`, close it on GitHub without merging.

Takes about 20 minutes. Do the parts in order.

---

## Part 1. Put the code on GitHub (Command Prompt)

1. Save `forms-release.zip` in your Downloads folder.
2. Press the Windows key, type `cmd`, press Enter.
3. Copy these lines, paste them into the black window (right-click pastes) and press Enter:

```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b forms-release
tar -xf %USERPROFILE%\Downloads\forms-release.zip
git rm --ignore-unmatch platform/src/app/favicon.ico platform/src/app/icon.png platform/src/app/apple-icon.png
git add -A
git commit -m "Forms release: Form Studio, AI builder, workspace links, embeds, duplicate"
git push -u origin forms-release
```

The `git rm` line removes the old Scalency icons from the app folder. They were what put the Scalency icon on every form.

4. Open github.com/tolu-scalency/scalency-os. A yellow bar says "forms-release had recent pushes". Click **Compare & pull request**, then **Create pull request**. Don't merge yet.

## Part 2. Run the 3 database changes (Supabase)

Do this once for each of these files, in this order:

- `supabase/migrations/20261123090000_forms.sql`
- `supabase/migrations/20261124090000_forms_v2.sql`
- `supabase/migrations/20261125090000_forms_pro.sql`

For each one:

1. In File Explorer, open `Desktop\scalency-os\supabase\migrations`. Right-click the file, **Open with**, **Notepad**.
2. In Notepad press **Ctrl+A** then **Ctrl+C**.
3. Go to supabase.com, open the Scalency project. In the left menu click **SQL Editor**, then the **+** (New query).
4. Click in the big empty box, press **Ctrl+V**, then click **Run** (bottom right).
5. You should see "Success. No rows returned". If Supabase asks "This query has destructive operations", click **Run this query**.

All three are safe to run again if you're not sure whether one already ran.

## Part 3. Create the AI form function (Supabase)

1. In Supabase's left menu click **Edge Functions**.
2. Click **Deploy a new function**, then **Via Editor**.
3. At the top, replace the name with exactly: `ai-form`
4. Click in the code box, press **Ctrl+A**, then **Delete** to clear the sample code.
5. In File Explorer open `Desktop\scalency-os\supabase\functions\ai-form\index.ts` with Notepad. **Ctrl+A**, **Ctrl+C**.
6. Back in Supabase, click in the code box and press **Ctrl+V**.
7. Click **Deploy function** (bottom right). Wait for the green "deployed" message.

It uses the Claude key that's already saved for the AI setup assistant, so there's nothing else to add.

## Part 4. Merge

1. Back on GitHub, open the pull request, click **Merge pull request**, then **Confirm merge**.
2. Netlify builds it on its own. Wait about 3 minutes.

## Part 5. Check the secret key (only if Forms shows a red box)

Open os.scalency.us, go to **Forms**, open any form and click **Share and embed**.

- **No red box:** skip to Part 6.
- **Red box about SUPABASE_SECRET_KEY:** this is why links and embeds didn't work. Fix it:
  1. Supabase: **Project Settings** (cog, bottom left), **API Keys**. Under **Secret keys**, click the eye or copy button next to the key that starts `sb_secret_`.
  2. Netlify: open the scalency-os site, **Site configuration**, **Environment variables**.
  3. Find `SUPABASE_SECRET_KEY`. Click it, **Edit**, paste the key into the value, **Save**. If it isn't there, click **Add a variable**, name it `SUPABASE_SECRET_KEY`, paste the key, **Create variable**.
  4. Netlify: **Deploys**, **Trigger deploy**, **Deploy site**. Wait about 3 minutes.

Type the key straight into Netlify. Don't paste it in chat or any file.

## Part 6. Test

1. **Forms**, **New form**, pick a template, **Use this template**.
2. Click **Publish**, then **Share and embed**. The link now looks like `os.scalency.us/f/<your-workspace>/<form-name>`. Click **Open**: the form should load, with the form's name in the browser tab and no Scalency icon.
3. Fill it in. Check **Contacts**, the form's **Submissions** tab and the #leads team chat.
4. Embed test: copy the **Popup** code and paste it into any test web page (a WordPress Custom HTML block works). The button should open the form.
5. Back on **Forms**, click the **...** on a form, then **Duplicate**.

## If something goes wrong

- **The link says "This form isn't available":** the form is still a draft. Click **Publish**.
- **Red box on the Share tab:** follow what it says. It names the exact setting.
- **Forms page errors:** a SQL file in Part 2 didn't run. Run all three again.
- **Undo everything:** on GitHub open the merged pull request and click **Revert**. The database changes can stay.

## Later, optional: forms on their own address

Links can use `forms.scalency.us` instead of `os.scalency.us`, like GHL's leadconnector links. Ask Claude for the steps when you want it (a Namecheap record, a Netlify domain and one setting).
