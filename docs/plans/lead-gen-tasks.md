# Lead-gen tasks: the first build

**Status: ready to start (3 November 2026).** Work top to bottom. Each task is one or more pull requests. Background is in `docs/plans/automation-engine.md` (section 2 is the lead-gen journey); the database is in `docs/database.md`.

All testing uses made-up test contacts with the account in test mode, so messages only go to the account's test email and phone.

## 1. App online with a team login

**Why:** everything else needs somewhere to live and a safe way in.

- Switch the Netlify `scalency-os` project from the "coming soon" page (`public/`) to the Next.js app in `platform/`, with deploy previews for pull requests. This changes Netlify settings, so agree the change with Tolu.
- Supabase login for the team (email magic link or Google). No public sign-up: team members are invited.
- Create the Scalency account and a "Test Client" account, and make Tolu an owner of both (a seed migration or script, using made-up data only).
- Keys in environment variables (Netlify and `.env.local`), never in code.

**Done when:**
- [ ] https://os.scalency.us shows the app and asks for a login
- [ ] Tolu can sign in and sees only the accounts they're a member of
- [ ] A pull request gets its own preview link

## 2. Application form, step 1 capture and routing

**Why:** the start of every lead-gen funnel (VSL Funnel and Book-a-Call Funnel SOPs). Losing a lead who drops out of the form is the most expensive leak.

- A form definition per account (`forms.definition`): step 1 fields (owner's name, email, phone), qualifying questions, disqualifying rules, qualified and unqualified page addresses.
- An endpoint the funnel page posts to. It's called on step 1 and again when the form is finished. The server validates the data and writes with the service key; the browser never touches the database.
- On step 1: find or create the **contact**, create the **form submission** ("started") and an **opportunity** in the first stage, and log **activity**.
- On finish: save the answers on the submission and the opportunity, mark it qualified or unqualified (recording the answer that disqualified them), move the stage, and tell the page where to send them.
- A hosted test form in the app, one question per screen with a progress bar, so it can be tested end to end. Client funnel pages will post to the same endpoint.
- Phone numbers saved with the country code. Consent captured on the form.
- The lead-gen pipeline stages from the plan (section 2), once Tolu has confirmed them.

**Done when:**
- [ ] Step 1 only → contact, started submission and opportunity exist, and no duplicate contact on a second try with the same email
- [ ] Qualifying answers → qualified, opportunity in Qualified (Not Booked), redirected to the book-a-call page
- [ ] Each disqualifying answer → unqualified, the reason recorded, redirected to the unqualified page
- [ ] Bad data (no country code, broken email) is rejected with a clear message
- [ ] Works on a phone

## 3. Automation engine core

**Why:** every workflow is built from the same blocks (Automation Standards SOP, section 7).

- Triggers: application started, application qualified, application unqualified.
- Actions: send email, send SMS (from templates, filling in custom values), wait (a set time, or until X before or after an event, skipping if already past), if/else with named branches, add or remove tag, move stage, remove from another workflow, Slack message.
- A clock that picks up due steps every minute (e.g. Supabase Cron calling the app), safe to run twice without double-sending.
- Quiet hours: SMS held until the account's sending window opens, in its time zone.
- Test mode: every message goes to the account's test email or phone instead, and is marked as such.
- Enrolment history and an execution log for every step (`workflow_enrollments`, `workflow_step_runs`, `messages`).
- Email, SMS and Slack providers connected in test mode (which provider is an open decision in the plan: ask Tolu).

**Done when:**
- [ ] Each action works on a test contact and shows in the execution log
- [ ] A wait of 2 minutes resumes on time; a wait already in the past is skipped
- [ ] An SMS due at 3 am goes out when the window opens
- [ ] Nothing reaches anyone except the test email and phone

## 4. Workflows L1 to L3

**Why:** the first real automations (plan, section 2). Follow-up timings and copy are Tolu's call: draft them in the planning sheet and get approval before building.

- **L1 Application Started:** follow up by SMS and email if they don't finish; stop as soon as they finish.
- **L2 Unqualified:** tag, stage, Slack message with their answers, email nurture.
- **L3 Qualified, Not Booked:** reminders to book; stop when they book (for now, booking is marked by hand or a GHL webhook).

**Done when:**
- [ ] Every branch tested with test contacts; messages arrive on the test phone and inbox with custom values filled in
- [ ] Finishing the form ends L1 straight away
- [ ] Each workflow can't be switched on until marked client-approved

## 5. Screens

**Why:** Tolu should be able to follow a lead without opening the database.

- Contacts list and contact page (details, answers, tags, timeline).
- Pipeline board by stage.
- Workflows list with on/off switches (on only when approved), and each workflow's enrolment history and execution log.
- Brand styling from `docs/brand.md`.

**Done when:**
- [ ] Tolu can follow one test lead from step 1 to Qualified, seeing every message and step

## 6. If time allows: L4 Booked Call and L5 Confirmed

See the plan, section 2. Agree the approach first. Bookings still happen in the GHL calendar, so this probably starts with a GHL webhook into the engine.
