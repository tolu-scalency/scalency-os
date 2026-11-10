# Setting up Scalency OS on a computer (development)

How to connect the app in `platform/` to a Supabase project and sign in. Use a **test** Supabase project with made-up data only. The live `scalency-os` project is changed only through reviewed, merged migrations (see `CLAUDE.md`).

## 1. Create the tables

In the Supabase dashboard of your test project, open **SQL Editor**, click **New query**, and run these files from `supabase/migrations/`, one at a time and in this order:

1. `20261103120000_application_journey.sql` (the 18 tables)
2. `20261109120000_account_setup.sql` (the account setup helpers)

Copy the whole file into the editor and click **Run**. Each should say "Success. No rows returned".

## 2. Make logins invite only

In **Authentication**:

1. **Sign In / Providers**: keep **Email** on. Turn **Allow new users to sign up** off.
2. **URL Configuration**: set **Site URL** to `http://localhost:3100` and add `http://localhost:3100/auth/callback` under **Redirect URLs**. (When the app goes live, add `https://os.scalency.us/auth/callback` too.)

## 3. Invite yourself

**Authentication > Users > Add user > Send invitation**, with your work email. You don't need to open the invitation email: the app sends its own login link.

## 4. Create the account

Back in **SQL Editor**, run (with your email):

```sql
select public.setup_account('Scalency', 'scalency', 'you@example.com');
```

This creates the Scalency account in test mode, makes you its owner and adds the Lead gen pipeline with its 10 stages. To give someone else access later, invite them (step 3), then:

```sql
select public.add_account_member('scalency', 'them@example.com', 'member');
```

## 5. Connect the app

1. In Supabase, open **Project Settings > API** (or **API Keys**) and find the **Project URL** and the **publishable** key (older projects call it the **anon public** key). Never use the `service_role` or secret key here.
2. In the `platform` folder, copy `.env.example` to a new file called `.env.local`.
3. Open `.env.local` and replace the two placeholder values with yours. Save it. This file is never committed and must never be pasted into a chat or an email.

## 6. Run it

```bash
cd platform
npm install
npx next dev --port 3100
```

Open http://localhost:3100, enter your email, and click the link in the email Supabase sends. You land on the dashboard.

Supabase's built-in email sends only a few login emails an hour. That's fine for testing. Before the team uses it every day, connect Resend as the email sender in **Authentication > Emails > SMTP Settings**.

## Checks

- Signed out, any page sends you to `/login`.
- An email that wasn't invited gets "That email isn't on the team yet".
- **Contacts > Add contact** saves a contact, puts them in **Application Started**, and opens their record.
- On the record, **Update stage** moves them, and **Add note** adds to the timeline. Both show on the Pipeline and the Dashboard.
- **Sign out** (bottom of the sidebar) returns you to `/login`.
