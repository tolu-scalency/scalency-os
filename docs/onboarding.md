# Onboarding: building Scalency OS

Welcome. This guide gets you from zero to your first pull request. Read it top to bottom on day one.

## 1. What we're building

Scalency is a marketing agency that books high-quality appointments into clients' calendars. Today its automations run in GoHighLevel (GHL) and Zapier. **Scalency OS** is our own platform to replace both, one workflow at a time, for Scalency and for clients.

**Lead generation comes first** (VSL and book-a-call funnels), starting with the application journey: capture step 1 of an application straight away, qualify the lead, and follow up automatically. Webinars come later.

## 2. Read these first, in this order

1. `CLAUDE.md`: the team rules. Claude Code reads it automatically too.
2. `docs/plans/automation-engine.md`: the plan, and the full list of automations we're replacing.
3. `docs/plans/lead-gen-tasks.md`: your tasks, in order, each with its "done when" checks.
4. `docs/database.md`: the database, in plain English.
5. `docs/brand.md` and `docs/business-context.md`: how Scalency looks and sounds, who we sell to, and what we must never say.
6. **Tolu's SOPs**, shared with you separately (not on GitHub, because they name clients). Start with the **GHL Automation Standards** SOP: it's the standard every automation must meet, and the engine should enforce it. Then the VSL Funnel, Book-a-Call Funnel, GHL Book a Call Form, GHL Custom Fields, GHL Pipelines and GHL Calendar Setup SOPs.

## 3. The stack

| Part | What we use | Where |
|---|---|---|
| Code | GitHub, private repo | `tolu-scalency/scalency-os` |
| App | Next.js 16, TypeScript, Tailwind 4, Node.js 26 | `platform/` |
| Database, login, scheduled jobs | Supabase (Postgres), London | Project `scalency-os` |
| Hosting | Netlify | `scalency-os` → os.scalency.us; `scalency-landing` → scalency.us |
| Building | Claude Code | Your own Claude account, with "Help improve Claude" (training on your chats) switched off in its privacy settings |
| Email, SMS, Slack | To be connected, in test mode first | See the plan's decisions |

Don't add new services to production (e.g. Railway, Vercel, n8n) without agreeing it with Tolu first. Fewer moving parts is the rule.

## 4. Set up your machine

1. Install **Node.js 26** and **git**.
2. Clone the repo, then install the app's parts:
   ```bash
   git clone https://github.com/tolu-scalency/scalency-os.git
   cd scalency-os/platform && npm install
   ```
3. Create `platform/.env.local` with the keys from Scalency's password manager. Never commit it, paste it into chat, or send it by email.
4. Run the app at http://localhost:3100:
   ```bash
   npx next dev --port 3100
   ```
5. Next.js 16 differs from older versions. Read `platform/AGENTS.md`, and check the docs in `platform/node_modules/next/dist/docs/` before writing Next.js code.

## 5. How a task flows

1. **Pick the next task** in `docs/plans/lead-gen-tasks.md` (or as agreed in the weekly call).
2. **Plan before you build.** For any workflow, fill in the planning sheet in the Automation Standards SOP (goal, trigger, outcomes, exits, timings, notifications, how you'll test). Share it with Tolu if anything is unclear.
3. **Branch:** `git checkout -b <task-name>` (e.g. `l1-application-started`).
4. **Build in small steps** and commit each working step with a plain-English message.
5. **Database changes:** add a new file in `supabase/migrations/` (never edit an applied one), update `docs/database.md` to match, and test it locally before opening the pull request.
6. **Open a pull request** saying what it does, why, and how to test it (the "done when" checks). Once task 1 is done, Netlify gives every pull request a preview link.
7. **Tolu reviews** by testing the preview against the "done when" checks. Changes get merged, then deployed automatically.
8. **Applying a migration to the live database** happens only after merging, and only with Tolu's go-ahead.

## 6. What "done" means

A task is done when:

- every "done when" check passes, tested with **made-up test contacts in test mode**;
- every branch of every workflow is tested, and shows in the enrolment history and execution log;
- the code builds (`npm run build`) and passes the checker (`npm run lint`);
- the docs match: the plan, the database guide, or `CLAUDE.md` where something changed;
- Tolu has approved the pull request.

## 7. Who decides what

| You decide | Ask Tolu first |
|---|---|
| How to build it: code structure, libraries inside `platform/`, naming, tests | Anything a lead or client sees: copy, timings, page wording |
| The order of steps within a task | Switching a workflow to active, or leaving test mode |
| Small fixes to docs | Adding a paid service or a new production tool |
| | Deleting data, tables or branches |
| | Changing the plan, the pipeline stages or the scope |

If a decision is made in a call or chat, write it into the relevant doc in the same pull request. The repo is our shared memory.

## 8. Rhythm

- **Daily, written** (Slack or WhatsApp): done, next, blockers. Three lines is fine.
- **Weekly, 30 minutes:** agree the next 2–3 tasks.
- **Weekly demo:** show what works, on screen, with test contacts.
- **Stuck for more than an hour?** Ask. A quick question beats a day in the wrong direction.

## 9. Non-negotiables

- No secrets or real client data in the repo, ever. Use made-up data.
- No messages to real leads or clients' customers without Tolu's approval.
- Never push to `main`; everything goes through a pull request.
- Follow the brand guide's writing rules for anything a person reads: UK English, no em dashes, no hype.
- Never mention the Leak Test publicly (see `docs/business-context.md`).
