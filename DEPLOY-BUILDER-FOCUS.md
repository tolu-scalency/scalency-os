# Deploy: full-screen builders, "Saved" pop-ups, clearer forms check

- Builders (a form, a workflow) open full screen, with no sidebar or top bar, like GHL. The back arrow returns to the list.
- Saving shows a small "Saved" pop-up at the top of the screen. Problems show there in red.
- The forms warning now tells "server has no access to the tables" apart from "wrong key".
- New database change: `20261126090000_server_access.sql` (you may already have run it as SQL-4-server-access).

Merge forms-release first, then this.

## Steps

1. Run `supabase/migrations/20261126090000_server_access.sql` in the Supabase SQL Editor (skip if you already ran SQL-4-server-access).
2. Command Prompt:

```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b builder-focus
tar -xf %USERPROFILE%\Downloads\builder-focus.zip
git add -A
git commit -m "Full-screen builders, saved pop-ups, clearer forms check"
git push -u origin builder-focus
```

3. On GitHub: Compare & pull request, Create pull request, Merge pull request, Confirm merge.
4. Wait about 3 minutes, then open a form: no sidebar, and "Saved" appears at the top when you change something.
