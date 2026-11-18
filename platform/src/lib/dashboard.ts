// The home page is a list of widgets. Each workspace can rearrange, resize, add and
// remove them; with nothing saved, everyone sees DEFAULT_LAYOUT.

import type { IconName } from "@/components/icon";

export type WidgetSize = "s" | "m" | "l" | "full";
export type Widget = { id: string; type: WidgetType; size: WidgetSize; settings?: { pipelineId?: string; title?: string; text?: string; days?: number } };

export type WidgetType =
  | "setup"
  | "stat_contacts"
  | "stat_new_contacts"
  | "stat_open_deals"
  | "stat_pipeline_value"
  | "stat_won_month"
  | "stat_win_rate"
  | "stat_tasks_due"
  | "pipeline"
  | "tasks"
  | "activity"
  | "leads_chart"
  | "leads_by_source"
  | "deals_by_owner"
  | "shortcuts"
  | "note";

export type WidgetDef = { type: WidgetType; label: string; hint: string; icon: IconName; group: string; size: WidgetSize; sizes: WidgetSize[]; once?: boolean };

const ALL: WidgetSize[] = ["s", "m", "l", "full"];
const WIDE: WidgetSize[] = ["m", "l", "full"];

export const WIDGETS: WidgetDef[] = [
  { type: "stat_contacts", label: "Total contacts", hint: "Everyone in the workspace", icon: "users", group: "Numbers", size: "s", sizes: ALL },
  { type: "stat_new_contacts", label: "New leads this week", hint: "Contacts added in the last 7 days", icon: "user", group: "Numbers", size: "s", sizes: ALL },
  { type: "stat_open_deals", label: "Open deals", hint: "Deals still in play", icon: "pipeline", group: "Numbers", size: "s", sizes: ALL },
  { type: "stat_pipeline_value", label: "Pipeline value", hint: "Total of open deals", icon: "pound", group: "Numbers", size: "s", sizes: ALL },
  { type: "stat_won_month", label: "Won this month", hint: "Value and number of deals won", icon: "star", group: "Numbers", size: "s", sizes: ALL },
  { type: "stat_win_rate", label: "Win rate", hint: "Won out of closed, last 90 days", icon: "chart", group: "Numbers", size: "s", sizes: ALL },
  { type: "stat_tasks_due", label: "Tasks due", hint: "Due today or overdue", icon: "tasks", group: "Numbers", size: "s", sizes: ALL },

  { type: "pipeline", label: "Pipeline stages", hint: "Deals in each stage of a pipeline", icon: "pipeline", group: "Charts and lists", size: "l", sizes: WIDE },
  { type: "leads_chart", label: "New leads chart", hint: "Leads added per day", icon: "chart", group: "Charts and lists", size: "m", sizes: WIDE },
  { type: "leads_by_source", label: "Leads by source", hint: "Where last month's leads came from", icon: "globe", group: "Charts and lists", size: "m", sizes: WIDE },
  { type: "deals_by_owner", label: "Deals by owner", hint: "Open deals and value per person", icon: "team", group: "Charts and lists", size: "m", sizes: WIDE },
  { type: "tasks", label: "Your tasks", hint: "Your next open tasks", icon: "tasks", group: "Charts and lists", size: "m", sizes: WIDE },
  { type: "activity", label: "Recent activity", hint: "New contacts, stage moves and notes", icon: "activity", group: "Charts and lists", size: "m", sizes: WIDE },

  { type: "setup", label: "Get set up", hint: "Checklist for new workspaces", icon: "check", group: "Other", size: "full", sizes: ["l", "full"], once: true },
  { type: "shortcuts", label: "Shortcuts", hint: "Quick links to the main areas", icon: "zap", group: "Other", size: "full", sizes: WIDE, once: true },
  { type: "note", label: "Note or announcement", hint: "Your own text for the team", icon: "edit", group: "Other", size: "m", sizes: ALL },
];

export const widgetDef = (t: string) => WIDGETS.find((w) => w.type === t);

export const DEFAULT_LAYOUT: Widget[] = [
  { id: "setup", type: "setup", size: "full" },
  { id: "k1", type: "stat_contacts", size: "s" },
  { id: "k2", type: "stat_open_deals", size: "s" },
  { id: "k3", type: "stat_pipeline_value", size: "s" },
  { id: "k4", type: "stat_tasks_due", size: "s" },
  { id: "pipe", type: "pipeline", size: "l" },
  { id: "tasks", type: "tasks", size: "m" },
  { id: "leads", type: "leads_chart", size: "m" },
  { id: "source", type: "leads_by_source", size: "m" },
  { id: "short", type: "shortcuts", size: "full" },
  { id: "act", type: "activity", size: "full" },
];

/** Keeps only widgets we know, with allowed sizes and short settings. */
export function cleanLayout(raw: unknown): Widget[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: Widget[] = [];
  for (const w of raw.slice(0, 40)) {
    const x = (w ?? {}) as Record<string, unknown>;
    const def = widgetDef(String(x.type));
    if (!def) continue;
    let id = String(x.id ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 16);
    if (!id || seen.has(id)) id = Math.random().toString(36).slice(2, 10);
    seen.add(id);
    if (def.once && out.some((o) => o.type === def.type)) continue;
    const size = def.sizes.includes(x.size as WidgetSize) ? (x.size as WidgetSize) : def.size;
    const st = (x.settings ?? {}) as Record<string, unknown>;
    const settings: Widget["settings"] = {};
    if (typeof st.pipelineId === "string" && /^[0-9a-f-]{36}$/i.test(st.pipelineId)) settings.pipelineId = st.pipelineId;
    if (typeof st.title === "string" && st.title.trim()) settings.title = st.title.trim().slice(0, 60);
    if (typeof st.text === "string" && st.text.trim()) settings.text = st.text.slice(0, 1000);
    if (st.days === 7 || st.days === 14 || st.days === 30) settings.days = st.days;
    out.push({ id, type: def.type, size, ...(Object.keys(settings).length ? { settings } : {}) });
  }
  return out;
}

/** Grid columns each size takes on a wide screen (out of 12). */
export const SPAN: Record<WidgetSize, string> = {
  s: "col-span-6 lg:col-span-3",
  m: "col-span-12 lg:col-span-6",
  l: "col-span-12 lg:col-span-8",
  full: "col-span-12",
};
export const SIZE_LABEL: Record<WidgetSize, string> = { s: "Small", m: "Half", l: "Large", full: "Full width" };
