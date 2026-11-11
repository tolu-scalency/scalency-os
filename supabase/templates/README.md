# Auth email templates

Branded emails for Supabase Auth, sent through Resend (Custom SMTP).
Paste each file into Supabase: Authentication, then Emails, then Templates.

| Supabase template | File | Subject |
|---|---|---|
| Confirm sign up | `confirm-signup.html` | Confirm your email for Scalency OS |
| Invite user | `invite.html` | You have been invited to Scalency OS |
| Magic link | `magic-link.html` | Your Scalency OS sign-in link |
| Change email address | `change-email.html` | Confirm your new email for Scalency OS |
| Reset password | `reset-password.html` | Reset your Scalency OS password |
| Reauthentication | `reauthentication.html` | Your Scalency OS confirmation code |

Links use `{{ .SiteURL }}/auth/confirm?token_hash=...`, so they work on any device. In Supabase, Authentication, then URL Configuration, the Site URL must be `https://os.scalency.us`.
