# Deploy: everything pending (21 Nov)

One release with every change since the forms release. It replaces builder-focus.zip, so don't deploy that one separately.

## What's in it

1. **Full-screen builders.** Forms and workflows open without the sidebar or top bar, like GHL.
2. **"Saved" pop-ups** at the top of the screen whenever something saves, and errors there in red.
3. **Insert field** rebuilt: it floats above everything, never gets cut off, can be searched, has groups and works with the keyboard. New fields: tags, date added, today's date, weekday, year, and the latest deal (name, value, stage, status, pipeline).
4. **If / else conditions**: a searchable picker with 26 checks in 6 groups. New: email or text unsubscribed, date added, reply contains, last reply channel, form submitted, in workflow, finished workflow, open deal, deal owner, day of the month, date.
5. **Teammate names**: people who joined by invite showed as "Teammate". They now show their name or email everywhere.
6. **Email sending from the client's own address** (agreed with Tolu: option 1 then 3). In Settings, Email sending:
   - **Your mailbox**: Google, Microsoft 365, Zoho or any host. It logs in, sends a test email, then saves. The password is stored encrypted and the browser can never read it.
   - **Your own domain**: like hello@theirbusiness.co.uk through Resend. It shows the DNS records to add with copy buttons, then a Check button.
   - Until a workspace connects one, emails go out from Scalency's address as before.
7. **Sign-in code by email.** After signing in with a password, a 6-digit code is emailed and must be entered before the app opens. It lasts 10 minutes, allows 5 tries and works once per sign-in. Signing in with an email link skips it.
8. **Security update.** Next.js 16.4.4 to 16.4.6, and a mail library with no known issues. `npm audit` shows 0 vulnerabilities.

## Part 1. Code (Command Prompt)

```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b release-nov-21
tar -xf %USERPROFILE%\Downloads\release-nov-21.zip
git add -A
git commit -m "Release 21 Nov: full-screen builders, saved pop-ups, conditions, own email sending, sign-in codes"
git push -u origin release-nov-21
```

If you already made a `builder-focus` branch and never merged it, close its pull request on GitHub without merging.

On GitHub click **Compare & pull request**, then **Create pull request**. Don't merge yet.

## Part 2. Database (Supabase, SQL Editor)

Run these one at a time, in this order. Each should say "Success". (`20261126...server_access` is the SQL-4 file you already ran, so skip it.)

1. `20261127090000_conditions_and_fields.sql`
2. `20261128090000_email_senders.sql`
3. `20261129090000_login_codes.sql`

They're also attached separately as SQL-5, SQL-6 and SQL-7 text files.

## Part 3. Resend key (needed for "your own domain")

Adding a client's domain needs a Resend key with **Full access**, not "Sending access".

1. resend.com, then **API Keys**. Look at the **Permission** of the key in use.
2. If it says "Sending access": click **Create API key**, name it `scalency-os-full`, permission **Full access**, then **Add**. Copy it.
3. Netlify: the scalency-os site, **Site configuration**, **Environment variables**. Edit `RESEND_API_KEY`, paste the new key and **Save**.
4. Back in Resend, delete the old key.

Type the key straight into Netlify. Never paste it in chat or a file.

## Part 4. Optional: its own key for mailbox passwords (recommended, 2 minutes)

Mailbox passwords are encrypted with a key taken from `SUPABASE_SECRET_KEY`. A separate key is better, so rotating the Supabase key later won't disconnect everyone's mailbox. Do this **before** anyone connects a mailbox.

1. Press the Windows key, type `powershell`, press Enter, then paste:
   ```
   $b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   ```
2. Copy the long line it prints.
3. In Netlify, under **Environment variables**, click **Add a variable**. Key: `EMAIL_SECRET_KEY`, value: the copied line. Click **Create variable**.

## Part 5. Merge

Merge the pull request. Netlify takes about 4 minutes this time, because it installs the updated packages.

## Part 6. Test

1. **Sign-in code**: sign out, then sign in with your password. You land on "Check your email". Enter the 6 digits from the email.
2. **Builders**: open a workflow. There's no sidebar. Change something and "Saved" pops up at the top.
3. **Insert field**: in an email step click **Insert field**. The list opens fully and you can type "deal" to filter it.
4. **If / else**: click the condition box and type "form". Pick **Form submitted** and choose a form.
5. **Teammates**: in an If / else, choose **Assigned user**. Real names should show.
6. **Your mailbox**: **Settings**, **Email sending**, **Connect your mailbox**, **Google**. Enter a Gmail address and an app password (Google Account, Security, 2-Step Verification, App passwords). Click **Connect and send a test** and check the inbox.
7. **Your domain** (optional now): **Use your own domain**, enter a domain you control on Namecheap. Add the records in Namecheap, **Advanced DNS**, then click **Check**. It can take a few minutes, sometimes a few hours.

## If something goes wrong

- **Nobody can get past "Check your email"** (for example, emails aren't arriving): in Netlify add `LOGIN_CODES` = `off`, then **Deploys**, **Trigger deploy**. That turns the code step off straight away. Remove the variable to turn it back on.
- **"The Resend key in Netlify can only send emails"** when adding a domain: do Part 3.
- **The mailbox "refused the email or password"**: Google and Zoho need an app password, not the normal password.
- **Undo everything**: revert the pull request on GitHub. The database changes can stay.

## Good to know

- Resend's free plan allows 3 verified domains at a time (Scalency's own uses one) and 100 emails a day across everything, including sign-in codes. Mailbox sending doesn't count towards that.
- Replies to emails sent through a client's own mailbox land in that mailbox. Showing them in the Scalency inbox is planned (see NEXT-BUILDS.md).
