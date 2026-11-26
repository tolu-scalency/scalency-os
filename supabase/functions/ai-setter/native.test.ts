// Tests for the setter inside Scalency (no GHL): a pretend Claude, a pretend database and a pretend booking page.
// Run: deno test --allow-env supabase/functions/ai-setter/native.test.ts

import { deepStrictEqual, ok } from "node:assert/strict";
import { nativeWork, nativeTurns, nativeLead, contactDetailsIn, type Agent, type Thread, type ClaudeResponse } from "./index.ts";

const tool = (name: string, input: Record<string, unknown>) => ({ type: "tool_use" as const, id: crypto.randomUUID(), name, input });
function scripted(steps: (() => ClaudeResponse)[]) {
  let i = 0;
  return async () => steps[Math.min(i++, steps.length - 1)]();
}

type Row = Record<string, unknown>;
/** A pretend Supabase: returns the given rows per table and records every insert and update. */
function fakeDb(tables: Record<string, Row[]>) {
  const writes: { table: string; op: string; data: Row }[] = [];
  const from = (table: string) => {
    let one = false;
    const b: Record<string, unknown> = {
      insert(d: Row) {
        writes.push({ table, op: "insert", data: d });
        const made = { id: `${table}-${writes.length}`, ...d };
        return { select: () => ({ single: async () => ({ data: made, error: null }) }), then: (r: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(r) };
      },
      update(d: Row) {
        writes.push({ table, op: "update", data: d });
        return b;
      },
      select: () => b,
      eq: () => b,
      neq: () => b,
      not: () => b,
      lte: () => b,
      gte: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: async () => ({ data: (tables[table] ?? [])[0] ?? null }),
      single: async () => ({ data: (tables[table] ?? [])[0] ?? null }),
      then: (r: (v: unknown) => unknown) => Promise.resolve({ data: one ? (tables[table] ?? [])[0] : (tables[table] ?? []), error: null }).then(r),
    };
    return b;
  };
  return { db: { from, rpc: async () => ({ data: "room1" }) } as unknown as Parameters<typeof nativeWork>[0], writes };
}

const agent = {
  id: "a1",
  account_id: "acc1",
  name: "Setter",
  status: "live",
  business: { clinicName: "Scalency", agentName: "Ada", timezone: "Europe/London", spelling: "UK" },
  rules: { start: "00:00", end: "23:59", days: [0, 1, 2, 3, 4, 5, 6] },
  ghl_location_id: null,
  ghl_calendar_id: null,
  ghl_pipeline_id: null,
  ghl_stages: {},
  ghl_token: null,
  webhook_key: "k",
  engine: "scalency",
  calendar_id: "11111111-1111-1111-1111-111111111111",
} as unknown as Agent;
const thread = (over: Partial<Thread> = {}) =>
  ({ id: "t1", agent_id: "a1", account_id: "acc1", ghl_contact_id: "sc:c1", contact_id: "c1", contact_name: "Ben", state: "active", channel: "SMS", touches: 0, total_touches: 0, next_action_at: null, next_action: "opener", reply_token: null, last_inbound_at: null, last_outbound_at: null, sent_ids: [], ...over }) as Thread;
const ben = { id: "c1", account_id: "acc1", first_name: "Ben", last_name: "Hart", email: "ben@example.com", phone: "+447700900123", source: "Application form", custom: {}, created_at: "2026-11-26T09:00:00Z", email_unsubscribed_at: null, sms_unsubscribed_at: null };
const base = (msgs: Row[] = [], contact: Row = ben) => ({
  contacts: [contact],
  accounts: [{ name: "Scalency", test_mode: false, test_email: "test@example.com", test_phone: "+447700900999" }],
  contact_tags: [{ tags: { name: "AI setter" } }],
  form_submissions: [{ answers: { "Monthly revenue": "£20k", Email: "ben@example.com" } }],
  messages: msgs,
});
const now = new Date("2026-11-26T10:00:00Z");
const slotIso = "2026-11-27T14:00:00.000Z";
const page = (booked: Row[]) =>
  (async (url: string | URL, init?: RequestInit) => {
    if (String(url).includes("/slots")) return new Response(JSON.stringify({ byDay: { "2026-11-27": [slotIso, "2026-11-27T15:00:00.000Z"] } }));
    booked.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ ok: true }));
  }) as typeof fetch;

Deno.test("native: the first message goes into Scalency's outbox and a follow-up is scheduled", async () => {
  const { db, writes } = fakeDb(base());
  const claude = scripted([() => ({ content: [tool("send_message", { text: "Hi Ben, it's Ada from Scalency. Thanks for applying. What's the main thing you want help with?" })] })]);
  const r = await nativeWork(db, agent, thread(), { kind: "opener" }, { claude, now });
  ok(r.sent);
  const msg = writes.find((w) => w.table === "messages" && w.op === "insert")!.data;
  deepStrictEqual([msg.channel, msg.to_address, msg.status, msg.direction], ["sms", "+447700900123", "queued", "outbound"]);
  const upd = writes.filter((w) => w.table === "setter_threads").at(-1)!.data;
  deepStrictEqual([upd.state, upd.next_action, (upd.sent_ids as string[]).length], ["active", "followup", 1]);
  ok(upd.next_action_at);
});

