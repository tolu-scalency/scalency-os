# CLAUDE.md

This file gives Claude Code (claude.ai/code) the rules for working in this repository.

## Who you're working with

The owner (Tolu, `tolu-scalency`) is completely new to coding. Treat every session as teaching as well as building.

## How to explain things

- **Before doing anything**, explain what you're about to do and why, as if to a five-year-old.
  - Use **one main analogy** that carries the whole explanation (for example, "a commit is a save point in a video game").
  - Add **one or two extra analogies** for the trickier parts.
- **Explain every new word the first time you use it**, in plain language, right where it appears. Don't assume any coding vocabulary (repository, branch, commit, terminal, dependency and so on).
- Keep explanations short. Say what will happen, why it matters, and what the owner will see.
- After a step, say plainly whether it worked. If something failed, say so and explain it in the same simple way.

## Safety rules (never break these)

- **Never commit secrets or customer data.** Secrets are passwords, API keys, tokens (`github_pat_…`, `sk-…` and similar) and private keys. Customer data is names, emails, phone numbers, addresses, payment details or any real client records.
  - Real settings go in `.env`, which `.gitignore` already excludes, along with `.env.*`. Only `.env.example` gets committed, holding placeholder values and never real ones.
  - Use made-up sample data for tests and examples.
  - Before every commit, review the staged changes (`git diff --staged`) for secrets or customer data. If you find any, stop and tell the owner.
- **Always ask before deleting anything.** This covers files, folders, branches and data. Say what will be deleted and why, then wait for a clear yes.
- **Always ask before pushing** to GitHub. Explain what will be sent, then wait for a clear yes.

## Committing

- After each step that works, commit it with a clear message describing what changed and why, in plain English. For example, `Add contact form to homepage`, not `update` or `fix stuff`.
- Commit only working steps. If something is broken, fix it or tell the owner before committing.
- Commit locally only. Pushing needs the owner's permission every time.

## Reference docs

- **`docs/brand.md`: read this before any design, page, ad, email or document task.** It covers the name, voice and tone, writing rules, colours, fonts, layout style and open brand decisions. Only use what's marked confirmed or current, and don't invent answers for anything marked "to decide".
- **`docs/business-context.md`: read this before any build, copy or content task.** It covers the ICP, the Leak Test offer, the quiz funnel, objections, what we can and can't claim, and compliance rules. Never write copy that breaks its "Never say" or compliance sections.
- `docs/AI_Marketing_Platform_Build_Plan.docx` is the build plan for Scalency's AI marketing platform (modules, phases and ground rules from the SABM calls). Read it for context, for example with `textutil -convert txt -stdout docs/AI_Marketing_Platform_Build_Plan.docx`.
- **Use it as loose guidance, not a checklist.** The owner will pick which parts to build and add things it doesn't cover. Ask before assuming a feature from the plan is wanted.
- It's private and listed in `.gitignore`. Never commit or push it, and never quote large parts of it into committed files.

## Plans in progress

- `docs/plans/sales-team-booking.md`: the Sales Team round-robin booking system (Google Calendar and Calendly). Read it before working on bookings or calendars.
- `docs/plans/automation-engine.md`: Scalency's own automation engine, replacing GHL and Zapier. Read it before working on automations, workflows, contacts or pipelines.
- `docs/database.md`: the plain-English guide to the database. The exact SQL is in `supabase/migrations/`. Change the database only by adding a new migration file, never by editing one already applied, and keep the guide in step with it.
- Tolu's SOPs are in `GHL Backend SOPs/` and `Landing Page SOPs/`. They name clients, so they stay off GitHub (see `.gitignore`). Read them with `textutil -convert txt -stdout`, and never copy client names into committed files.

## Project facts

- Location on this Mac: `~/Documents/Scalency OS` (moved from `~/Developer/scalency-os` on 3 November 2026)
- GitHub: `https://github.com/tolu-scalency/scalency-os` (private), branch `main`.
- Netlify (two projects, both deploy automatically when `main` is pushed):
  - **`scalency-landing`**: public landing site from `landing/`, live at **https://scalency.us** (`www.scalency.us` redirects there). Pages: `index.html`, `book.html` (embeds the GoHighLevel `sales-call-4187` calendar) and `privacy.html`.
  - **`scalency-os`**: private back office from `public/`, at **https://os.scalency.us** (Netlify login required).
- DNS for scalency.us and scalency.co.uk is managed at **Namecheap**, not Netlify DNS. Never click "Set up Netlify DNS". Other scalency.us records are in use and must not be touched: `apply` and `onboarding` (Lovable sites) and the `mail` Mailgun records. On scalency.co.uk, `app` is the GoHighLevel login and email runs on Google Workspace.
- Purpose: Scalency's internal operating system, an internal platform for the business.
- The app lives in **`platform/`**: Next.js 16 (App Router, TypeScript, Tailwind 4, `src/` folder). Read `platform/AGENTS.md` and the docs in `platform/node_modules/next/dist/docs/` before writing Next.js code, since this version differs from older ones. Brand colours are Tailwind colours in `platform/src/app/globals.css` (`text-brand`, `bg-tint`, `border-line` and so on).
- Node.js 26 is installed in `~/.local/node` (no Homebrew). In commands, add it first: `export PATH="$HOME/.local/node/bin:$PATH"`. Run the app locally with `npx next dev --port 3100` inside `platform/`.
- Supabase: project `scalency-os` (ref `nldagscfswzzdhxsnygf`, London `eu-west-2`, Free plan) in the "Scalency" organisation. It's the live database. Keys live in the owner's password manager and `.env`, never in the repo or chat.
- os.scalency.us still serves the "coming soon" page from `public/`. Switching Netlify to `platform/` is a later step.
- Git identity for this repo: `tolu-scalency <tolu@scalency.co.uk>`.
- GitHub access uses a fine-grained personal access token saved in the macOS keychain. Never ask the owner to paste a token into chat or the terminal prompt. If access fails, they should create a new token on GitHub.
