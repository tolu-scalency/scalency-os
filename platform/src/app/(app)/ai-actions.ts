"use server";

import { formatPence, getDashboard, getWorkspace, listContacts, listTasks } from "@/lib/data";

/** Quick contact search for the command bar. */
export async function quickSearch(q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  const ws = await getWorkspace();
  const rows = await listContacts(ws.account.id, term, 6);
  return rows.map((c) => ({ id: c.id, name: c.name, sub: c.email ?? c.phone ?? "", stage: c.stage }));
}

/**
 * Answers a question about the workspace with Claude. Needs ANTHROPIC_API_KEY in Netlify's
 * environment variables. Only a short summary of the workspace is sent, never the whole database.
 */
export async function askAI(question: string): Promise<{ answer?: string; notice?: string }> {
  const q = question.trim().slice(0, 1000);
  if (!q) return { notice: "Ask a question first." };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { notice: "Scalency AI isn't switched on yet. Add an Anthropic API key in Netlify (ANTHROPIC_API_KEY) and it will answer here." };

  const ws = await getWorkspace();
  const [d, contacts, tasks] = await Promise.all([getDashboard(ws.account.id), listContacts(ws.account.id, "", 25), listTasks(ws.account.id, "open", 15)]);
  const summary = [
    `Workspace: ${ws.account.name}. Today: ${new Date().toDateString()}.`,
    `Contacts: ${d.totalContacts} (${d.newContactsThisWeek} new this week). Open deals: ${d.openOpportunities}, worth ${formatPence(d.pipelineTotalPence)}. Tasks due: ${d.tasksDue}.`,
    `Pipeline stages: ${d.stages.map((s) => `${s.name} ${s.count}`).join(", ") || "not set up"}.`,
    `Recent contacts: ${contacts.map((c) => `${c.name}${c.stage ? ` (${c.stage}${c.valuePence ? `, ${formatPence(c.valuePence)}` : ""})` : ""}`).join("; ") || "none"}.`,
    `Open tasks: ${tasks.map((t) => `${t.title}${t.dueOn ? ` due ${t.dueOn}` : ""}${t.contactName ? ` for ${t.contactName}` : ""}`).join("; ") || "none"}.`,
  ].join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
        max_tokens: 700,
        system:
          "You are Scalency AI, the assistant inside Scalency OS, a CRM for UK service businesses. Answer briefly and practically in UK English, using the workspace summary. If the summary doesn't contain the answer, say so and suggest where in the app to look. No hype.\n\n" +
          summary,
        messages: [{ role: "user", content: q }],
      }),
      cache: "no-store",
    });
    if (!res.ok) return { notice: "Scalency AI couldn't answer just now. Please try again in a moment." };
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const answer = data.content?.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
    return answer ? { answer } : { notice: "No answer came back. Try rephrasing." };
  } catch {
    return { notice: "Scalency AI couldn't be reached. Please try again." };
  }
}
