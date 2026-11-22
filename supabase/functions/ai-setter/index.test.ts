// Tests for the AI setter, with a pretend Claude, a pretend GHL and a pretend database.
// Run: deno test --allow-env supabase/functions/ai-setter/index.test.ts

import { deepStrictEqual, match, ok } from "node:assert/strict";

const assert = (v: unknown, msg?: string) => ok(v, msg);
const assertEquals = (a: unknown, b: unknown) => deepStrictEqual(a, b);
const assertMatch = (s: string, re: RegExp) => match(s, re);
const assertStringIncludes = (s: string, part: string) => ok(s.includes(part), `expected to find ${JSON.stringify(part)}`);
import {
  channelOf,
  followUpAt,
  Ghl,
  emailReplyText,
  isOptOut,
  nextOpening,
  pickSlots,
  pretendSlots,
  rulesOf,
  runBrain,
  seal,
  systemPrompt,
  teamTookOver,
  toTurns,
  unseal,
  withinHours,
  work,
  type Agent,
  type ClaudeResponse,
  type Thread,
} from "./index.ts";

const NY = "America/New_York";
const rules = rulesOf({});
const business = {
  assistantName: "Sophie",
  clinicName: "Glow Aesthetics",
  timezone: NY,
  consultName: "free consultation",
  consultLength: "30 minutes",
  services: "Botox from $12/unit",
};

Deno.test("hours: closed on Sunday and at night, opens Monday 8am", () => {
  // Sunday 22 Nov 2026, 3pm New York
  const sunday = new Date("2026-11-22T20:00:00Z");
  assertEquals(withinHours(sunday, rules, NY), false);
  const open = nextOpening(sunday, rules, NY);
  assertEquals(open.toISOString(), "2026-11-23T13:00:00.000Z"); // Mon 8:00 EST
  assertEquals(withinHours(new Date("2026-11-23T15:00:00Z"), rules, NY), true); // Mon 10am
  assertEquals(withinHours(new Date("2026-11-24T02:00:00Z"), rules, NY), false); // Mon 9pm
});

Deno.test("follow-ups: day 1, 3, 5, 8, 12, 16, then none; always within hours", () => {
  const from = new Date("2026-11-23T15:00:00Z"); // Mon 10am
  const first = followUpAt(from, 0, rules, NY)!;
  assertEquals(first.toISOString(), "2026-11-24T15:00:00.000Z"); // Tue 10am
  const second = followUpAt(first, 1, rules, NY)!; // +2 days
  assertEquals(second.toISOString(), "2026-11-26T15:00:00.000Z");
  assertEquals(followUpAt(from, 6, rules, NY), null);
  // Saturday 7:55pm + 1 day = Sunday (closed) -> Monday 8am
  const sat = new Date("2026-11-29T00:55:00Z");
  assertEquals(followUpAt(sat, 0, rules, NY)!.toISOString(), "2026-11-30T13:00:00.000Z");
});

Deno.test("rules: bad values fall back to safe defaults", () => {
  const r = rulesOf({ start: "25:00", end: "nope", followUpDays: [0, 2, 900], minNoticeHours: -5, replyDelaySeconds: 999 });
  assertEquals(r.start, "08:00");
  assertEquals(r.end, "20:00");
  assertEquals(r.followUpDays, [2]);
  assertEquals(r.minNoticeHours, 0);
  assertEquals(r.replyDelaySeconds, 60);
});

Deno.test("free times: 3 days x 3 times, with notice, day and part-of-day filters", () => {
  const now = new Date("2026-11-23T14:00:00Z"); // Mon 9am NY
  const all = pretendSlots(rules, NY, now);
  const picks = pickSlots(all, NY, {}, now, 2);
  assertEquals(picks.length, 9);
  assert(new Date(picks[0].iso).getTime() >= now.getTime() + 2 * 3_600_000, "respects notice");
  assertMatch(picks[0].label, /^Mon 23 Nov, \d/);
  const wed = pickSlots(all, NY, { day: "2026-11-25" }, now, 2);
  assert(wed.length >= 1 && wed.every((s) => s.label.startsWith("Wed 25 Nov")), JSON.stringify(wed));
  const eve = pickSlots(all, NY, { part: "evening" }, now, 2);
  assert(eve.every((s) => /(5|6|7)(:30)?pm/.test(s.label)), JSON.stringify(eve));
});

