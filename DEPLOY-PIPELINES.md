# Deploy: pipelines upgrade and contact filters

## What changed
- **Multiple pipelines.** Settings, Pipeline: switch between pipelines, add a new one (from a template or your own stages), rename or delete one (only when it has no deals). The Opportunities page has a pipeline switcher.
- **Board and List views.** The list shows every deal with contact, stage, value, owner, source, status and date. Click Deal, Value or Added to sort. Totals at the bottom.
- **Card fields.** Choose what shows on each card: value, contact name, owner, source, tags, email, phone, date added. Remembered on your device.
- **Deal panel.** Click a card (or a list row) to edit the deal name, value, status (with a "why lost" reason), pipeline and stage, owner, source and deal fields. Delete a deal from there too.
- **New deal** button: pick a contact, stage, value, owner and source.
- **Pipeline filters**: search, owner, status (open, won, lost, abandoned, all), source, tag, value range and date added. Active filters show as chips you can remove.
- **Contact filters**: tag, owner, source, has email or phone, date added.
- **Deal fields.** Settings, Custom fields now has Contacts and Deals tabs.
- Workflow stage triggers can use stages from every pipeline.

## Steps
### 1. Code (Command Prompt)
```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b pipelines-upgrade
tar -xf %USERPROFILE%\Downloads\pipelines-upgrade.zip
git add -A
git commit -m "Multiple pipelines, deal list, deal panel, card fields, pipeline and contact filters, deal fields"
git push -u origin pipelines-upgrade
```
Open the pull request. Don't merge yet.

### 2. Database (Supabase, SQL Editor)
```
notepad supabase\migrations\20261120090000_pipelines_upgrade.sql
```
Copy all, paste into a new query, Run. Expect "Success".

### 3. Merge, wait about 3 minutes, then test
1. Settings, Pipeline: click New pipeline, call it Projects, start from "My own stages", create it.
2. Opportunities: switch between Sales and Projects with the dropdown at the top left.
3. Click a card: change the value and owner, Save deal. The card updates.
4. Card fields: tick Owner, Source and Tags.
5. Filters: pick an owner, Apply. Then switch to List.
6. Contacts: open Filters, pick a tag, Apply.
7. Settings, Custom fields, Deals: add a "Package" dropdown, then open a deal. The field is there.
