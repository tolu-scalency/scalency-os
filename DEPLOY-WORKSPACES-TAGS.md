# Deploy: all-workspaces page, workspace rules, multi-tags, workflow zoom, show password

## What changed
- **All workspaces page** (`/workspaces`). After logging in, people with more than one workspace (or a pending invite) choose where to work. Each workspace is a card with contacts, open deals and new leads this week. Also opened from the workspace menu, "All workspaces".
- **Only owners and admins can create workspaces.** Team members don't see the button, and the database blocks it.
- **Workflow tags.** "Add a tag" and "Remove a tag" steps take several tags: type, press Enter, repeat. Existing tags are suggested as you type.
- **Workflow zoom.** −, +, percentage (click to reset) and "Fit to screen", so a whole build fits in one screenshot. The zoom level is remembered.
- **Show password.** An eye button on the log in and invite password boxes (sign up and reset already had one).
- **GHL comparison** in `docs/ghl-comparison.md`.

## Steps

### 1. Code (Command Prompt)
```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b workspaces-tags
tar -xf %USERPROFILE%\Downloads\workspaces-tags.zip
git add -A
git commit -m "All workspaces page, workspace rules, multi-tag steps, workflow zoom, show password"
git push -u origin workspaces-tags
```
Open the pull request. Don't merge yet.

### 2. Database (Supabase, SQL Editor)
```
notepad supabase\migrations\20261119090000_workspace_rules_multi_tags.sql
```
Copy all, paste into a new query, Run. Expect "Success".

### 3. Merge, wait about 3 minutes, then test
1. Log out and log in as the owner. With 2+ workspaces you land on "Where are we working today?".
2. Log in as justBenson (Team member): no "New workspace" button in the workspace menu.
3. Open a workflow: add a tag step, type two tags pressing Enter after each, Save.
4. Click "Fit to screen" on a long workflow.
5. On the log in page, click the eye in the password box.
