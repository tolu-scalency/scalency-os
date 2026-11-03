# Plan: Scalency's own automation engine (replacing GHL and Zapier)

**Status: planning (3 November 2026).** Nothing built yet. Decisions marked **(to decide)** need Tolu.

**Sources:** Tolu's SOPs in `GHL Backend SOPs/` and `Landing Page SOPs/` (kept off GitHub because they name clients). This plan describes the automations generically and names no clients. The most relevant SOPs are the VSL Funnel, Book-a-Call Funnel, GHL Automation Standards, GHL Calendar Setup, GHL Book a Call Form, GHL Custom Fields and GHL Pipelines SOPs.

## 1. Goal

Run every automation Scalency builds today in GoHighLevel (GHL) and Zapier from Scalency OS instead (os.scalency.us), for Scalency **and** for clients, then retire Zapier and, later, GHL.

Scalency has two kinds of client, with slightly different automations:
- **Lead generation** (VSL and book-a-call funnels). **We build this first.**
- **Webinars** (masterclass funnels). These come later (section 3).

The rules in the **GHL Automation Standards SOP** carry straight over and become rules the engine enforces:
- No dates, times, links or addresses typed into messages: always custom values.
- Messages timed from the event ("wait until X before/after the appointment"), skipping any that are already past.
- One trigger with different outcomes = one workflow with named branches.
- Every message written as a template first.
- Every step, branch and workflow clearly named.
- Quiet hours (US SMS only 8 am–8 pm) in the right time zone.
- Test every outcome with a test contact; enrolment history and execution logs for everything.
- Nothing goes to a client's customers without the client's approval.

## 2. Lead generation first (VSL and book-a-call funnels)

### The journey

From the VSL Funnel and Book-a-Call Funnel SOPs:

