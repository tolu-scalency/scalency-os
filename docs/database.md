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

## Not in this version yet

Calendars and appointments (for L4 Booked Call), team notifications settings (Slack), payments and the inbox screens. They'll be added as new migrations when we build those parts.