Deno.test("opt-out words", () => {
  for (const w of ["STOP", "stop.", " Unsubscribe ", "opt out", "Stop all"]) assert(isOptOut(w), w);
  for (const w of ["stop asking me about price, how much?", "can you stop by", "ok"]) assert(!isOptOut(w), w);
});

Deno.test("GHL messages become the conversation; team replies are spotted", () => {
  const list = [
    { id: "m3", direction: "inbound" as const, body: "Is it painful?", messageType: "TYPE_SMS", dateAdded: "2026-11-24T15:10:00Z" },
    { id: "m2", direction: "outbound" as const, body: "Hi Jess, it's Sophie", messageType: "SMS", dateAdded: "2026-11-24T15:00:00Z" },
    { id: "m1", direction: "outbound" as const, body: "Thanks for your enquiry!", messageType: "TYPE_SMS", dateAdded: "2026-11-24T14:59:00Z" },
    { id: "c1", direction: "outbound" as const, body: "call", messageType: "TYPE_CALL", dateAdded: "2026-11-24T15:05:00Z" },
    { id: "e1", direction: "inbound" as const, body: "<p>Hello<br>there</p>", messageType: "TYPE_EMAIL", dateAdded: "2026-11-24T15:11:00Z" },
  ];
  const turns = toTurns(list, ["m2"]);
  assertEquals(turns.map((t) => t.who), ["auto", "ai", "lead", "lead"]);
  assertEquals(turns[3].text, "Hello\nthere");
  assertEquals(turns[3].channel, "Email");
  assertEquals(channelOf("TYPE_INSTAGRAM"), "IG");
  assertEquals(channelOf("TYPE_CALL"), null);
  const now = new Date("2026-11-24T16:00:00Z");
  assertEquals(teamTookOver(turns, now), false);
  const withTeam = toTurns([...list, { id: "t1", direction: "outbound" as const, body: "Hi Jess, Amy here", messageType: "TYPE_SMS", dateAdded: "2026-11-24T15:20:00Z", userId: "u1" }], ["m2"]);
  assertEquals(teamTookOver(withTeam, now), true);
});

Deno.test("GHL key is sealed and opened again", async () => {
  Deno.env.set("SETTER_SECRET_KEY", "a-test-secret-that-is-long-enough-123");
  const box = await seal("pit-1234567890abcdef");
  assert(box.startsWith("v1:") && !box.includes("pit-"));
  assertEquals(await unseal(box), "pit-1234567890abcdef");
});

Deno.test("prompt carries the SOP, the safety rules and the clinic's details", () => {
  const p = systemPrompt({ business, rules: {} }, new Date("2026-11-24T15:00:00Z"));
  for (const bit of ["Sophie", "Glow Aesthetics", "Botox from $12/unit", "just following up", "one more yes", "medical advice", "virtual assistant", "hand_over", "send_message", "US spelling"]) assertStringIncludes(p, bit);
  assert(!p.includes("undefined"));
});

// A pretend Claude that plays back a script of replies.
function scripted(steps: ((req: { messages: unknown[] }) => ClaudeResponse)[]) {
  let i = 0;
  const seen: { messages: unknown[] }[] = [];
  return {
    seen,
    claude: async (req: { messages: unknown[] }) => {
      seen.push(JSON.parse(JSON.stringify(req)));
      const step = steps[Math.min(i++, steps.length - 1)];
      return step(req);
    },
  };
}
const tool = (name: string, input: Record<string, unknown>, id = crypto.randomUUID()) => ({ type: "tool_use" as const, id, name, input });

