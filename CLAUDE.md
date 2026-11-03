# CLAUDE.md

The team rules for working in this repository with Claude Code (claude.ai/code). They apply to everyone: Tolu (the owner, `tolu-scalency`) and engineers. Personal preferences, such as how someone likes things explained, belong in that person's own `~/.claude/CLAUDE.md`, not here.

New to the project? Read `docs/onboarding.md` first.

## Safety rules (never break these)

- **Never commit secrets or customer data.** Secrets are passwords, API keys, tokens (`github_pat_…`, `sk-…` and similar) and private keys. Customer data is names, emails, phone numbers, addresses, payment details or any real client records.
  - Real settings go in `.env` files, which `.gitignore` excludes. Only `.env.example` gets committed, holding placeholder values and never real ones.
  - Use made-up sample data for tests and examples.
  - Before every commit, review the staged changes (`git diff --staged`) for secrets or customer data. If you find any, stop and tell whoever you're working with.
- **Never delete anything without asking** whoever you're working with: files, folders, branches, database rows or tables. Say what will be deleted and why, then wait for a clear yes.
- **Nothing reaches real people without Tolu's approval.** No email or SMS to a real lead or a client's customer, and no workflow switched to active, unless Tolu has approved it (Automation Standards SOP). Accounts stay in test mode until then.
- **The live database is changed only by migrations** that have been reviewed and merged (see `docs/database.md`). Never run ad hoc changes against it.

## How changes reach `main`

`main` deploys automatically (Netlify), so it only changes through review.

- **Engineers:** work on a branch named for the task (e.g. `l1-application-started`), commit as you go, push the branch and open a pull request. Tolu approves before anything is merged. Never push to `main` directly.
- **Tolu:** may commit to `main` for small changes, and pushes only when ready.
- Commit after each step that works, with a clear message saying what changed and why, in plain English. For example, `Add contact form to homepage`, not `update` or `fix stuff`.
- Commit only working steps. If something is broken, fix it or say so before committing.

## Reference docs

- **`docs/brand.md`: read this before any design, page, ad, email or document task.** It covers the name, voice and tone, writing rules, colours, fonts, layout style and open brand decisions. Only use what's marked confirmed or current, and don't invent answers for anything marked "to decide".
- **`docs/business-context.md`: read this before any build, copy or content task.** It covers the ICP, the Leak Test offer, the quiz funnel, objections, what we can and can't claim, and compliance rules. Never write copy that breaks its "Never say" or compliance sections.
- `docs/AI_Marketing_Platform_Build_Plan.docx` (private, never committed) is the build plan for Scalency's AI marketing platform. Use it as loose guidance, not a checklist, and ask before assuming a feature from it is wanted. Read it with `textutil -convert txt -stdout`. Never quote large parts of it into committed files.

## Plans in progress

- **`docs/plans/automation-engine.md`: Scalency's own automation engine, replacing GHL and Zapier.** Read it before working on automations, workflows, contacts or pipelines. Lead generation comes first.
- **`docs/plans/lead-gen-tasks.md`: the first tasks**, in order, each with its "done when" checks.
- `docs/database.md`: the plain-English guide to the database. The exact SQL is in `supabase/migrations/`. Change the database only by adding a new migration file, never by editing one already applied, and keep the guide in step with it.
- `docs/plans/sales-team-booking.md`: the Sales Team round-robin booking system (parked). Read it before working on bookings or calendars.
- Tolu's SOPs (`GHL Backend SOPs/` and `Landing Page SOPs/`) are shared separately, not through GitHub, because they name clients. Where you have them, read them with `textutil -convert txt -stdout` (Mac) or any Word reader, and never copy client names into committed files.

## Project facts

- GitHub: `https://github.com/tolu-scalency/scalency-os` (private), branch `main`.
- Netlify (two projects, both deploy automatically when `main` changes):
  - **`scalency-landing`**: public landing site from `landing/`, live at **https://scalency.us** (`www.scalency.us` redirects there). Pages: `index.html`, `book.html` (embeds the GoHighLevel `sales-call-4187` calendar) and `privacy.html`.
  - **`scalency-os`**: private back office, at **https://os.scalency.us** (Netlify login required). It still serves the "coming soon" page from `public/`. Switching it to `platform/` is task 1 in `docs/plans/lead-gen-tasks.md`.
- DNS for scalency.us and scalency.co.uk is managed at **Namecheap**, not Netlify DNS. Never click "Set up Netlify DNS". Other scalency.us records are in use and must not be touched: `apply` and `onboarding` (Lovable sites) and the `mail` Mailgun records. On scalency.co.uk, `app` is the GoHighLevel login and email runs on Google Workspace.
- Purpose: Scalency's internal operating system, an internal platform for the business.
- The app lives in **`platform/`**: Next.js 16 (App Router, TypeScript, Tailwind 4, `src/` folder), Node.js 26. Read `platform/AGENTS.md` and the docs in `platform/node_modules/next/dist/docs/` before writing Next.js code, since this version differs from older ones. Brand colours are Tailwind colours in `platform/src/app/globals.css` (`text-brand`, `bg-tint`, `border-line` and so on). Run it locally with `npx next dev --port 3100` inside `platform/`.
- Supabase: project `scalency-os` (ref `nldagscfswzzdhxsnygf`, London `eu-west-2`, Free plan) in the "Scalency" organisation. It's the live database. Keys live in Scalency's password manager and each person's own `.env`, never in the repo or chat.