1. **Ad** (Meta or YouTube).
2. **Landing page or VSL page** with the application form in the hero.
3. **Application, step 1:** the business owner's name, email and phone. **Saved straight away**, so we can follow up if they don't finish.
4. **Application, remaining questions:** e.g. biggest marketing challenge, team size, monthly revenue (or the client's own qualifying questions: situation, goal, obstacle, budget, start date).
5. **Routing:**
   - **Disqualified** (lowest revenue range, "I have nothing to invest", or "Not now, just exploring") → unqualified page, tagged unqualified, email nurture.
   - **Qualified** → book-a-call page with the closers' calendar → thank-you page ("You're booked. 3 quick steps to confirm your call": add to calendar, move our emails out of spam, reply YES to confirm).
6. **Sales call** with a closer, then closed or lost.

### Lead-gen workflows

Some of these are spelled out in the SOPs. Others are implied by them: the SOP says what should happen but not the exact messages. Those are marked **(to decide)**.

| # | Workflow | Trigger | What it does |
|---|---|---|---|
| L1 | Application Started | Step 1 of the application submitted | Create the contact and an opportunity in Application Started. If they don't finish or book, follow up by SMS and email (timings and copy **to decide**). |
| L2 | Unqualified | Application finished with a disqualifying answer | Tag unqualified, move to Unqualified, remove from L1 and L3, Slack message with their answers, start the email nurture (content **to decide**). |
| L3 | Qualified, Not Booked | Application finished with qualifying answers, but no booking | Save the answers on the opportunity, move to Qualified (Not Booked), remind them to book (timings and copy **to decide**). |
| L4 | Booked Call | Appointment booked on the closers' calendar | Tag booked call, move to Call Booked, remove from L1 and L3, assign the closer, confirm by SMS and email, Slack message with their answers, reminders 1 day, 1 hour, 15 min and 5 min before the call. |
| L5 | Confirmed | Lead replies YES by SMS or email | Mark the call confirmed and tell the closer. The thank-you page promises this, so it must work. |
| L6 | No-Show | Closer marks the appointment as a no-show | Tag, move to No-Show, follow up to rebook ("your call" in the Automation Standards SOP; copy **to decide**). |
| L7 | SMS Failure | An outbound SMS fails | Email asking them to check their number |

**Proposed lead-gen pipeline (to confirm):** Application Started → Qualified (Not Booked) → Call Booked → Confirmed → No Answer → No-Show → Unqualified → Follow-Up → Closed → Lost. The Pipelines SOP only gives the webinar pipeline. It says a VSL funnel gets its own pipeline, and that a stage only earns its place if it changes what the setter does next.

**Qualifying answers** are stored on the opportunity, not the contact (GHL Custom Fields SOP). The budget question follows the SOP's rules: "I have nothing to invest" first, and five options or fewer.

**Calendar** (GHL Calendar Setup SOP): round robin across all closers, 1-hour calls, 1-hour slot interval, 2 hours' minimum notice, a 3-day booking window, Google Meet. The questions come after picking a time.

## 3. Webinars later

Kept here so nothing is forgotten. Built after lead gen.

| # | Workflow | Trigger | What it does |
|---|---|---|---|
| W1 | Pre-Webinar SMS | Opportunity created: Webinar Pipeline, Registered | Confirmation SMS, then reminders 24h, 6h, 3h, 1h, 15 min before, at start, 15 min after |
| W2 | Pre-Webinar Emails | Same as W1 | Email reminders before the masterclass |
| W3 | Attended / Not Booked | Same as W1 | Follow-ups 12 hours and 3 days after |
| W4 | Attended tag | "Attended Webinar?" changes to Yes | Tag, move to Attended Webinar |
| W5 | Didn't Attend | "Attended Webinar?" changes to No | Remove from W3, tag, move to Didn't Attend, replay SMS and more |
| W6 | Booked Call | Appointment booked | Same as L4 |
| W7 | Unqualified Leads | Book a Call Form with a disqualifying budget | Tag, move to Unqualified, Slack |
| W8 | Old Registrations | Run by hand on selected contacts | Move to the Old Registrants pipeline |
| W9 | WebinarJam registration (Zap) | WebinarJam webhook | Create contact and opportunity in Registered, Slack message |
| W10 | Attendance import | CSV after each masterclass | Sets "Attended Webinar?", starting W4 and W5 |

### Shared by both kinds of client

| # | Automation | What it does |
|---|---|---|
| S1 | Whop sale (Zap) | One path per programme → Slack "new sale" → opportunity Closed / Won with the package tier → start onboarding |
| S2 | Programme onboarding | Welcome email per programme |

## 4. What the engine needs (the building blocks)

### Records (the database)

| Record | Notes |
|---|---|
| Accounts | One per business (Scalency, each client). Replaces GHL sub-accounts. Every other record belongs to one account. |
| Contacts | Name, email, phone with country code, time zone, consent to SMS and email |
| Custom fields | Per account. Qualifying answers go on the opportunity. |
| Custom values | Per account, e.g. booking link, business name, sender name |
| Tags | Exact names, per account |
| Pipelines, stages, opportunities | One pipeline per lead journey |
| Templates | Email and SMS, using custom values |
| Activity log | Every message sent and every step run |

### Triggers

- Application step 1 submitted; application finished (qualified or not)
- Appointment booked, cancelled, rescheduled or marked no-show
- Inbound SMS or email reply (e.g. "YES")
- Opportunity created or moved to a stage; contact field changed
- Payment received (Whop, later Stripe)
- Incoming webhook (Meta lead forms, Whop, WebinarJam)
- SMS failed
- Run by hand on selected contacts

### Actions

- Send SMS / send email (from a template)
- Set event start date (e.g. from the appointment start)
- Wait until X before or after the event (skip if past), or wait a set time
- If/else with named branches
- Add / remove tag; update a field (e.g. assign the closer)
- Create / update opportunity (pipeline, stage, won or lost)
- Add to / remove from another workflow
- Slack message; internal email to the team

### Settings and safety

- Re-entry on or off; quiet hours and time zone per account
- Enrolment history and execution logs
- Test mode: messages only go to Tolu's own phone and inbox
- Approval switch: a client's workflow can't go live until marked "client approved"

### Things GHL also does that this plan does **not** cover yet

Landing pages, payment links, phone numbers and calls, and a shared inbox. They stay in GHL (or are built as pages in this repo) until they're rebuilt one by one. The calendar is covered in section 6.

## 5. Build order

1. **Decisions (section 7).**
2. **Tools on the Mac:** install Node.js (the toolkit the app is built with).
3. **App skeleton:** turn os.scalency.us into a real app with a login. Proposed stack: Next.js (the app) on Netlify, Supabase (database, login and the clock that runs scheduled steps).
4. **Database:** the records in section 4, locked down so each account only sees its own data.
5. **Pipes:** Slack, email and SMS (Twilio) connections, all in test mode.
6. **Engine core:** triggers, actions, waits and logs from section 4.
7. **First lead-gen workflows, in shadow mode:** see section 6.
8. **Screens:** contacts, pipelines, workflow list with on/off switches, enrolment history.
9. **The rest of the lead-gen workflows**, then webinars, then cancel Zapier.
10. **Later:** our own calendar (see `docs/plans/sales-team-booking.md`), then the rest of GHL.

## 6. Recommended first build

**The application journey, L1 to L3:** step 1 saved straight away → qualifying questions → qualified or unqualified → tags, pipeline stage, Slack, and follow-up for anyone who doesn't finish.

Why this first:
- It's the start of every lead-gen funnel, so every client needs it.
- It doesn't depend on GHL. The application form can live on our own pages and send answers straight to our engine.
- It proves most of the building blocks: incoming form → contact → opportunity → tags → if/else → Slack → timed follow-ups with stop rules.

**Then L4 and L5 (booked call and confirmation).** While bookings still happen in the GHL calendar, GHL can ring our engine with a webhook when someone books, so the engine takes over the messages first. Our own calendar can replace GHL's later.

Test on a test funnel in **shadow mode**: test contacts only, with messages going to Tolu's own phone and inbox, while real clients keep running on GHL.

## 7. Decisions

1. **Who is it for first (to decide).** Recommendation: build it for many accounts from day one (cheap now, very hard to add later), but switch on only Scalency and one test client first.
2. **Lead-gen pipeline stages (to decide).** Confirm or change the proposed stages in section 2.
3. **Follow-up messages (to decide).** The timings and copy for L1, L2, L3 and L6. The SOPs set the structure but not the wording.
4. **Email provider (to decide).** Mailgun is already set up on `mail.scalency.us`; check whether that account is Scalency's or GHL's. Otherwise Resend.
5. **SMS (to decide).** Twilio account in Scalency's name; clients may use their own Twilio accounts (as in the Twilio SOP).
6. **Meta instant forms (to decide).** Scalency's own ads use Meta instant forms (see `docs/business-context.md`), not a landing-page application. These leads need a Meta webhook into the engine, which needs a Meta developer app and business verification.
