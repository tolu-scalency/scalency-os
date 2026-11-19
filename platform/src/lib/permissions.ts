// What each permission lets someone do. The database enforces the same list
// (see the roles_and_invites migration), so this file only labels and checks.

export type PermissionInfo = { key: string; group: string; label: string; hint: string; soon?: boolean };

export const PERMISSIONS = [
  { key: "contacts.view_all", group: "Contacts", label: "See all contacts", hint: "Without this, people only see the contacts they own." },
  { key: "contacts.edit", group: "Contacts", label: "Add and edit contacts", hint: "Includes tags, notes and custom field values." },
  { key: "contacts.delete", group: "Contacts", label: "Delete contacts", hint: "" },
  { key: "contacts.import", group: "Contacts", label: "Import contacts", hint: "Bring contacts in from a spreadsheet.", soon: true },
  { key: "contacts.export", group: "Contacts", label: "Export contacts", hint: "Download contacts as a spreadsheet.", soon: true },
  { key: "deals.edit", group: "Pipeline", label: "Add and move deals", hint: "Create deals, change stages, values and won or lost." },
  { key: "pipeline.manage", group: "Pipeline", label: "Change pipeline stages", hint: "Add, rename, reorder and remove stages." },
  { key: "inbox.send", group: "Inbox", label: "Send emails and texts", hint: "" },
  { key: "calls.make", group: "Inbox", label: "Make and log calls", hint: "Call leads from Scalency and log the outcome." },
  { key: "workflows.manage", group: "Automation", label: "Manage workflows", hint: "Create, edit and switch workflows on or off." },
  { key: "calendars.manage", group: "Calendar", label: "Manage calendars and bookings", hint: "Calendars, booking pages and appointments.", soon: true },
  { key: "payments.manage", group: "Payments", label: "Manage payments", hint: "Invoices, products, subscriptions and refunds.", soon: true },
  { key: "marketing.manage", group: "Marketing", label: "Manage marketing", hint: "Campaigns, social planner and templates.", soon: true },
  { key: "sites.manage", group: "Sites", label: "Manage sites and forms", hint: "Funnels, websites, forms and surveys." },
  { key: "ai.manage", group: "AI", label: "Manage AI", hint: "AI agents, voice receptionist and creative studio.", soon: true },
  { key: "reporting.view", group: "Reporting", label: "See reports", hint: "Dashboards and reports.", soon: true },
  { key: "settings.manage", group: "Settings", label: "Change workspace settings", hint: "Custom fields, saved details, tags, sending and AI setup." },
  { key: "team.manage", group: "Settings", label: "Manage the team", hint: "Invite and remove people, and change roles." },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];
export const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.key) as Permission[];

/** What members with no role can do (matches the database). */
export const DEFAULT_MEMBER_PERMISSIONS: Permission[] = [
  "contacts.view_all",
  "contacts.edit",
  "contacts.delete",
  "deals.edit",
  "pipeline.manage",
  "inbox.send",
  "workflows.manage",
  "calendars.manage",
  "marketing.manage",
  "sites.manage",
  "reporting.view",
];

export function permissionsFor(role: string, rolePermissions: string[] | null | undefined, own?: string[] | null): Permission[] {
  if (role === "owner" || role === "admin") return [...ALL_PERMISSIONS];
  if (own) return own.filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p));
  if (rolePermissions) return rolePermissions.filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p));
  return [...DEFAULT_MEMBER_PERMISSIONS];
}

export function cleanPermissions(raw: unknown[]): Permission[] {
  return ALL_PERMISSIONS.filter((p) => raw.includes(p));
}

export const NO_ACCESS = "You don't have access to do that. Ask the workspace owner.";
