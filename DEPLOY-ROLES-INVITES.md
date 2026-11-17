# Deploy: roles, permissions and new invite links

## What changed
- **Invite links.** Every invite email now has an **Accept invite** button that opens a page in Scalency:
  - New people type their name and a password (twice), and land straight in the workspace. Next time they log in with that email and password.
  - People who already have a login click **Log in to accept**, sign in, then **Join**.
  - Links last 7 days. **Send again** gives another 7 days and keeps the same link. **Copy link** lets you send it on WhatsApp.
- **Roles and access** (Settings, Roles and access). Each workspace starts with three roles you can edit: Team member, Sales rep (sees only their own contacts) and Viewer (look, don't touch). Add your own roles with any mix of 9 permissions.
- **Members** (Settings, Members). Choose the access when you invite, and change anyone's access from a dropdown.
- The database enforces the permissions, so hiding a button is never the only protection.

## Steps

### 1. Code (Command Prompt)
```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b roles-invites
tar -xf %USERPROFILE%\Downloads\roles-invites.zip
git add -A
git commit -m "Roles and permissions, invite links with password setup"
git push -u origin roles-invites
```
Open the pull request on GitHub. Don't merge yet.

### 2. Database (Supabase, SQL Editor)
```
notepad supabase\migrations\20261118150000_roles_and_invites.sql
```
Copy all, paste into a new query, click Run. Expect "Success. No rows returned".

### 3. Merge (GitHub)
Merge the pull request. Wait about 3 minutes for Netlify.

### 4. Test
1. Settings, Members: invite an email of yours that has never used Scalency, as **Sales rep**.
2. Open the email, click **Accept invite**, type a name and password twice. You should land in the workspace.
3. As that person: Contacts should only show contacts they own. Settings should not let them change fields.
4. As the owner: Settings, Members, change their access to **Team member**. They now see every contact.
5. Settings, Roles and access: open a role, tick or untick permissions, click Save role.
