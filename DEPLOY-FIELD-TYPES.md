# Deploy: field types

Custom fields can now be: Short text, Long text, Number, Money, Date, Dropdown, Multi-select, Yes / No, Website link, Email, Phone.

- Settings, Custom fields: pick a type when adding a field. Dropdowns ask for their options (one per line). Each field has an Edit button to rename it or change its options.
- Contact page: each field shows the right box (date picker, £ money box, dropdown, tick chips for multi-select, Yes / No).
- Workflows, "Update a field": dropdown, yes/no and date fields show the right picker.
- AI setup: the AI now picks a type for each field and suggests dropdown options. You can change the type before building.
- Messages: {{contact.field}} shows values nicely, e.g. "1 Dec 2026", "2,500.00", "SEO, Paid ads", "Yes".

Existing fields stay as Short text and keep their values.

## Steps

### 1. Code (Command Prompt)
```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b field-types
tar -xf %USERPROFILE%\Downloads\field-types.zip
git add -A
git commit -m "Field types for custom fields"
git push -u origin field-types
```
Open the pull request on GitHub. Don't merge yet.

### 2. Database (Supabase, SQL Editor)
```
notepad supabase\migrations\20261118090000_field_types.sql
```
Ctrl + A, Ctrl + C. In Supabase: SQL Editor, New query, paste, Run. Expect "Success. No rows returned".

### 3. AI function (Supabase, Edge Functions)
```
notepad supabase\functions\ai-setup\index.ts
```
Ctrl + A, Ctrl + C. In Supabase: Edge Functions, ai-setup, Code tab, select all, paste, Deploy.

### 4. Merge and test
1. Merge the pull request and wait about 3 minutes for Netlify.
2. Settings, Custom fields: add a Dropdown field called "Service" with 3 options, and a Date field called "Renewal date".
3. Open a contact: pick a service and a date, click Save fields, refresh the page. They should still be there.
4. Try AI setup again: fields now show a type you can change.