Deno.test("brain: looks up times, then books only a time it was given", async () => {
  const now = new Date("2026-11-24T14:00:00Z");
  const slots = pickSlots(pretendSlots(rules, NY, now), NY, {}, now, 2);
  const booked: string[] = [];
  const c = scripted([
    () => ({ content: [tool("book_consultation", { start_time: "2026-11-25T15:00:00Z" })] }), // not offered yet
    () => ({ content: [tool("get_free_times", { part_of_day: "any" })] }),
    () => ({ content: [tool("book_consultation", { start_time: slots[1].iso }), tool("send_message", { text: "You're booked in for **tomorrow**!" })] }),
  ]);
  const r = await runBrain({ business, rules: {} }, { mode: { kind: "reply" }, turns: [{ who: "lead", text: "Tuesday works", at: now.toISOString() }], lead: { firstName: "Jess", details: "" }, now }, {
    claude: c.claude,
    freeSlots: async () => slots,
    book: async (iso) => {
      booked.push(iso);
      return { ok: true, label: "Mon 24 Nov, 1pm", id: "apt1" };
    },
  });
  assertEquals(booked, [slots[1].iso]);
  assertEquals(r.booked?.id, "apt1");
  assertEquals(r.message, "You're booked in for tomorrow!");
  // The made-up time was refused with a reason the AI can act on.
  assertStringIncludes(JSON.stringify(c.seen[1].messages), "wasn't in the free times");
});

Deno.test("brain: STOP-style refusal sends nothing; plain text answers work", async () => {
  const silent = scripted([() => ({ content: [tool("mark_not_interested", { reason: "asked to stop", asked_not_to_be_contacted: true }), tool("send_message", { text: "Sorry to bother you" })] })]);
  const r1 = await runBrain({ business, rules: {} }, { mode: { kind: "reply" }, turns: [], lead: { firstName: "", details: "" } }, { claude: silent.claude, freeSlots: async () => [], book: async () => ({ ok: false, error: "x" }) });
  assertEquals(r1.message, "");
  assertEquals(r1.stop?.silent, true);
  const plain = scripted([() => ({ content: [{ type: "text", text: "- Hi Jess!" }] })]);
  const r2 = await runBrain({ business, rules: {} }, { mode: { kind: "opener" }, turns: [], lead: { firstName: "Jess", details: "" } }, { claude: plain.claude, freeSlots: async () => [], book: async () => ({ ok: false, error: "x" }) });
  assertEquals(r2.message, "Hi Jess!");
  assertStringIncludes(JSON.stringify(plain.seen[0].messages), "Don't offer times yet");
});

// ---------------------------------------------------------------------------
// A whole lead, end to end, with a pretend GHL and database
// ---------------------------------------------------------------------------

type Call = { method: string; path: string; body: Record<string, unknown> | null };

function fakeGhl(opts: { tags?: string[]; messages?: unknown[]; dnd?: boolean; noPhone?: boolean }) {
  const calls: Call[] = [];
  const fetcher = (async (url: string | URL, init?: RequestInit) => {
    const u = new URL(String(url));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, path: u.pathname + u.search, body });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (u.pathname.startsWith("/contacts/") && method === "GET") return ok({ contact: { id: "c1", firstName: "Jess", lastName: "Doe", phone: opts.noPhone ? "" : "+15551234567", email: "jess@example.com", tags: opts.tags ?? [], dnd: opts.dnd ?? false, customFields: [{ id: "f1", value: "Botox/Fillers" }] } });
    if (u.pathname === "/conversations/search") return ok({ conversations: [{ id: "conv1" }] });
    if (u.pathname === "/conversations/conv1/messages") return ok({ messages: { messages: opts.messages ?? [] } });
    if (u.pathname === "/conversations/messages") return ok({ messageId: `sent-${calls.length}` });
    if (u.pathname.endsWith("/free-slots")) {
      return ok({ "2026-11-25": { slots: ["2026-11-25T10:00:00-05:00", "2026-11-25T14:00:00-05:00"] }, traceId: "x" });
    }
    if (u.pathname === "/calendars/events/appointments") return ok({ id: "apt9" });
    if (u.pathname === "/opportunities/search") return ok({ opportunities: [] });
    return ok({});
  }) as typeof fetch;
  return { ghl: new Ghl("pit-test", "loc1", fetcher), calls };
}

