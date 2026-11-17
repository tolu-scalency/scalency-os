# Deploy: custom access per person, workflow autosave and cancel, tag fixes

## What changed
- **Custom access.** In Settings, Members, picking a role (or clicking "Choose access") opens tick boxes for every area, with "All of contacts" style shortcuts. Untick or tick anything to give that one person exactly what they need. Members with their own access show a "Custom" badge. Choosing a role again resets them to that role.
- **Workflow autosave.** Changes save two seconds after you stop typing. If a step isn't finished yet, a copy is kept on your device and you're offered "Restore them" next time. **Cancel** throws away unsaved changes.
- **Tags.** The suggestion list now sits above the + buttons, and typing a new tag shows **Add tag "…"**.

## Steps
### 1. Code (Command Prompt)
```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b access-autosave
tar -xf %USERPROFILE%\Downloads\access-autosave.zip
git add -A
git commit -m "Custom access per person, workflow autosave and cancel, tag picker fixes"
git push -u origin access-autosave
```
Open the pull request. Don't merge yet.

### 2. Database (Supabase, SQL Editor)
```
notepad supabase\migrations\20261119120000_custom_access.sql
```
Copy all, paste into a new query, Run. Expect "Success".

### 3. Merge, wait about 3 minutes, then test
1. Settings, Members: next to justBenson, click the shield, untick "Delete contacts", click "Use this access". A "Custom" badge appears.
2. Invite someone: pick Sales rep, tick "See all contacts", "Use this access", then Invite.
3. Open a workflow, change a step, wait 2 seconds: "All changes saved". Change something else and click Cancel.
4. In a tag step, type a new tag: "Add tag" appears.
