import type { WorkflowStep, WorkflowTrigger } from "@/lib/data";

/** Ready-made workflows. Used by "Start a new workflow" and by the AI setup assistant. */
export type WorkflowTemplate = { name: string; description: string; trigger: WorkflowTrigger; steps: WorkflowStep[] };

export const TEMPLATES: Record<string, WorkflowTemplate> = {
  speed: {
    name: "Speed to lead",
    description: "Reply to every new lead within minutes, tell the team, and follow up if they go quiet.",
    trigger: { type: "contact_created" },
    steps: [
      { id: "s1", type: "assign", user_id: "round_robin" },
      { id: "s2", type: "sms", body: "Hi {{first_name}}, thanks for getting in touch with {{workspace}}. When's a good time for a quick call?" },
      { id: "s3", type: "email", subject: "Thanks for your enquiry, {{first_name}}", body: "Hi {{first_name}},\n\nThanks for reaching out. We'll be in touch shortly to book a quick call.\n\n{{workspace}}" },
      { id: "s4", type: "notify_team", text: "New lead: {{name}} ({{phone}})" },
      { id: "s5", type: "task", title: "Call {{first_name}}", due_in_days: 0 },
      { id: "s6", type: "wait_for_reply", amount: 1, unit: "days" },
      { id: "s7", type: "if_else", condition: { field: "replied", negate: true }, else: "end" },
      { id: "s8", type: "sms", body: "Hi {{first_name}}, just checking you saw our message. Reply here and we'll find a time." },
    ],
  },
  reply: {
    name: "Lead replied",
    description: "When a lead replies, tag them, alert the team and create a task to answer.",
    trigger: { type: "message_received", channel: "any" },
    steps: [
      { id: "r1", type: "add_tag", tag: "Replied" },
      { id: "r2", type: "notify_team", text: "{{name}} just replied. Open their conversation in the Inbox." },
      { id: "r3", type: "task", title: "Reply to {{first_name}}", due_in_days: 0 },
    ],
  },
  noshow: {
    name: "No-show follow-up",
    description: "Win back people who miss their call. Add the tag “No show” to start it.",
    trigger: { type: "tag_added", tag: "No show" },
    steps: [
      { id: "n1", type: "sms", body: "Hi {{first_name}}, sorry we missed you today. Would you like to rebook?" },
      { id: "n2", type: "wait_for_reply", amount: 1, unit: "days" },
      { id: "n3", type: "if_else", condition: { field: "replied", negate: true }, else: "end" },
      { id: "n4", type: "email", subject: "Shall we find another time?", body: "Hi {{first_name}},\n\nWe missed you on our call. Reply to this email and we'll find a time that suits you.\n\n{{workspace}}" },
      { id: "n5", type: "task", title: "Try calling {{first_name}} again", due_in_days: 2 },
    ],
  },
  won: {
    name: "Deal won",
    description: "Thank new customers, tag them and tell the team.",
    trigger: { type: "deal_won" },
    steps: [
      { id: "w1", type: "add_tag", tag: "Customer" },
      { id: "w2", type: "email", subject: "Welcome aboard, {{first_name}}", body: "Hi {{first_name}},\n\nThank you for choosing {{workspace}}. We'll be in touch with your next steps shortly.\n\n{{workspace}}" },
      { id: "w3", type: "notify_team", text: "Deal won: {{name}}" },
    ],
  },
  hook: {
    name: "Leads from another app",
    description: "Send leads in from your website, Zapier, Make or an ad platform using a webhook link.",
    trigger: { type: "webhook", token: "" },
    steps: [
      { id: "h1", type: "add_tag", tag: "Webhook" },
      { id: "h2", type: "notify_team", text: "New lead from {{source}}: {{name}}" },
    ],
  },
  alert: {
    name: "New lead alert",
    description: "Post every new lead in #leads so nobody misses one.",
    trigger: { type: "contact_created" },
    steps: [{ id: "a1", type: "notify_team", text: "New lead: {{name}} · {{email}} · {{phone}}" }],
  },
  blank: { name: "Untitled workflow", description: "", trigger: { type: "manual" }, steps: [] },
};


/** Keys the AI setup assistant may choose from (not the blank one). */
export const SETUP_TEMPLATE_KEYS = ["speed", "reply", "noshow", "won", "hook", "alert"] as const;

/** A random token for webhook-triggered workflows. */
export function newHookToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}
