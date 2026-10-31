# Plan: Sales Team round-robin booking

Status: **planned, not started** (31 October 2026).

## Goal

Anyone who books a call with Scalency (potential clients) books through **one Sales Team booking link**. Every sales team member is attached to that link in a **round robin**: each booking goes to a team member who is free at that time, sharing calls out fairly. The call is written straight into that person's own calendar.

Team members use **a mix of calendars** (Google Calendar, Calendly, possibly Outlook), so the system must read all of them to avoid double-booking. **George** is the only closer at launch. The round robin must still be built for more, since the Offer doc wants a second closer by month two.

## How it works

1. **The lead opens the booking page** (public, on the landing site) and sees open times for the next 14 days (to confirm), in UK time.
2. **Open times** are slots where at least one active team member is free. That means: inside their working hours, with nothing in their Google Calendar or Calendly at that time, and at least **24 hours from now**. This 24-hour minimum notice is required, because George runs the Leak Test before the call. Never mention the test on the page.
3. **The lead picks a time** and fills in a short form (name, email, phone, business name and type).
4. **Round robin:** of the team members free at that time, the call goes to the one whose turn it is (whoever was booked least recently). An admin can pause a member or give someone a bigger share later.
5. **The booking is written** into that member's calendar with a video call link, saved in the Scalency OS database, and the lead gets a confirmation.
6. **Bookings made directly in Calendly** are pulled in automatically, so they block those times and appear in Scalency OS too.

## Pieces to build

| Piece | Where | What it does |
|---|---|---|
| Sales Team admin | os.scalency.us (private) | Add or remove members, set working hours, pause someone, connect their calendars |
| Calendar connections | Backend | Each member connects Google Calendar (sign in with Google), Calendly (their personal access token, pasted into the admin page by them, never into chat or code) and, later if needed, Outlook |
| Availability engine | Backend | Combines working hours, Google busy times, Calendly busy times, the 24-hour rule and existing bookings into open slots |
| Round robin | Backend | Picks the member for each booking and records whose turn is next |
| Booking page | Landing site (public) | Shows slots, takes details and confirms. Uses the brand guide styling. |
| Calendly sync | Backend | A Calendly **webhook** (an automatic message Calendly sends us when someone books) imports Calendly bookings |
| Database | Supabase | Tables for team members, calendar connections, working hours, bookings and the round-robin state. Row Level Security on every table. |

**Backend** means small server functions running on Supabase (Edge Functions), so both the private admin site and the public booking page can use them. All secret keys (Google client secret, Supabase secret key, Calendly tokens) live in Supabase's secret storage or `.env`, never in GitHub.

## Important constraints

- **Google sign-in approval.** Reading and writing someone's Google Calendar needs a Google Cloud project with an "OAuth consent screen". If every team member uses a **@scalency.co.uk Google Workspace** account, the app can be marked **Internal** and needs no Google review. If anyone signs in with a personal Gmail, Google requires a review of the app (it can take weeks), and until then sign-ins expire every 7 days. **Recommendation: give each sales team member a @scalency.co.uk account for their sales calendar.**
- **Calendly.** Calendly is read-only for us: we read busy times and import bookings. The booking itself is always written to a member's Google (or later Outlook) calendar, so every member needs one of those as their main calendar.
- **Personal data.** Lead details are personal data. They're covered by the privacy policy, which already names Supabase and HighLevel. Add Google and Calendly to it before launch.
- **GoHighLevel** stays the booking tool until this is live and tested. Then switch the landing page buttons over.

## Phases

0. **Set up the tools:** install Node.js, create the Google Cloud project, and confirm the decisions below.
1. **Sales Team admin and Google connection:** George connects his Google Calendar.
2. **Availability, round robin and booking page:** book a real test call into George's calendar end to end.
3. **Calendly sync:** busy times and the booking webhook.
4. **Confirmations and changes:** confirmation emails, reminders, cancel and reschedule links.
5. **Outlook**, only if a team member needs it.

Each phase ends with a test and a commit before the next starts.

## Decisions to confirm

1. Call length (e.g. 45 minutes) and gap between calls (e.g. 15 minutes).
2. Working hours and days for George.
3. How far ahead people can book (e.g. 14 days).
4. Video link: Google Meet (built into Google Calendar) or something else.
5. Exact questions on the booking form.
6. Whether George and future closers get @scalency.co.uk accounts.
