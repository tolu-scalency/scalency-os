# Auth email templates

Branded emails for Supabase Auth, sent through Resend (Custom SMTP).
Paste each file into Supabase: Authentication, then Emails, then Templates.

| Supabase template | File | Subject |
|---|---|---|
| Confirm sign up | `confirm-signup.html` | Confirm your email for Scalency OS |
| Invite user | `invite.html` | You have been invited to Scalency OS |
| Magic link | `magic-link.html` | Your sign-in link for {{ if .Data.workspace_name }}{{ .Data.workspace_name }}{{ else }}Scalency OS{{ end }} |
| Change email address | `change-email.html` | Confirm your new email for Scalency OS |
| Reset password | `reset-password.html` | Reset your {{ if .Data.workspace_name }}{{ .Data.workspace_name }}{{ else }}Scalency OS{{ end }} password |
| Reauthentication | `reauthentication.html` | Your Scalency OS confirmation code |

Links use `{{ .SiteURL }}/auth/confirm?token_hash=...`, so they work on any device. In Supabase, Authentication, then URL Configuration, the Site URL must be `https://os.scalency.us`.

## Workspace names in emails

Sign-in, password, code and email-change emails show the person's workspace name (for example "Sign in to Maximus HQ") instead of "Scalency OS". The name comes from `workspace_name` in each user's metadata, which the app keeps up to date when someone creates or joins a workspace. People without one still see "Scalency OS".
