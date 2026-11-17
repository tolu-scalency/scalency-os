// What each permission lets someone do. The database enforces the same list
// (see the roles_and_invites migration), so this file only labels and checks.

export const PERMISSIONS = [
  { key: "contacts.view_all", group: "Contacts", label: "See all contacts", hint: "Without this, people only see the contacts they own." },
  { key: "contacts.edit", group: "Contacts", label: "Add and edit contacts", hint: "Includes tags, notes and custom field values." },
  { key: "contacts.delete", group: "Contacts", label: "Delete contacts", hint: "" },
  { key: "deals.edit", group: "Pipeline", label: "Add and move deals", hint: "Create deals, change stages, values and won or lost." },
  { key: "pipeline.manage", group: "Pipeline", label: "Change pipeline stages", hint: "Add, rename, reorder and remove stages." },
  { key: "inbox.send", group: "Inbox", label: "Send emails and texts", hint: "" },
  { key: "workflows.manage", group: "Automation", label: "Manage workflows", hint: "Create, edit and switch workflows on or off." },
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
];

export function permissionsFor(role: string, rolePermissions: string[] | null | undefined): Permission[] {
  if (role === "owner" || role === "admin") return [...ALL_PERMISSIONS];
  if (rolePermissions) return rolePermissions.filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p));
  return [...DEFAULT_MEMBER_PERMISSIONS];
}

export function cleanPermissions(raw: unknown[]): Permission[] {
  return ALL_PERMISSIONS.filter((p) => raw.includes(p));
}

export const NO_ACCESS = "You don't have access to do that. Ask the workspace owner.";
