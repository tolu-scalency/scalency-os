# Plan: Scalency's own automation engine (replacing GHL and Zapier)

**Status: planning (3 November 2026).** Nothing built yet. Decisions marked **(to decide)** need Tolu.

**Source:** Tolu's SOPs in `GHL Backend SOPs/` and `Landing Page SOPs/` (kept off GitHub because they name clients). This plan describes the automations generically and names no clients.

## 1. Goal

Run every automation Scalency builds today in GoHighLevel (GHL) and Zapier from Scalency OS instead (os.scalency.us), for Scalency **and** for clients, then retire Zapier and, later, GHL.

The rules in the **GHL Automation Standards SOP** carry straight over and become rules the engine enforces:
- No dates, times, links or addresses typed into messages: always custom values.
- Messages timed from the event ("wait until X before/after the event start"), skipping any that are already past.
- One trigger with different outcomes = one workflow with named branches.
- Every message written as a template first.
- Every step, branch and workflow clearly named.
- Quiet hours (US SMS only 8 am–8 pm) in the right time zone.
- Test every outcome with a test contact; enrolment history and execution logs for everything.
- Nothing goes to a client's customers without the client's approval.

## 2. Inventory: every automation in the SOPs

### GHL workflows

| # | Workflow | Trigger | What it does |
|---|---|---|---|
| 1 | Pre-Webinar SMS | Opportunity created: Webinar Pipeline, Registered | Confirmation SMS, then reminders 24h, 6h, 3h, 1h, 15 min before, at start, 15 min after |
| 2 | Pre-Webinar Emails | Same as #1 | Email reminders before the masterclass (Webinar Email Sequence SOP) |
| 3 | Attended / Not Booked | Same as #1 | Follow-ups 12 hours and 3 days after, to get a call booked |
| 4 | Attended tag | Contact field "Attended Webinar?" changes to Yes | Tag, move to Attended Webinar stage |
| 5 | Didn't Attend | "Attended Webinar?" changes to No | Remove from #3, tag, move to Didn't Attend, replay SMS 12 hours after and more |
| 6 | Booked Call | Appointment booked on the closers' calendar | Tag, move to Call Booked, remove from #3 and #5, assign the closer, notify the closer, confirm by SMS and email, Slack message with form answers, reminders 1 day, 1 hour, 15 min and 5 min before the call |
| 7 | Unqualified Leads | Book a Call Form submitted with a disqualifying budget answer | Tag, move to Unqualified, Slack message |
| 8 | SMS Failure | An outbound SMS fails | Email asking them to check their number |
| 9 | Old Registrations | Run by hand on selected contacts | Move to the Old Registrants pipeline, remove from the Webinar Pipeline |
| 10 | Programme onboarding (one per programme) | Started by #12 | Welcome email |

### Zapier automations

| # | Zap | What it does |
|---|---|---|
| 11 | WebinarJam registration | WebinarJam webhook → create contact and opportunity in Registered with a tag (starts #1–#3) → Slack "new registration" |
| 12 | Whop sale | Whop new payment → one path per programme → Slack "new sale" → opportunity Closed / Won with the package tier → start that programme's onboarding (#10) |

### Manual steps that feed automations

| # | Step | What it does |
|---|---|---|
| 13 | Attendance import | Export registrants from WebinarJam as a CSV, import into GHL, which sets "Attended Webinar?" and starts #4 and #5 |

### Scalency's own funnel

- The booking page at scalency.us/book.html uses the GHL `sales-call-4187` calendar. Its confirmations and reminders run in GHL today.

## 3. What the engine needs (the building blocks)

### Records (the database)

| Record | Notes |
|---|---|
| Accounts | One per business (Scalency, each client). Replaces GHL sub-accounts. Every other record belongs to one account. |
| Contacts | Name, email, phone with country code, time zone, consent to SMS and email |
| Custom fields | Per account, e.g. "Attended Webinar?", budget, package tier, closer |
| Custom values | Per account, e.g. webinar date, join link, replay link, address |
| Tags | Exact names, per account |
| Pipelines, stages, opportunities | e.g. Webinar Pipeline, Old Registrants |
| Templates | Email and SMS, using custom values |
| Activity log | Every message sent and every step run |

### Triggers

- Opportunity created in a pipeline and stage
- Contact field changed to a value
- Appointment booked (on a chosen calendar)
- Form submitted with a chosen answer
- Payment received (Whop, later Stripe)
- Incoming webhook (WebinarJam, Whop, Meta lead forms)
- SMS failed
- Run by hand on selected contacts
- CSV import

### Actions

- Send SMS / send email (from a template)
- Set event start date (fixed, or from a contact field like the appointment start)
- Wait until X before or after the event (skip if past), or wait a set time
- If/else with named branches
- Add / remove tag; update a contact field (e.g. assign the closer)
- Create / update opportunity (pipeline, stage, won or lost)
- Add to / remove from another workflow
- Slack message; internal email to the team

### Settings and safety

- Re-entry on or off; quiet hours and time zone per account
- Enrolment history and execution logs
- Test mode: messages only go to Tolu's own phone and inbox
- Approval switch: a client's workflow can't go live until marked "client approved"

### Things GHL also does that this plan does **not** cover yet

Calendars and booking forms, landing pages, payment links, phone numbers and calls, a shared inbox. These stay in GHL until they're rebuilt one by one.

## 4. Build order

1. **Decisions (section 5).**
2. **Tools on the Mac:** install Node.js (the toolkit the app is built with).
3. **App skeleton:** turn os.scalency.us into a real app with a login. Proposed stack: Next.js (the app) on Netlify, Supabase (database, login and the clock that runs scheduled steps).
4. **Database:** the records in section 3, locked down so each account only sees its own data.
5. **Pipes:** Slack, email and SMS (Twilio) connections, all in test mode.
6. **Engine core:** triggers, actions, waits and logs from section 3.
7. **First workflow, in shadow mode:** see section 6.
8. **Screens:** contacts, pipelines, workflow list with on/off switches, enrolment history.
9. **Move workflows over one at a time**, then cancel Zapier.
10. **Later:** calendars and booking forms, then the rest of GHL.

## 5. Decisions

1. **Who is it for first (to decide).** Recommendation: build it for many accounts from day one (cheap now, very hard to add later), but switch on only Scalency and one test client first.
2. **Email provider (to decide).** Mailgun is already set up on `mail.scalency.us`; check whether that account is Scalency's or GHL's. Otherwise Resend.
3. **SMS (to decide).** Twilio account in Scalency's name; clients may use their own Twilio accounts (as in the Twilio SOP).
4. **First workflow (to decide).** Recommendation in section 6.

## 6. Recommended first workflow

**The WebinarJam registration chain (#11 + #1).** WebinarJam can already send a webhook, so it only needs pointing at our engine instead of Zapier. It proves the core: incoming webhook → contact → opportunity → tag → Slack → SMS timed from the event, with skip-if-past and quiet hours.

Run it in **shadow mode** on a test webinar first: test registrations only, with messages going to Tolu's own phone, while the real client keeps running on GHL and Zapier.