Deno.test("native: test mode sends to the test phone and holds the message as a test", async () => {
  const t = base();
  t.accounts[0].test_mode = true;
  const { db, writes } = fakeDb(t);
  const claude = scripted([() => ({ content: [tool("send_message", { text: "Hi Ben, it's Ada from Scalency." })] })]);
  await nativeWork(db, agent, thread(), { kind: "opener" }, { claude, now });
  const msg = writes.find((w) => w.table === "messages")!.data;
  deepStrictEqual([msg.to_address, msg.status], ["+447700900999", "held_test_mode"]);
});

Deno.test("native: a reply books a time on the Scalency booking page and stops the chasing", async () => {
  const booked: Row[] = [];
  const msgs = [
    { id: "m1", direction: "outbound", channel: "sms", subject: null, body: "Hi Ben, what's the main thing you want help with?", created_at: "2026-11-26T09:01:00Z" },
    { id: "m2", direction: "inbound", channel: "sms", subject: null, body: "More leads. Can we talk tomorrow afternoon?", created_at: "2026-11-26T09:30:00Z" },
  ];
  const { db, writes } = fakeDb(base(msgs));
  const claude = scripted([
    () => ({ content: [tool("get_free_times", { part_of_day: "afternoon" })] }),
    () => ({ content: [tool("book_consultation", { start_time: slotIso }), tool("send_message", { text: "Done, you're booked for tomorrow at 2pm." })] }),
  ]);
  const r = await nativeWork(db, agent, thread({ sent_ids: ["m1"] }), { kind: "reply" }, { claude, now, fetch: page(booked) });
  ok(r.booked, JSON.stringify(r));
  deepStrictEqual([booked[0].start, booked[0].email, booked[0].first_name], [slotIso, "ben@example.com", "Ben"]);
  const upd = writes.filter((w) => w.table === "setter_threads").at(-1)!.data;
  deepStrictEqual([upd.state, upd.next_action, upd.next_action_at], ["booked", null, null]);
});

Deno.test("native: no email means the AI asks for it instead of booking, and saves it when they send it", async () => {
  const msgs = [{ id: "m2", direction: "inbound", channel: "sms", subject: null, body: "Sure, it's ben.hart@example.com", created_at: "2026-11-26T09:30:00Z" }];
  const { db, writes } = fakeDb(base(msgs, { ...ben, email: null }));
  const claude = scripted([() => ({ content: [tool("send_message", { text: "Thanks Ben." })] })]);
  await nativeWork(db, agent, thread(), { kind: "reply" }, { claude, now });
  ok(writes.some((w) => w.table === "contacts" && w.data.email === "ben.hart@example.com"));
});

Deno.test("native: STOP unsubscribes them and ends the thread without the AI", async () => {
  const msgs = [{ id: "m2", direction: "inbound", channel: "sms", subject: null, body: "STOP", created_at: "2026-11-26T09:30:00Z" }];
  const { db, writes } = fakeDb(base(msgs));
  const r = await nativeWork(db, agent, thread(), { kind: "reply" }, { claude: async () => { throw new Error("should not ask Claude"); }, now });
  deepStrictEqual(r, { stopped: "opt out" });
  ok(writes.some((w) => w.table === "contacts" && w.data.sms_unsubscribed_at));
});

Deno.test("native: a follow-up becomes a reply when they've answered since", async () => {
  const msgs = [
    { id: "m1", direction: "outbound", channel: "email", subject: "Your enquiry with Scalency", body: "Hi Ben", created_at: "2026-11-26T09:01:00Z" },
    { id: "m2", direction: "inbound", channel: "email", subject: "Re: Your enquiry with Scalency", body: "What does it cost?\n\nOn Thu, Ada wrote:\n> Hi Ben", created_at: "2026-11-26T09:30:00Z" },
  ];
  const { db, writes } = fakeDb(base(msgs));
  const claude = scripted([() => ({ content: [tool("send_message", { text: "Good question, Ben. It depends on what you need, so it's best covered on a short call." })] })]);
  await nativeWork(db, agent, thread({ sent_ids: ["m1"], channel: "Email" }), { kind: "followup", touch: 0 }, { claude, now });
  const msg = writes.find((w) => w.table === "messages")!.data;
  deepStrictEqual([msg.channel, msg.subject], ["email", "Re: Your enquiry with Scalency"]);
});

Deno.test("native helpers: turns, lead details, typed contact details", () => {
  const t = nativeTurns([{ id: "x", direction: "outbound", channel: "sms", subject: null, body: "auto", created_at: "1" }, { id: "y", direction: "outbound", channel: "sms", subject: null, body: "ai", created_at: "2" }], ["y"]);
  deepStrictEqual(t.map((x) => x.who), ["auto", "ai"]);
  const l = nativeLead(ben, ["AI setter"], { "Monthly revenue": "£20k", Email: "x@y.com" });
  ok(l.details.includes("Form: Monthly revenue: £20k") && !l.details.includes("x@y.com"));
  deepStrictEqual(contactDetailsIn("call me on +44 7700 900123 or ben@x.co"), { email: "ben@x.co", phone: "+447700900123" });
});