function fakeDb() {
  const rows: { table: string; op: string; data: unknown }[] = [];
  const builder = (table: string) => {
    let op = "select";
    let data: unknown = null;
    const b: Record<string, unknown> = {
      insert(d: unknown) {
        op = "insert";
        data = d;
        rows.push({ table, op, data });
        return b;
      },
      update(d: unknown) {
        op = "update";
        data = d;
        rows.push({ table, op, data });
        return b;
      },
      select: () => b,
      eq: () => b,
      maybeSingle: async () => ({ data: null }),
      single: async () => ({ data: null }),
      then: (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(res),
    };
    return b;
  };
  return { db: { from: builder } as unknown as Parameters<typeof work>[0], rows };
}

const agent: Agent = {
  id: "a1",
  account_id: "acc1",
  name: "Glow setter",
  status: "live",
  business,
  rules: {},
  ghl_location_id: "loc1",
  ghl_calendar_id: "cal1",
  ghl_pipeline_id: "pipe1",
  ghl_stages: { contacted: "st-contacted", booked: "st-booked", not_interested: "st-no" },
  ghl_token: null,
  webhook_key: "k",
};
const newThread = (): Thread => ({
  id: "t1",
  agent_id: "a1",
  account_id: "acc1",
  ghl_contact_id: "c1",
  contact_name: null,
  state: "active",
  channel: "SMS",
  touches: 0,
  total_touches: 0,
  next_action_at: null,
  next_action: "opener",
  reply_token: null,
  last_inbound_at: null,
  last_outbound_at: null,
  sent_ids: [],
});

Deno.test("end to end: first text tags, moves the deal, gives the team their call task and schedules day 1", async () => {
  const { ghl, calls } = fakeGhl({});
  const { db, rows } = fakeDb();
  const c = scripted([() => ({ content: [tool("send_message", { text: "Hi Jess, it's Sophie from Glow Aesthetics. Want our new-patient Botox prices?" })] })]);
  const thread = newThread();
  const now = new Date("2026-11-24T15:00:00Z");
  const r = await work(db, agent, thread, { kind: "opener" }, { claude: c.claude, ghl, now });
  assertEquals(r.sent, "Hi Jess, it's Sophie from Glow Aesthetics. Want our new-patient Botox prices?");
  const sent = calls.find((x) => x.path === "/conversations/messages")!;
  assertEquals(sent.body?.type, "SMS");
  assert(calls.some((x) => x.path === "/contacts/c1/tags" && JSON.stringify(x.body).includes("ai-setter")));
  assert(calls.some((x) => x.path === "/opportunities/upsert" && x.body?.pipelineStageId === "st-contacted"));
  assert(calls.some((x) => x.path === "/contacts/c1/tasks" && String(x.body?.title).startsWith("Call Jess Doe twice")));
  assertEquals(thread.next_action, "followup");
  assertEquals(thread.next_action_at, "2026-11-25T15:00:00.000Z");
  assertEquals(thread.sent_ids.length, 1);
  assert(rows.some((x) => x.table === "setter_turns" && (x.data as { role: string }).role === "ai"));
  // The form answer reached the AI.
  assertStringIncludes(JSON.stringify(c.seen[0].messages), "Botox/Fillers");
});

Deno.test("end to end: a reply that books moves the deal to booked and stops follow-ups", async () => {
  const { ghl, calls } = fakeGhl({ messages: [{ id: "in1", direction: "inbound", body: "Wednesday afternoon please", messageType: "TYPE_SMS", dateAdded: "2026-11-24T15:05:00Z" }] });
  const { db } = fakeDb();
  const c = scripted([
    () => ({ content: [tool("get_free_times", { day: "2026-11-25", part_of_day: "afternoon" })] }),
    (req) => {
      const iso = String(JSON.stringify(req.messages).match(/2026-11-25T\d\d:\d\d:\d\d[^ "\\]*/)?.[0]);
      return { content: [tool("book_consultation", { start_time: iso }), tool("send_message", { text: "Done! See you Wednesday at 2pm." })] };
    },
  ]);
  const thread = { ...newThread(), next_action: null, last_outbound_at: "2026-11-24T15:00:00Z" };
  const r = await work(db, agent, thread, { kind: "reply" }, { claude: c.claude, ghl, now: new Date("2026-11-24T15:06:00Z") });
  assertEquals(r.booked?.id, "apt9");
  const apt = calls.find((x) => x.path === "/calendars/events/appointments")!;
  assertEquals(apt.body?.calendarId, "cal1");
  assertEquals(apt.body?.contactId, "c1");
  assertEquals(apt.body?.startTime, "2026-11-25T14:00:00-05:00");
  assert(calls.some((x) => x.path === "/opportunities/upsert" && x.body?.pipelineStageId === "st-booked"));
  assertEquals(thread.state, "booked");
  assertEquals(thread.next_action_at, null);
});

Deno.test("end to end: test mode skips untagged leads; team replies pause the AI; DND stops it", async () => {
  const c = scripted([() => ({ content: [tool("send_message", { text: "hi" })] })]);
  const t1 = newThread();
  const r1 = await work(fakeDb().db, { ...agent, status: "test" }, t1, { kind: "opener" }, { claude: c.claude, ghl: fakeGhl({}).ghl });
  assertMatch(String(r1.skipped), /test mode/);
  const r1b = await work(fakeDb().db, { ...agent, status: "test" }, newThread(), { kind: "opener" }, { claude: c.claude, ghl: fakeGhl({ tags: ["AI-test"] }).ghl, now: new Date("2026-11-24T15:00:00Z") });
  assertEquals(r1b.sent, "hi");

  const t2 = newThread();
  const now = new Date("2026-11-24T16:00:00Z");
  const team = fakeGhl({ messages: [{ id: "x1", direction: "outbound", body: "Hi Jess, Amy here from the front desk", messageType: "TYPE_SMS", dateAdded: "2026-11-24T15:30:00Z", userId: "user7" }] });
  const r2 = await work(fakeDb().db, agent, t2, { kind: "followup", touch: 0 }, { claude: c.claude, ghl: team.ghl, now });
  assertEquals(r2.skipped, "team took over");
  assertEquals(t2.state, "paused");
  assert(!team.calls.some((x) => x.path === "/conversations/messages"));

  const t3 = newThread();
  const r3 = await work(fakeDb().db, agent, t3, { kind: "opener" }, { claude: c.claude, ghl: fakeGhl({ dnd: true }).ghl });
  assertEquals(r3.skipped, "do not disturb");
  assertEquals(t3.state, "stopped");
});

Deno.test("end to end: hand over creates a task for the team and stops the AI", async () => {
  const { ghl, calls } = fakeGhl({ messages: [{ id: "in1", direction: "inbound", body: "My lip is really swollen since my filler last week", messageType: "TYPE_SMS", dateAdded: "2026-11-24T15:05:00Z" }] });
  const c = scripted([() => ({ content: [tool("hand_over", { reason: "possible reaction after filler", summary: "Swollen lip a week after filler." }), tool("send_message", { text: "I'm sorry to hear that. A member of our clinical team will contact you shortly." })] })]);
  const thread = newThread();
  await work(fakeDb().db, agent, thread, { kind: "reply" }, { claude: c.claude, ghl, now: new Date("2026-11-24T15:06:00Z") });
  assertEquals(thread.state, "handed_over");
  assert(calls.some((x) => x.path === "/contacts/c1/tasks" && String(x.body?.title).includes("possible reaction")));
  assert(calls.some((x) => x.path === "/contacts/c1/tags" && JSON.stringify(x.body).includes("ai-handover")));
});

Deno.test("end to end: follow-up 2 gives the team the selfie video task; the last one finishes", async () => {
  const { ghl, calls } = fakeGhl({ messages: [{ id: "s1", direction: "outbound", body: "Hi Jess", messageType: "TYPE_SMS", dateAdded: "2026-11-24T15:00:00Z" }] });
  const c = scripted([() => ({ content: [tool("send_message", { text: "Quick one Jess: here's a result..." })] })]);
  const thread = { ...newThread(), sent_ids: ["s1"], touches: 1, next_action: "followup" as const };
  await work(fakeDb().db, agent, thread, { kind: "followup", touch: 1 }, { claude: c.claude, ghl, now: new Date("2026-11-27T15:00:00Z") });
  assert(calls.some((x) => x.path === "/contacts/c1/tasks" && String(x.body?.title).includes("selfie video")));
  assertStringIncludes(JSON.stringify(c.seen[0].messages), 'follow-up number 2, in the \\"proof\\" style');
  assertEquals(thread.touches, 2);
  const last = { ...newThread(), sent_ids: ["s1"], touches: 5 };
  await work(fakeDb().db, agent, last, { kind: "followup", touch: 5 }, { claude: c.claude, ghl: fakeGhl({ messages: [] }).ghl, now: new Date("2026-12-10T15:00:00Z") });
  assertEquals(last.state, "finished");
  assertEquals(last.next_action_at, null);
});

Deno.test("end to end: a lead with only an email address is emailed, with a subject", async () => {
  const { ghl, calls } = fakeGhl({ noPhone: true });
  const c = scripted([() => ({ content: [tool("send_message", { text: "Hi Jess, it's Sophie from Glow Aesthetics." })] })]);
  await work(fakeDb().db, agent, newThread(), { kind: "opener" }, { claude: c.claude, ghl, now: new Date("2026-11-24T15:00:00Z") });
  const sent = calls.find((x) => x.path === "/conversations/messages")!;
  assertEquals(sent.body?.type, "Email");
  assertEquals(sent.body?.subject, "Your enquiry with Glow Aesthetics");
  assertEquals(sent.body?.replyMessageId, undefined);
  assertStringIncludes(String(sent.body?.html), "Hi Jess");
});

Deno.test("email replies: the quoted earlier email is dropped", () => {
  const gmail = '<div dir="ltr">how much is botox?</div><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">On Sun, 22 Nov 2026 at 14:35, Scalency &lt;test@mg.msgsndr.org&gt; wrote:<br></div><blockquote class="gmail_quote">Hi David, it\'s Sophie</blockquote></div>';
  assertEquals(emailReplyText(gmail), "how much is botox?");
  assertEquals(emailReplyText("Yes please\n\nOn Sun, 22 Nov 2026 at 14:35, Sophie <a@b.com> wrote:\n> Hi David"), "Yes please");
  assertEquals(emailReplyText('<p>Sounds good</p><div id="appendonsend"></div><div id="divRplyFwdMsg">From: Glow</div>'), "Sounds good");
  assertEquals(emailReplyText("Just this"), "Just this");
});

Deno.test("email replies: the AI answers in the same thread, with Re: and the email it replies to", async () => {
  const { ghl, calls } = fakeGhl({
    noPhone: true,
    messages: [
      { id: "out1", direction: "outbound", body: "<p>Hi David, it's Sophie</p>", messageType: "TYPE_EMAIL", dateAdded: "2026-11-22T13:35:00Z", meta: { email: { subject: "Your enquiry with Glow Aesthetics" } } },
      { id: "in1", direction: "inbound", body: '<div>how much is botox?</div><div class="gmail_quote">On Sun wrote: Hi David, it\'s Sophie</div>', messageType: "TYPE_EMAIL", dateAdded: "2026-11-22T13:38:00Z", meta: { email: { subject: "Re: Your enquiry with Glow Aesthetics" } } },
    ],
  });
  const c = scripted([() => ({ content: [tool("send_message", { text: "Botox is $12 a unit." })] })]);
  await work(fakeDb().db, agent, { ...newThread(), sent_ids: ["out1"], channel: "Email" }, { kind: "reply" }, { claude: c.claude, ghl, now: new Date("2026-11-22T13:39:00Z") });
  const sent = calls.find((x) => x.path === "/conversations/messages")!;
  assertEquals(sent.body?.type, "Email");
  assertEquals(sent.body?.subject, "Re: Your enquiry with Glow Aesthetics");
  assertEquals(sent.body?.replyMessageId, "in1");
  // The AI saw only what the lead wrote, not the quoted email.
  const seen = JSON.stringify(c.seen[0].messages);
  assertStringIncludes(seen, "Lead: how much is botox?");
  assert(!seen.includes("On Sun wrote"));
  assertStringIncludes(JSON.stringify(c.seen[0]), "Never mention glitches");
});
