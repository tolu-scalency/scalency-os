# Deploy: new sidebar, access pop-up, IDs, livelier screens

## What changed
- **Sidebar like Sensory OS.** Fewer items. Resting the pointer on one opens a panel with all its pages. On a phone, tap the arrow next to an item.
- **Every GHL-style area is in the menu**, live or "Soon": Calendar (including Zoom, Google Meet and Teams), Payments, Marketing, Sites, Memberships, Reputation, AI (voice receptionist, creative studio) and Reporting. Each "Soon" page explains what's coming.
- **Access pop-up.** Picking a role when inviting someone (or changing a member's access) shows exactly what they can and can't do, area by area. More permissions are ready for calendars, payments, marketing, sites, AI and reports.
- **IDs with copy buttons**: Workspace ID and your user ID (Settings, General), Pipeline and Stage IDs (Settings, Pipeline), Field IDs, Contact ID, Workflow ID.
- **Livelier screens.** Pages slide in gently, panels pop, cards lift on hover and buttons press. Turned off for people who set their device to reduce motion.
- **Pipeline scroll bar** now sits at the bottom of the screen, and columns run the full height.

## Steps

### 1. Code (Command Prompt)
```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b nav-access
tar -xf %USERPROFILE%\Downloads\nav-access.zip
git add -A
git commit -m "New sidebar with panels, access pop-up, IDs, motion, pipeline scroll bar"
git push -u origin nav-access
```
Open the pull request. Don't merge yet.

### 2. Database (Supabase, SQL Editor)
```
notepad supabase\migrations\20261118180000_more_permissions.sql
```
Copy all, paste into a new query, Run. Expect "Success".

### 3. Merge, wait about 3 minutes, then test
1. Rest the pointer on Payments, Calendar and Settings in the sidebar.
2. Settings, Members: pick Sales rep in the invite form. The pop-up should list what they can do.
3. Settings, General: copy your Workspace ID.
4. Pipeline: the sideways scroll bar is at the bottom of the screen.
