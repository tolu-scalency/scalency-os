# Deploy: AI setup assistant

What it does: a business owner describes their business (types it, speaks it, or attaches a PDF). The AI suggests a pipeline, contact fields, tags, starter workflows, first tasks and saved details. They check and edit everything, then click Build. Workflows are created switched off. There is an Undo button.

There are 4 parts. Do them in this order.

---

## 1. Put the code on a new branch (GitHub Desktop or Command Prompt)

In Command Prompt:

```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b ai-setup
tar -xf %USERPROFILE%\Downloads\ai-setup.zip
git add -A
git commit -m "AI setup assistant"
git push -u origin ai-setup
```

Then on GitHub, open a pull request from `ai-setup` into `main`. Don't merge it yet.

## 2. Run the database change (Supabase)

1. Supabase, open the project, then **SQL Editor**, then **New query**.
2. Open `supabase/migrations/20261117090000_ai_setup.sql` from the zip, copy all of it, paste it in, click **Run**.
3. You should see "Success. No rows returned".

## 3. Create the AI function (Supabase)

1. Supabase, then **Edge Functions**, then **Deploy a new function**, then **Via Editor**.
2. Name it exactly: `ai-setup`
3. Delete the sample code. Open `supabase/functions/ai-setup/index.ts` from the zip, copy all of it, paste it in.
4. Click **Deploy function**. Leave "Verify JWT" switched on.

## 4. Add the Claude key to the function (Supabase)

1. Supabase, then **Edge Functions**, then **Secrets**.
2. Add a secret. Name: `ANTHROPIC_API_KEY`. Value: your Claude key from console.anthropic.com.
3. Save.

Type the key straight into Supabase. Don't paste it in chat or in any file.

Optional: add `ANTHROPIC_MODEL` if you want a different Claude model. Without it, the function uses `claude-sonnet-5-5`.

## 5. Merge and test

1. Merge the pull request. Netlify deploys on its own (about 3 minutes).
2. Log in at os.scalency.us. In the sidebar under Automation, click **AI setup**.
3. Click one of the examples on the right, then **Suggest my setup**. Wait 20 to 40 seconds.
4. Check the suggestion, remove a tag, then click **Build my workspace**.
5. Open Pipeline, Workflows and Tasks to see what it made. Workflows should all be off.
6. Go back to AI setup and try **Undo it** on the right.

New sign-ups now land on this page straight after onboarding, with a "Skip for now" button.

## If something goes wrong

| You see | What to do |
|---|---|
| "The AI is not set up yet" | Step 4 is missing, or the secret name is spelt differently. |
| "We couldn't reach the AI just now" | The function isn't deployed, or its name isn't exactly `ai-setup`. |
| "The AI could not read that just now" | The Claude key is wrong or out of credit. Supabase, Edge Functions, ai-setup, **Logs** shows the reason. |
| "Only the owner or an admin..." | Log in as the workspace owner. |
| "You have used today's limit" | 20 runs per workspace per day. Resets after 24 hours. |

## Cost

Each run is one Claude call, roughly 2p to 6p with Sonnet, more for long PDFs. The 20-a-day limit caps it per workspace.

## Files in this zip

- `supabase/migrations/20261117090000_ai_setup.sql` (new)
- `supabase/functions/ai-setup/index.ts` (new)
- `platform/src/app/(app)/ai-builder/page.tsx`, `actions.ts`, `setup-wizard.tsx` (the page)
- `platform/src/lib/setup.ts`, `platform/src/lib/workflow-templates.ts` (new, shared)
- `platform/src/app/(app)/workflows/actions.ts` (templates moved to the shared file)
- `platform/src/app/(app)/dashboard/page.tsx`, `platform/src/components/shell/app-shell.tsx`, `platform/src/components/shell/command.tsx`, `platform/src/lib/features.ts`, `platform/src/components/icon.tsx` (entry points and icons)
- `platform/src/app/welcome/actions.ts` (new sign-ups go to AI setup)
- `docs/database.md`
