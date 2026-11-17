# Deploy: faster saves, invite links, workspace names in emails

## What changed
- **Faster saves.** Adding a tag, moving a deal, adding a contact and incoming webhooks no longer wait for workflow emails and texts to send. Those now go out just after the page updates. Tags on a contact appear instantly.
- **Invite and sign-in links no longer "expire instantly".** Email security scanners open links to check them, which used up the one-time link before the person clicked. Links now open a page with a button, and the link is only used when the person clicks it.
- **Workspace names in emails.** Sign-in, password, code and email-change emails say the person's workspace name, for example "Sign in to Maximus HQ".

## Steps

### 1. Code (Command Prompt)
```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b speed-invites
tar -xf %USERPROFILE%\Downloads\speed-invites.zip
git add -A
git commit -m "Faster saves, scanner-safe email links, workspace names in emails"
git push -u origin speed-invites
```
Open the pull request on GitHub. Don't merge yet.

### 2. Database (Supabase, SQL Editor)
```
notepad supabase\migrations\20261118120000_workspace_name_in_emails.sql
```
Copy all, paste into a new query, click Run. Expect "Success".

### 3. Email templates (Supabase, Authentication, Emails)
For each of these four, open the file with notepad, copy all, and paste it over the template in Supabase, then Save:

| Supabase template | File | Subject |
|---|---|---|
| Magic link | `supabase\templates\magic-link.html` | `Your sign-in link for {{ if .Data.workspace_name }}{{ .Data.workspace_name }}{{ else }}Scalency OS{{ end }}` |
| Reset password | `supabase\templates\reset-password.html` | `Reset your {{ if .Data.workspace_name }}{{ .Data.workspace_name }}{{ else }}Scalency OS{{ end }} password` |
| Reauthentication | `supabase\templates\reauthentication.html` | keep as it is |
| Change email address | `supabase\templates\change-email.html` | keep as it is |

If Supabase won't save a subject with the `{{ if }}` part, keep the old subject. The email body still shows the workspace name.

### 4. Link expiry (Supabase, Authentication, Sign In / Providers, Email)
Set **Email OTP Expiration** to `86400` (24 hours) and save. This gives invites a full day.

### 5. Merge and test
1. Merge the pull request, wait about 3 minutes.
2. Invite a second email of yours. Open the invite email, click the button, then click **Accept invite** on the page that opens.
3. Sign out, request a sign-in link. The email should say your workspace name.
4. Add a tag on a contact: it should appear at once.

Note: clicking **Send again** on an invite makes the earlier invite email stop working. Always use the newest email.
