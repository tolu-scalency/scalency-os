# Scalency OS database

**Status: live in Supabase (3 November 2026).** Migration `20261103120000_application_journey` was run in the SQL editor and recorded in `supabase_migrations.schema_migrations`, so the Supabase CLI treats it as applied. The tables are empty.

The plain-English guide to the database. The exact instructions Supabase follows are in `supabase/migrations/`. This first version covers the application journey (L1–L3 in `docs/plans/automation-engine.md`) and the basics the automation engine needs.

## The idea

The database is a filing cabinet with **one locked drawer per business**: Scalency, and later each client. Replacing GHL sub-accounts, everything sits inside a drawer, and a team member can only open the drawers they've been given a key to.

## The tables

A table is like one spreadsheet tab: rows are records, columns are details.

### Drawers and keys

| Table | What it holds |
|---|---|
| `accounts` | One row per business. Time zone, SMS sending window (8 am–8 pm by default) and **test mode**. |
| `account_members` | Who on the team can open which drawer, and their role (owner, admin, member). |

### People and labels

| Table | What it holds |
|---|---|
| `contacts` | Name, email, phone (with country code), consent to email and SMS, unsubscribes, where they came from, and a test-contact flag. One contact per email per account, so nobody is duplicated. |
| `tags` and `contact_tags` | Labels, e.g. "unqualified" or "booked call", and which contacts carry them. |
| `custom_fields` | The extra questions each business asks, e.g. monthly revenue. Each client can have different ones. |
| `custom_values` | Dates, links, names and addresses used in messages, so nothing is typed into a message (Automation Standards SOP). |

### Pipelines

| Table | What it holds |
|---|---|
| `pipelines` and `pipeline_stages` | e.g. the lead-gen pipeline and its stages, in order. |
| `opportunities` | A contact's place in a pipeline: stage, open / won / lost, value, the closer assigned, and their **qualifying answers** (Custom Fields SOP: answers go on the opportunity). |

### Applications

| Table | What it holds |
|---|---|
| `forms` | Each application form: step 1 fields, qualifying questions, the rules that disqualify, and where qualified and unqualified people are sent. Stored as settings, so each client's form can differ. |
| `form_submissions` | One row per application. Created **the moment step 1 arrives** ("started"), then updated to "qualified" or "unqualified" when the rest is answered. Also records which answer disqualified them and where they came from (page, ad, UTM tags). |

### Automations

| Table | What it holds |
|---|---|
| `workflows` | Each automation: its name, what starts it (the trigger), its named steps, and whether it's draft, active or paused. |
| `workflow_enrollments` | Each time a contact goes through a workflow: which step they're on, when the next step is due, and why they left. This is GHL's "enrolment history". |
| `workflow_step_runs` | Every step the engine ran, skipped or failed: the execution log. |
| `message_templates` | Email and SMS templates (Automation Standards SOP: templates first). |
| `messages` | Every email and SMS sent or received, with its delivery status and any error. This later feeds the SMS Failure workflow, the "reply YES" check and a shared inbox. |
| `activity` | A timeline per contact: everything that happened to them, in order. |

## How an application flows through the cabinet

1. **Step 1 arrives** (name, email, phone): the server finds or creates the **contact**, creates a **form submission** marked "started" and an **opportunity** in the first stage, and logs it in **activity**. The Application Started workflow starts (a new **enrollment**).
2. **The rest arrives:** the answers are saved on the submission and the opportunity. The form's rules mark it **qualified** or **unqualified** (recording the answer that disqualified them), and the opportunity moves stage.
3. **The engine** sees the change, ends the Application Started follow-ups, and starts the Qualified or Unqualified workflow. Every step it runs goes into the **execution log**, and every message into **messages**.

## Safety built into the cabinet

These are rules the database itself enforces, so a mistake in the app can't break them:

- **Locked drawers (row-level security):** a signed-in team member only sees accounts they're a member of. Public visitors (people filling in forms) can't read or write anything directly. Their answers go through the app's server.
- **No cross-wiring:** a contact, tag, pipeline or workflow in one account can't be linked to a record in another account.
- **Stages match pipelines:** an opportunity can't sit in a stage from a different pipeline.
- **Client approval:** a workflow can't be switched to active until it's marked as client-approved (Automation Standards SOP: nothing goes to a client's customers without their approval).
- **Test mode on by default:** new accounts start in test mode, where messages go only to the test email and phone.
- **One at a time:** a contact can't be in the same workflow twice at once.
- **Clean data:** phone numbers must include the country code, emails must look like emails, and every contact needs an email or a phone.

## Setting up an account

Migration `20261109120000_account_setup` adds two helpers that are run by hand in the Supabase SQL editor. The app and the public can't call them.

| Helper | What it does |
|---|---|
| `setup_account(name, slug, owner_email, test_phone)` | Creates the account (in test mode, with the owner's email as the test inbox), makes that login its **owner**, and adds the **Lead gen** pipeline with its 10 stages. |
| `add_account_member(slug, email, role)` | Gives another login access to an account, as owner, admin or member. |

The login must exist first: invite the person in Supabase under Authentication > Users. Step-by-step instructions are in `docs/setup-dev.md`.

## Sign-up and onboarding

Migration `20261110120000_self_signup` lets anyone create an account from os.scalency.us/signup and set up their own workspace.

| Part | What it does |
|---|---|
| `profiles` table | One row per login: full name, role and mobile number. People can only see and edit their own row. |
| `accounts.onboarding` | What the business told us when it signed up: website, industry, team size, goals, leads each month and how they heard about us. |
| `create_my_workspace(business_name, details)` | Called by the app at the end of onboarding, as the signed-in person. Creates their account in test mode (their email is the test inbox), makes them the **owner** and adds the **Lead gen** pipeline with its 10 stages. If they already own an account it returns that one. Signed-out visitors can't call it. |

The flow: **/signup** (name, email, password), then **/welcome** (about you, your business, your goals), then the dashboard.

## Launch

Migration `20261111090000_launch` gets the app ready for public use.

| Part | What it does |
|---|---|
| `create_my_workspace` (updated) | New workspaces start empty. The owner builds their own pipeline in the app, from a template or their own stages. |
| `tasks` table | To-dos with an optional due date and contact. Members of the workspace can see and change them. |
| `account_invites` table | An owner or admin adds an email. `accept_my_invites()` joins that person to the workspace when they sign up or log in. |
| `profiles.email` and `is_teammate()` | Teammates can see each other's names and emails on the Team page. |
| `remove_account_member()` | Owners can remove someone from their workspace (not themselves). |

## Workspaces, workflows and chat

Migration `20261112090000_workspaces_workflows_chat`.

| Part | What it does |
|---|---|
| `create_workspace(name)` | Creates another workspace (like a GoHighLevel sub-account) with the signed-in person as owner. Up to 25 each. The app remembers the current one in a cookie. |
| `my_pending_invites()`, `accept_invite(id)` | Lets someone who already has a login see and accept invites from the workspace menu. |
| `chat_channels`, `chat_messages` | Team chat. Members read and post in their workspace; messages from workflows have no author. Realtime is switched on for live updates. |
| `enroll_contact()` | Puts a contact into a workflow (once at a time). |
| `run_due_workflows(account)` | The engine. Runs due steps for each enrolment, stops at each wait, logs every step in `workflow_step_runs`. Supabase Cron calls it every minute; the app also calls it straight after a change so the first steps run at once. |
| Triggers on `contacts` and `opportunities` | A new contact, or a contact entering a stage, enrols them in matching active workflows. |

**Workflow format.** `trigger` is `{"type": "contact_created"}`, `{"type": "stage_entered", "stage_id": "..."}` or `{"type": "manual"}`. `steps` is a list run top to bottom:
`wait` (amount, unit: minutes/hours/days), `email` (subject, body), `sms` (body), `task` (title, due_in_days), `move_stage` (stage_id), `note` (text), `notify_team` (text, posted in #leads). Messages can use `{{first_name}}`, `{{last_name}}`, `{{name}}`, `{{email}}`, `{{phone}}` and `{{workspace}}`.

**Test mode.** Emails and texts are saved in `messages` addressed to the workspace's test email or phone, with status `held_test_mode`. Nothing is delivered until Resend and Twilio are connected.

## Workflow pack

Migration `20261113090000_workflow_pack`.

| Part | What it does |
|---|---|
| `contacts.owner_id` | Who looks after the contact. Set on the contact page or by an "Assign" step. |
| `workflows.stop_on_reply` | On by default. A reply from the lead takes them out of the workflow, unless it is in a "Wait for a reply" step. |
| `outbound_webhooks` | Webhooks queued by workflows. The app's clock posts them (secret key only) and records the answer. |
| `sms_window_opens()`, `next_local_time()` | Texting hours and "wait until 9am" in the workspace's time zone (`accounts.timezone`, `sms_window_start`, `sms_window_end`). Texting hours apply in live mode only. |
| `wf_condition()` | Checks an if/else condition. |
| Triggers on `contact_tags`, `opportunities.status`, `messages` | Tag added or removed, deal won or lost, and lead replied start matching workflows. A reply also wakes "Wait for a reply" steps. |

**New triggers.** `{"type": "tag_added", "tag": "Hot"}`, `tag_removed`, `{"type": "deal_won"}`, `deal_lost`, `{"type": "message_received", "channel": "any|sms|email"}`, `{"type": "webhook", "token": "..."}` (leads posted to `/api/hooks/<token>`).

**New steps.** Every step now has an `id`. `wait_until` (hour, minute, weekdays_only), `wait_for_reply` (amount, unit), `if_else` (condition: field, value, negate; else: a later step id or "end"), `add_tag`/`remove_tag` (tag), `assign` (user_id or "round_robin"), `set_status` (open/won/lost), `add_to_workflow`/`remove_from_workflow` (workflow_id), `webhook` (url, https only), `end`. Conditions: `replied`, `has_tag`, `in_stage`, `deal_status`, `has_email`, `has_phone`, `has_owner`, `source_is`. `{{source}}` is a new merge field.

**Safety.** Unsubscribed contacts are never emailed or texted (STOP replies set `sms_unsubscribed_at`). If/else can only jump forward, so a workflow can never loop.

**Text replies.** Twilio posts replies to `/api/inbound/twilio` (signature checked). The reply is matched to whoever was last texted at that number, saved in `messages` as inbound, and shown in the Inbox.

## Email designer and custom fields

Migration `20261114090000_email_builder_fields`.

| Part | What it does |
|---|---|
| `messages.html` | The designed version of an email (from the Design or HTML code tab). A full HTML document is sent as written; a design is placed in the clean Scalency frame. |
| `render_template()` | Now also fills `{{contact.<key>}}` (custom fields on the contact), `{{custom_values.<key>}}`, `{{owner_name}}`, `{{owner_first_name}}`, `{{owner_email}}`, `{{owner_phone}}`. Unknown keys become blank. |
| `preview_template()` | Fills merge fields for one contact, for previews in the app. |
| New steps | `update_field` (field: first_name, last_name, source or custom:<key>; value) and `email_team` (to: owner, everyone or a user id; subject; body). Team emails go to staff, so test mode doesn't redirect them. |

Custom fields (`custom_fields`, object "contact") and custom values (`custom_values`) are managed in Settings, then Custom fields.

### Field types

Migration `20261118090000_field_types`. Each custom field has a type: short text, long text, number, money, date, dropdown (`select`), multi-select, yes/no, website link, email or phone. Dropdowns keep their choices in `options` (up to 50).

Values live in `contacts.custom` in their proper shape: numbers and money as numbers, yes/no as true/false, multi-select as a list, dates as `YYYY-MM-DD`. The trigger `contacts_shape_custom` (function `shape_contact_custom`) shapes every write, including workflow "Update a field" steps, using `coerce_field_value`. Anything it can't read is kept as text, so nothing is lost. `render_template` shows these nicely in messages: lists as "a, b", Yes/No, dates as "1 Dec 2026", money with two decimals.

The AI setup assistant can now create typed fields and dropdown options.

## AI setup assistant

Migration `20261117090000_ai_setup`, plus the edge function `supabase/functions/ai-setup`.

| Part | What it does |
|---|---|
| `workspace_setups` | One row each time someone asks the AI to suggest a setup. Holds a short excerpt of what they shared, the AI's proposal (`blueprint`), the status (draft, applied, undone) and what was built (`result`). Members can read their account's rows; owners and admins create drafts. |
| `can_manage_account()` | True for the account's owner or an admin. |
| `apply_workspace_setup(setup, plan)` | Builds a reviewed plan in one go: creates the pipeline if there isn't one (or replaces its stages when asked and no deals exist), adds new fields, tags and custom values only, creates workflows switched off, adds tasks for the person running it. A setup can only be applied once. |
| `undo_workspace_setup(setup)` | Removes what a setup added, keeping anything already in use (workflows that are on or have run, tags on contacts, pipelines with deals, finished tasks). |
| Edge function `ai-setup` | Reads pasted text, a voice transcript or a PDF and asks Claude for a proposal. Claude can only pick from fixed building blocks; workflows come from our tested templates by key, never written by the AI. Limited to 20 runs per workspace per day. Needs the `ANTHROPIC_API_KEY` secret (and optionally `ANTHROPIC_MODEL`). |

Nothing changes in a workspace until someone reviews the proposal and clicks Build.

## Workspace names in sign-in emails

Migration `20261118120000_workspace_name_in_emails`. Each user's auth metadata holds `workspace_name`: the first workspace they joined. `sync_workspace_name(user)` sets it, and triggers keep it current when someone joins or leaves a workspace (`account_members_workspace_name`) or a workspace is renamed (`accounts_workspace_name`). The sign-in, password, code and email-change templates in `supabase/templates` read it, so they say "Sign in to Maximus HQ" rather than "Scalency OS".

## Roles, permissions and invite links

Migration `20261118150000_roles_and_invites`.

| Part | What it does |
|---|---|
| `account_roles` | A workspace's roles: name, description and a list of permissions. Every workspace starts with Team member, Sales rep and Viewer. |
| `account_members.role_id`, `account_invites.role_id` | The role someone has, or is invited with. Owners and admins have no role: they can do everything. Members with no role keep the default member access. |
| Permissions | `contacts.view_all`, `contacts.edit`, `contacts.delete`, `deals.edit`, `pipeline.manage`, `inbox.send`, `workflows.manage`, `settings.manage`, `team.manage` (`all_permissions()`). |
| `my_permissions(account)`, `has_permission(account, perm)`, `accounts_where_i_can(perm)` | What the signed-in person can do. Policies use `accounts_where_i_can` so the check runs once per query. |
| Restrictive policies | Added on top of "members manage their accounts' records" on contacts, deals, messages, activity, tags, pipelines, stages, workflows, custom fields and values, templates, forms, webhooks, the workspace and invites. People without `contacts.view_all` only see contacts they own (and their deals, messages and activity). New contacts they add are owned by them (`contacts_own_new`). |
| `set_member_access(account, member, role, role_id)` | Changes someone's access. Needs `team.manage`. The owner can't be changed. |
| `can_manage_account(account)` | Now means `settings.manage` (used by AI setup). |
| `account_invites.token`, `expires_at` | Each invite has a private link (`/invite/<token>`) that lasts 7 days. `refresh_invite` gives it another 7 days and keeps the same link. |
| `invite_details(token)` | What the invite page shows. Callable without signing in. |
| `accept_invite_token(token)` | Joins the signed-in person to the workspace, with the invited access, if the invite was sent to their email. |

The workflow engine and webhooks run as the server, so roles don't limit them.

Migration `20261118180000_more_permissions` adds permissions for areas that are coming: `calendars.manage`, `payments.manage`, `marketing.manage`, `sites.manage`, `ai.manage` and `reporting.view`. Roles can switch them on now; each feature checks its permission when it goes live.

## Workspace rules and multi-tag steps

Migration `20261119090000_workspace_rules_multi_tags`.

- `create_workspace` now refuses people who are only members (not owner or admin) in every workspace they belong to. `can_create_workspace()` tells the app whether to show the button.
- Workflow "Add a tag" and "Remove a tag" steps take a list (`tags`). Older steps with a single `tag` still work.

## Custom access per person

Migration `20261119120000_custom_access`. `account_members.permissions` and `account_invites.permissions` hold a person's own permission list, set by ticking boxes in the access pop-up. When present it wins over their role (owners and admins still have everything). `set_member_permissions(account, member, base_role, permissions)` saves it; choosing a role again with `set_member_access` clears it. New permissions: `contacts.import`, `contacts.export`, `calls.make`.

## Pipelines upgrade

Migration `20261120090000_pipelines_upgrade`. Workspaces can have up to 20 pipelines (`pipelines.position` orders them). Deals (`opportunities`) use their existing `name`, `value_pence`, `status`, `source`, `assigned_to` (owner) and `custom` (deal fields, `custom_fields.object = 'opportunity'`), plus a new `lost_reason`. `delete_pipeline(id)` removes a pipeline only when it has no deals and isn't the last one. Workflow stage triggers and steps can use stages from any pipeline.

## Workflow branches

Migration `20261121090000_workflow_branches`.

- `workflows.graph` (jsonb) keeps the builder's layout: a tree where each If / else has named branches with their own steps. The app compiles it into `workflows.steps`, the flat list the engine runs. Workflows saved before this keep working; the builder converts them when opened.
- New step types in `steps`: `branch` (`routes` with `name`, `match` all or any, `conditions`, `goto`, plus `otherwise_name` and `otherwise_goto`) and `goto` (`target`). Jumps only go forward, so a workflow can't loop. `goto` steps aren't written to the run history; a `branch` step records which branch was taken.
- More conditions in `wf_condition`: any contact field (is, is not, contains, does not contain, empty, not empty, more than, less than), assigned user, deal value, pipeline, day of the week and time of day (in the workspace's time zone). `wf_match` checks a list with AND or OR. Helpers: `wf_compare`, `wf_step_index`. None of these can be called from the app directly.

## Editable home page and pipeline triggers

Migration `20261122090000_dashboard_and_triggers`.

- `accounts.dashboard` (jsonb) holds the workspace's home page layout: a list of widgets (`id`, `type`, `size`, `settings`). Empty means the default layout. `save_dashboard(account, layout)` saves it and needs `settings.manage`.
- Workflow triggers can now be `deal_created` (optionally in one pipeline), `stage_entered` with `stage_id = 'any'` plus a `pipeline_id` (any stage move in that pipeline), and `deal_won` / `deal_lost` limited to one pipeline. New workflows start with trigger `none` and can't be turned on until one is chosen.

## Forms

Migration `20261123090000_forms`.

- Reuses `forms` and `form_submissions`. `forms.definition` holds the fields, heading, button, thank-you message, consent box and style. New columns: `tags` (added to everyone who submits), `stage_id` (optional deal in that stage), `redirect_url` (https thank-you page).
- `form_submissions.status` can now be `submitted` (one-step forms). `answers` keeps `{ fields: [{label, value}], consent }`; `tracking` keeps the page, UTM tags and a hashed visitor id used to limit repeat sends.
- Building forms needs `sites.manage`. Public submissions go through `/api/forms/<id>` with the service key, so nothing public is opened in the database.
- New workflow trigger `form_submitted` (optionally `form_id`), fired by `workflows_on_form_submitted`.

## Not in this version yet

Calendars and appointments (for L4 Booked Call), team notifications settings (Slack), payments and the inbox screens. They'll be added as new migrations when we build those parts.
