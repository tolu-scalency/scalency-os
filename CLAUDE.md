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

## Project facts

- Location on this Mac: `~/Developer/scalency-os`
- GitHub: `https://github.com/tolu-scalency/scalency-os` (private), branch `main`.
- Purpose: Scalency's internal operating system, an internal platform for the business. No app code or tech stack has been chosen yet. The `.gitignore` is GitHub's Node.js template.
- Git identity for this repo: `tolu-scalency <tolu@scalency.co.uk>`.
- GitHub access uses a fine-grained personal access token saved in the macOS keychain. Never ask the owner to paste a token into chat or the terminal prompt. If access fails, they should create a new token on GitHub.
