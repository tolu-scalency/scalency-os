# Deploy: new workflow builder

1. Run `supabase/migrations/20261121090000_workflow_branches.sql` in the Supabase SQL Editor FIRST.
2. Then merge the pull request. (The new page reads the `graph` column, so the SQL must be in place first.)
3. Test: open a workflow, add an If / else with two branches, put a step in each, save, turn on, add a test contact.
