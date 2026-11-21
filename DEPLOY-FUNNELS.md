# Deploy: funnels, websites, own domains, form folders, email replies

One release with everything in the list after Pages.

## What's in it

1. **Funnels.** Pages in steps (opt-in, sales, booking, thank you).
   - 6 ready funnels: free guide then book a call, webinar sign-up, sales page, clinic consultation, free quote, blank.
   - Buttons can go to "the next step" or any step. A form can move people to the next step once it's sent.
   - Each funnel has an overview with views, sign-ups and conversion for every step, and how many went on to the next step.
   - Add, rename, reorder, copy and delete steps. Switch between steps at the top of Page Studio.
   - Ad tags (utm_source, utm_campaign, gclid, fbclid and so on) follow visitors from step to step and into the form, so leads show where they came from.
2. **Websites.** Several pages with one shared header, menu and footer.
   - 5 ready websites: small business, clinic, dental practice, trades, estate agent. Each has Home, About, Services and Contact.
   - The menu lists the pages by itself. Tick which pages show in it.
   - Edit the header or footer once and every page updates.
3. **Own domains** for any page, funnel or website, like www.theirbusiness.co.uk.
   - The overview shows the 2 DNS records to add, with copy buttons.
   - A TXT record proves the client owns the domain, so nobody can claim someone else's.
   - Scalency checks every 10 minutes and switches the domain on by itself. The domain is added to Netlify automatically, so HTTPS works.
   - Forms keep working on the client's domain. The Scalency app can't be reached through it.
4. **Form folders.** Move forms into folders, filter by folder, rename folders.
5. **Spam protection on forms**, invisible to real people:
   - the hidden bot trap (already there);
   - anything sent within 2 seconds of the form appearing is ignored;
   - answers stuffed with links are ignored;
   - limits of 5 sends per person per form and 20 per person across all of a workspace's forms, every 10 minutes.
6. **Email replies into Scalency.** When a client connects their own mailbox (Settings, Email sending), replies from contacts show in the contact's conversation within 5 minutes and start any "lead replied" workflows.
   - Out-of-office replies are skipped.
   - Old emails aren't imported.
   - Nothing in the mailbox is changed.
   - Works with Google and Zoho. Microsoft 365 has switched off password logins for reading mail on most business accounts, so Microsoft replies need the one-click Microsoft connect (a later build).

Not in this release: Gmail one-click (waiting for Tolu's Google Cloud steps) and the AI audit (needs a Google Maps key).

## Part 1. Code (Command Prompt)

```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b funnels-websites
tar -xf %USERPROFILE%\Downloads\funnels-websites.zip
git add -A
git commit -m "Funnels, websites, own domains, form folders, spam protection, email replies"
git push -u origin funnels-websites
```

On GitHub click **Compare & pull request**, then **Create pull request**. Don't merge yet.

## Part 2. Database (Supabase, SQL Editor)

1. Supabase, the scalency-os project, **SQL Editor**, **New query**.
2. Open **SQL-9 funnels_websites.txt**, copy everything, paste it in and click **Run**. It should say "Success".

## Part 3. Netlify access token (so own domains get HTTPS by themselves)

Free. It lets Scalency add a client's domain to the Netlify site.

1. In Netlify, click your avatar (bottom left), then **User settings**.
2. **Applications**, then under **Personal access tokens** click **New access token**.
3. Description: `scalency-domains`. Expiration: the longest option. Click **Generate token** and copy it.
4. Go to the scalency-os site, **Site configuration**, **Environment variables**, **Add a variable**.
5. Key: `NETLIFY_AUTH_TOKEN`, value: the token. Click **Create variable**.

Type the token straight into Netlify. Never paste it in chat or a file. The account that makes the token must be able to manage the scalency-os site.

Without this token everything still works, but each client domain has to be added by hand in Netlify (Domain management, Add a domain alias) before HTTPS works. The overview says so when that's needed.

## Part 4. Merge

Merge the pull request. Netlify takes about 4 minutes this time, because it installs 2 new packages (for reading mailboxes).

## Part 5. Test (10 minutes)

1. **Funnel:**
   1. Go to **Sites**, then **Funnels and pages**, then **New funnel**, and pick **Free guide, then book a call**.
   2. Click **Create funnel**. The overview opens with 3 steps.
   3. Click **Edit** on step 1. In the form block, choose a form. "After it's sent" should already say "Go to the next step".
   4. Use the box at the top to switch to step 2, then go back to the overview.
   5. Click **Publish**, then **Open**. Fill in the form. You should land on step 2.
   6. Back on the overview, step 1 shows 1 view and 1 sign-up.
2. **Website:**
   1. Click **New website** and pick **Clinic**, then **Create website**.
   2. Open the **About** page. The header and menu (Home, About, Services, Contact) are shown at the top. Click the header to edit it.
   3. Publish and click through the menu.
3. **Own domain (optional, needs a domain you control):**
   1. On the overview, under **Your own domain**, type something like `offer.yourdomain.com` and click **Connect domain**.
   2. Add the 2 records it shows at Namecheap (Advanced DNS, Add new record), then click **Check now**. It can take up to a few hours.
4. **Form folders:** in **Forms**, open a form's **...** menu, click **Move to a folder** and type a name. The folder appears above the list.
5. **Email replies:** if a workspace has its own mailbox connected, reply to one of its emails from a contact's address. Within 5 minutes the reply shows in that contact's conversation. Settings, Email sending shows when the inbox was last checked.

If anything shows an error, send me a screenshot.
