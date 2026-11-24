// Tests for the AI setter, with a pretend Claude, a pretend GHL and a pretend database.
// Run: deno test --allow-env supabase/functions/ai-setter/index.test.ts

import { deepStrictEqual, match, ok } from "node:assert/strict";

const assert = (v: unknown, msg?: string) => ok(v, msg);
const assertEquals = (a: unknown, b: unknown) => deepStrictEqual(a, b);
const assertMatch = (s: string, re: RegExp) => match(s, re);
const assertStringIncludes = (s: string, part: string) => ok(s.includes(part), `expected to find ${JSON.stringify(part)}`);
import {
  keywordHit,
  rebookDaysFor,
  readSite,
  scanSite,
  taskText,
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
  copyContactsIn,
  guardInbound,
  guardedBrain,
  pomTerms,
  stripPom,
  handoffPriority,
  summarise,
  tagRuleBlocks,
  leadOf,
  WAITING_FOR_TAG,
  NO_TAG,
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
  assertEquals(rulesOf({ replyDelaySeconds: 0 }).replyDelaySeconds, 10);
  assertEquals(rulesOf({}).joinReplies, "all");
  assertEquals(rulesOf({ joinReplies: "own", onlyTags: [" VIP ", 3] as unknown as string[], teamPauseHours: -2 }).onlyTags, ["vip", "3"]);
});

Deno.test("when the AI joins: tag rules and stepping back for the team", () => {
  const r = rulesOf({ skipTags: ["customer"], onlyTags: ["new lead"] });
  assertMatch(String(tagRuleBlocks(["Customer", "new lead"], r)), /customer/);
  assertMatch(String(tagRuleBlocks(["other"], r)), /only works/);
  assertEquals(tagRuleBlocks(["New Lead"], r), null);
  const now = new Date("2026-11-24T15:00:00Z");
  const turns = [
    { who: "ai" as const, text: "hi", at: "2026-11-24T09:00:00Z" },
    { who: "team" as const, text: "I'll take this", at: "2026-11-24T10:00:00Z" },
  ];
  assertEquals(teamTookOver(turns, now, 0), true); // within a day
  assertEquals(teamTookOver(turns, now, 3), false); // 5 hours ago, the setter steps back for 3
  assertEquals(teamTookOver(turns, now, 6), true);
});

Deno.test("the lead: form answers use their field names, with source, ad and Scalency details", () => {
  const l = leadOf(
    { firstName: "Dan", source: "Facebook lead form", attributionSource: { sessionSource: "Paid Social", campaign: "Botox Nov" }, tags: ["fb"], customFields: [{ id: "f1", value: "Lip filler" }] },
    { fieldNames: { f1: "Treatment wanted" }, form: { name: "New patient form", others: { when_can_you_come: "Evenings", email: "x@y.z" } }, scalency: { custom: { budget: "500", ghl_id: "g1" } } },
  );
  for (const bit of ["Source: Facebook lead form", "Came from: Paid Social", "Ad or campaign: Botox Nov", "Answer: Treatment wanted: Lip filler", "Form: when can you come: Evenings", "Detail: budget: 500"]) assertStringIncludes(l.details, bit);
  assert(!l.details.includes("ghl_id"));
  assert(!l.details.includes("x@y.z"));
});

Deno.test("prompt: booking link modes", () => {
  const at = new Date("2026-11-24T15:00:00Z");
  const link = "https://book.example.com/glow";
  assertStringIncludes(systemPrompt({ business: { ...business, bookingLink: link, bookingMode: "link" }, rules: {} }, at), `send the booking link (${link})`);
  assertStringIncludes(systemPrompt({ business: { ...business, bookingLink: link, bookingMode: "both" }, rules: {} }, at), "also give the booking link");
  // No link saved: always offers times.
  assert(!systemPrompt({ business: { ...business, bookingLink: "", bookingMode: "link" }, rules: {} }, at).includes("send the booking link"));
  assertStringIncludes(systemPrompt({ business, rules: {} }, at), "recommend the one service");
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
  for (const bit of ["Sophie", "Glow Aesthetics", "Botox from $12/unit", "just following up", "Never ask permission", "in the same message", "medical advice", "virtual assistant", "hand_over", "send_message", "US spelling"]) assertStringIncludes(p, bit);
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
  assertStringIncludes(JSON.stringify(plain.seen[0].messages), "don't offer times yet");
});

// ---------------------------------------------------------------------------
// A whole lead, end to end, with a pretend GHL and database
// ---------------------------------------------------------------------------

type Call = { method: string; path: string; body: Record<string, unknown> | null };

function fakeGhl(opts: { tags?: string[]; messages?: unknown[]; dnd?: boolean; noPhone?: boolean; noThreading?: boolean; emails?: Record<string, unknown> }) {
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
    if (u.pathname.startsWith("/conversations/messages/email/")) {
      const e = opts.emails?.[u.pathname.split("/").pop()!];
      return e ? ok({ emailMessage: e }) : new Response("{}", { status: 404 });
    }
    if (u.pathname === "/conversations/messages" && opts.noThreading && body?.replyMessageId) return new Response(JSON.stringify({ message: "bad replyMessageId" }), { status: 422 });
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

function fakeDb(saved: unknown[] = []) {
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
      gte: () => b,
      neq: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: async () => ({ data: null }),
      single: async () => ({ data: null }),
      then: (res: (v: unknown) => unknown) => Promise.resolve({ data: table === "setter_turns" && op === "select" ? saved : null, error: null }).then(res),
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
  const c = scripted([() => ({ content: [tool("send_message", { text: "Hi Jess, it's Sophie from Glow Aesthetics. Want our new-patient prices?" })] })]);
  const thread = newThread();
  const now = new Date("2026-11-24T15:00:00Z");
  const r = await work(db, agent, thread, { kind: "opener" }, { claude: c.claude, ghl, now });
  assertEquals(r.sent, "Hi Jess, it's Sophie from Glow Aesthetics. Want our new-patient prices?");
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
  // The guardrail caught it first: urgent task and tags, a fixed safe reply, and the AI never ran.
  assert(calls.some((x) => x.path === "/contacts/c1/tasks" && String(x.body?.title).startsWith("URGENT") && String(x.body?.title).includes("Possible complication")));
  assert(calls.some((x) => x.path === "/contacts/c1/tags" && JSON.stringify(x.body).includes("ai-urgent")));
  assert(calls.some((x) => x.path === "/conversations/messages" && String(x.body?.message).includes("NHS 111")));
  assertEquals(c.seen.length, 0);
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

Deno.test("test mode: the first message waits 2 minutes for the ai-test tag once, then says why it wasn't sent", async () => {
  const c = scripted([() => ({ content: [tool("send_message", { text: "hi" })] })]);
  const now = new Date("2026-11-24T15:00:00Z");
  const first = fakeDb();
  const r1 = await work(first.db, { ...agent, status: "test" }, newThread(), { kind: "opener" }, { claude: c.claude, ghl: fakeGhl({}).ghl, now });
  assertMatch(String(r1.skipped), /waiting/);
  const wait = first.rows.find((r) => r.table === "setter_threads" && r.op === "update")?.data as Record<string, unknown>;
  assertEquals(wait.next_action, "opener");
  assertEquals(wait.next_action_at, "2026-11-24T15:02:00.000Z");

  const second = fakeDb();
  const r2 = await work(second.db, { ...agent, status: "test" }, { ...newThread(), note: WAITING_FOR_TAG }, { kind: "opener" }, { claude: c.claude, ghl: fakeGhl({}).ghl, now });
  assertMatch(String(r2.skipped), /isn't tagged/);
  assert(second.rows.some((r) => r.table === "setter_threads" && (r.data as Record<string, unknown>).note === NO_TAG));
  assert(second.rows.some((r) => r.table === "setter_turns" && String((r.data as Record<string, unknown>).body).includes("ai-test")));
});

Deno.test("email replies: if GHL won't thread it, it's still sent as a Re: email", async () => {
  const { ghl, calls } = fakeGhl({
    noPhone: true,
    noThreading: true,
    messages: [{ id: "in1", direction: "inbound", body: "how much is botox?", messageType: "TYPE_EMAIL", dateAdded: "2026-11-22T13:38:00Z", meta: { email: { subject: "Re: Your enquiry with Glow Aesthetics" } } }],
  });
  const c = scripted([() => ({ content: [tool("send_message", { text: "Botox is $12 a unit." })] })]);
  const r = await work(fakeDb().db, agent, { ...newThread(), channel: "Email" }, { kind: "reply" }, { claude: c.claude, ghl, now: new Date("2026-11-22T13:39:00Z") });
  assertEquals(r.sent, "Botox is $12 a unit.");
  const sends = calls.filter((x) => x.path === "/conversations/messages");
  assertEquals(sends.length, 2);
  assertEquals(sends[1].body?.replyMessageId, undefined);
  assertEquals(sends[1].body?.subject, "Re: Your enquiry with Glow Aesthetics");
});

Deno.test("email replies: if GHL lists the lead's email with no text, the saved copy is used", async () => {
  const { ghl } = fakeGhl({
    noPhone: true,
    messages: [
      { id: "out1", direction: "outbound", body: "<p>Hi Jess, it's Sophie</p>", messageType: "TYPE_EMAIL", dateAdded: "2026-11-22T16:23:00Z" },
      { id: "in1", direction: "inbound", body: "", messageType: "TYPE_EMAIL", dateAdded: "2026-11-22T16:25:00Z" },
    ],
  });
  const c = scripted([() => ({ content: [tool("send_message", { text: "Botox is $12 a unit, and most say it feels like a quick pinch." })] })]);
  const db = fakeDb([{ body: "Hi, how much is botox and does it hurt?", channel: "TYPE_EMAIL", created_at: "2026-11-22T16:25:05Z" }]);
  const thread = { ...newThread(), channel: "Email", sent_ids: ["out1"], last_outbound_at: "2026-11-22T16:23:00Z", last_inbound_at: "2026-11-22T16:25:05Z" };
  await work(db.db, agent, thread, { kind: "reply" }, { claude: c.claude, ghl, now: new Date("2026-11-22T16:26:00Z") });
  assertStringIncludes(JSON.stringify(c.seen[0].messages), "how much is botox and does it hurt?");
});

Deno.test("email replies: GHL lists emails without text, so each email is read, and the reply goes in the same thread", async () => {
  const { ghl, calls } = fakeGhl({
    noPhone: true,
    messages: [{ id: "holder1", direction: "inbound", body: "", messageType: "TYPE_EMAIL", dateAdded: "2026-11-23T07:54:00Z", meta: { email: { messageIds: ["em1", "em2"] } } }],
    emails: {
      em1: { id: "em1", direction: "outbound", body: "<p>Hi Jess, it's Sophie</p>", subject: "Your enquiry with Glow Aesthetics", dateAdded: "2026-11-22T17:23:00Z", threadId: "holder1" },
      em2: { id: "em2", direction: "inbound", body: '<div>Can I come in this week?</div><div class="gmail_quote">On Sun wrote: Hi Jess</div>', subject: "Re: Your enquiry with Glow Aesthetics", dateAdded: "2026-11-23T07:54:00Z", threadId: "holder1" },
    },
  });
  const c = scripted([() => ({ content: [tool("send_message", { text: "Yes, we have Wednesday at 10am or Thursday at 2pm." })] })]);
  await work(fakeDb().db, agent, { ...newThread(), channel: "Email", sent_ids: ["em1"] }, { kind: "reply" }, { claude: c.claude, ghl, now: new Date("2026-11-23T07:55:00Z") });
  const seen = JSON.stringify(c.seen[0].messages);
  assertStringIncludes(seen, "Lead: Can I come in this week?");
  assert(!seen.includes("On Sun wrote"));
  const sent = calls.find((x) => x.path === "/conversations/messages")!;
  assertEquals(sent.body?.threadId, "holder1");
  assertEquals(sent.body?.replyMessageId, "em2");
  assertEquals(sent.body?.subject, "Re: Your enquiry with Glow Aesthetics");
});

Deno.test("prompt: other business types get their own wording, and the business's instructions are followed", () => {
  const p = systemPrompt({ business: { ...business, clinicName: "Spark Plumbing", businessType: "home_services", consultName: "", instructions: "Always ask for their postcode." }, rules: {} }, new Date("2026-11-24T15:00:00Z"));
  for (const bit of ["booking coordinator (a virtual assistant) for Spark Plumbing", "free quote visit", "gas smell", "Always ask for their postcode.", "the technician"]) assertStringIncludes(p, bit);
  assert(!p.includes("Botox and filler"));
  assert(!p.includes("pregnancy"));
});

Deno.test("GHL contacts: new ones are added with source GHL, existing ones are linked, nothing is overwritten", async () => {
  const writes: { table: string; op: string; data: unknown }[] = [];
  const existing = [{ id: "k1", email: "jess@example.com", phone: null, first_name: "Jessica", last_name: null, custom: {} }];
  const db = {
    from(table: string) {
      let op = "select";
      let payload: unknown = null;
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        in: (col: string) => {
          (b as { col?: string }).col = col;
          return b;
        },
        ilike: () => b,
        insert: (d: unknown) => ((op = "insert"), (payload = d), writes.push({ table, op, data: d }), b),
        update: (d: unknown) => ((op = "update"), (payload = d), writes.push({ table, op, data: d }), b),
        upsert: (d: unknown) => ((op = "upsert"), writes.push({ table, op, data: d }), b),
        maybeSingle: () => Promise.resolve({ data: op === "insert" ? { id: "new1", ...(payload as object) } : null, error: null }),
        then: (res: (v: unknown) => unknown) => {
          const col = (b as { col?: string }).col;
          const data = table === "contacts" && op === "select" && col === "email" ? existing : table === "tags" && op === "select" ? [{ id: "t1", name: "ai-test" }] : [];
          return Promise.resolve({ data, error: null }).then(res);
        },
      };
      return b;
    },
  } as unknown as Parameters<typeof copyContactsIn>[0];
  const r = await copyContactsIn(db, "acc1", [
    { id: "g1", firstName: "Jess", email: "JESS@example.com", tags: ["ai-test"] },
    { id: "g2", firstName: "Dan", phone: "+447700900123" },
    { id: "g3", firstName: "Nobody" },
  ]);
  assertEquals(r, { added: 1, linked: 1 });
  const upd = writes.find((w) => w.table === "contacts" && w.op === "update")!.data as Record<string, unknown>;
  assertEquals(upd.first_name, undefined); // "Jessica" stays
  assertEquals((upd.custom as Record<string, unknown>).ghl_id, "g1");
  const ins = writes.find((w) => w.table === "contacts" && w.op === "insert")!.data as Record<string, unknown>;
  assertEquals(ins.source, "GHL");
  assertEquals(ins.phone, "+447700900123");
  assertEquals(ins.email_consent_at, undefined);
  assert(writes.some((w) => w.table === "contact_tags"));
});

Deno.test("first message: never sent twice, and reactivation skips people in touch recently", async () => {
  const c = scripted([() => ({ content: [tool("send_message", { text: "hi" })] })]);
  const now = new Date("2026-11-24T15:00:00Z");
  const { ghl } = fakeGhl({ messages: [{ id: "m1", direction: "outbound", body: "Hi Jess, it's Sophie", messageType: "TYPE_SMS", dateAdded: "2026-11-24T14:50:00Z" }] });
  const r = await work(fakeDb().db, agent, newThread(), { kind: "opener" }, { claude: c.claude, ghl, now });
  assertEquals(r.skipped, "already messaged");
  const old = fakeGhl({ messages: [{ id: "in1", direction: "inbound", body: "maybe next week", messageType: "TYPE_SMS", dateAdded: "2026-11-20T10:00:00Z" }] });
  const r2 = await work(fakeDb().db, agent, { ...newThread(), origin: "reactivation" }, { kind: "reactivate" }, { claude: c.claude, ghl: old.ghl, now });
  assertEquals(r2.skipped, "recently in touch");
});

Deno.test("reactivation: a quiet old lead gets one friendly message, and the prompt has the scripts and comeback offer", async () => {
  const c = scripted([() => ({ content: [tool("send_message", { text: "Hi Jess, Sophie from Glow here." })] })]);
  const { ghl } = fakeGhl({ messages: [{ id: "in1", direction: "inbound", body: "how much is botox", messageType: "TYPE_SMS", dateAdded: "2026-08-01T10:00:00Z" }] });
  const r = await work(fakeDb().db, { ...agent, business: { ...business, scripts: "Hey {name}! Lovely to hear from you.", reactivationOffer: "20% off your first treatment this month" } }, { ...newThread(), origin: "reactivation" }, { kind: "reactivate" }, { claude: c.claude, ghl, now: new Date("2026-11-24T15:00:00Z") });
  assertEquals(r.sent, "Hi Jess, Sophie from Glow here.");
  const all = JSON.stringify(c.seen[0]);
  assertStringIncludes(all, "never booked");
  assertStringIncludes(all, "Lovely to hear from you");
  assertStringIncludes(all, "20% off your first treatment");
});

Deno.test("speed to lead: the first message can go any time, follow-ups keep to the hours", () => {
  assertEquals(rulesOf({}).instantFirstMessage, true);
  assertEquals(rulesOf({ instantFirstMessage: false }).instantFirstMessage, false);
});

Deno.test("guardrails: complications, under-18 and prescription medicine names", async () => {
  assertEquals(guardInbound("my lips are really swollen and hot to the touch since the filler yesterday")?.kind, "complication");
  assertEquals(guardInbound("my nose has a white patch since my filler")?.kind, "complication");
  assertEquals(guardInbound("will I have swelling after lip filler?"), null); // a question, not a problem
  assertEquals(guardInbound("I'm 16, can I get lip filler?")?.kind, "under18");
  assertEquals(guardInbound("I'm 16 weeks pregnant"), null);
  assertEquals(guardInbound("can I come at 16:30?"), null);
  assertEquals(pomTerms("New clients get Botox at £9 a unit and Dysport too"), ["botox", "dysport"]);
  assertEquals(stripPom("Book Botox or Dysport today"), "Book treatment today");

  // A complication: fixed safe reply, urgent handover, no AI call at all.
  const c = scripted([]);
  const r = await guardedBrain(
    { business, rules: {} },
    { mode: { kind: "reply" }, turns: [{ who: "ai", text: "hi", at: "2026-11-24T10:00:00Z" }, { who: "lead", text: "my lips are so swollen and painful since the filler yesterday, really severe pain", at: "2026-11-24T10:05:00Z" }], lead: { firstName: "Jess", details: "" } },
    { claude: c.claude, freeSlots: async () => [], book: async () => ({ ok: false, error: "x" }) },
  );
  assertEquals(c.seen.length, 0);
  assertEquals(r.brain.handover?.category, "complication");
  assertEquals(handoffPriority("complication"), "urgent");
  assertStringIncludes(r.brain.message, "999 or NHS 111");

  // A first message naming Botox is rewritten; if the AI insists, the names are stripped.
  const stubborn = scripted([() => ({ content: [tool("send_message", { text: "Hi Jess, Botox is £9 a unit!" })] }), () => ({ content: [tool("send_message", { text: "Hi Jess, Botox is still £9!" })] })]);
  const p = await guardedBrain({ business, rules: {} }, { mode: { kind: "opener" }, turns: [], lead: { firstName: "Jess", details: "" } }, { claude: stubborn.claude, freeSlots: async () => [], book: async () => ({ ok: false, error: "x" }) });
  assertEquals(pomTerms(p.brain.message), []);
  assertMatch(p.guard[0], /botox/);
  // In a one-to-one reply the clinic's own wording is allowed.
  const reply = scripted([() => ({ content: [tool("send_message", { text: "Botox is £9 a unit." })] })]);
  const q = await guardedBrain({ business, rules: {} }, { mode: { kind: "reply" }, turns: [{ who: "lead", text: "how much is botox?", at: "2026-11-24T10:00:00Z" }], lead: { firstName: "Jess", details: "" } }, { claude: reply.claude, freeSlots: async () => [], book: async () => ({ ok: false, error: "x" }) });
  assertEquals(q.brain.message, "Botox is £9 a unit.");
});

Deno.test("qualification: the AI saves what it learns and a score; handoffs get the right priority", async () => {
  const c = scripted([() => ({ content: [tool("update_lead", { score: 85, treatment: "lip filler", timeline: "before a wedding on 12 Dec", age_confirmed: true }), tool("send_message", { text: "Lovely! When's the wedding?" })] })]);
  const r = await runBrain({ business, rules: {} }, { mode: { kind: "reply" }, turns: [{ who: "lead", text: "lip filler before my wedding", at: "2026-11-24T10:00:00Z" }], lead: { firstName: "Jess", details: "" } }, { claude: c.claude, freeSlots: async () => [], book: async () => ({ ok: false, error: "x" }) });
  assertEquals(r.qualification?.score, 85);
  assertEquals(r.qualification?.treatment, "lip filler");
  assertEquals(r.qualification?.age_confirmed, true);
  assertStringIncludes(summarise(r.qualification!), "Wants: lip filler");
  assertEquals(handoffPriority("person"), "high");
  assertEquals(handoffPriority("stalled"), "medium");
  // The prompt asks for the age check for injectables, only for med spas.
  assertStringIncludes(systemPrompt({ business, rules: {} }, new Date()), "are you over 18");
  assert(!systemPrompt({ business: { ...business, businessType: "home_services" }, rules: {} }, new Date()).includes("are you over 18"));
});

Deno.test("after booking: the AI can move or cancel the appointment it booked", async () => {
  const slots = [{ iso: "2026-11-26T17:00:00.000Z", label: "Thu 26 Nov, 5pm" }];
  const c = scripted([() => ({ content: [tool("get_free_times", {})] }), () => ({ content: [tool("reschedule_appointment", { start_time: slots[0].iso }), tool("send_message", { text: "Done, you're now Thursday at 5pm." })] })]);
  const r = await runBrain({ business, rules: {} }, { mode: { kind: "reply" }, turns: [{ who: "lead", text: "can I move it to thursday?", at: "2026-11-24T10:00:00Z" }], lead: { firstName: "Jess", details: "" } }, {
    claude: c.claude,
    freeSlots: async () => slots,
    book: async () => ({ ok: false, error: "x" }),
    reschedule: async (iso) => ({ ok: true, label: iso === slots[0].iso ? slots[0].label : "?" }),
  });
  assertEquals(r.rescheduled?.label, "Thu 26 Nov, 5pm");
  // Nothing booked by the AI: it can't cancel, and is told to hand over.
  const d = scripted([() => ({ content: [tool("cancel_appointment", {})] }), () => ({ content: [tool("send_message", { text: "I'll pass that to the team." })] })]);
  const r2 = await runBrain({ business, rules: {} }, { mode: { kind: "reply" }, turns: [], lead: { firstName: "Jess", details: "" } }, { claude: d.claude, freeSlots: async () => [], book: async () => ({ ok: false, error: "x" }) });
  assertEquals(r2.cancelled, undefined);
});

Deno.test("listening first: a plain hello gets a greeting and a question, prices only when asked", () => {
  const p = systemPrompt({ business, rules: {} }, new Date("2026-11-24T15:00:00Z"));
  assertStringIncludes(p, "If they open with just a greeting");
  assertStringIncludes(p, "Prices: only when they ask");
  assertStringIncludes(p, "Never start every message with");
  assert(!p.includes("give one useful thing (the offer, a starting price"));
  const opener = taskText({ kind: "opener" }, { firstName: "Jess", details: "" });
  assertStringIncludes(opener, "No prices");
  assertStringIncludes(taskText({ kind: "missed_call" }, { firstName: "Jess", details: "" }), "missed");
  assertStringIncludes(taskText({ kind: "review" }, { firstName: "Jess", details: "", reviewLink: "https://g.page/r/x" }), "https://g.page/r/x");
  assertStringIncludes(taskText({ kind: "rebook" }, { firstName: "Jess", details: "", treatment: "lip filler" }), "lip filler");
});

Deno.test("keyword alerts: whole words and phrases, any case", () => {
  assertEquals(keywordHit("I want a REFUND please", ["refund", "manager"]), "refund");
  assertEquals(keywordHit("can I speak to the manager?", ["speak to the manager"]), "speak to the manager");
  assertEquals(keywordHit("refunded already", ["refund"]), null);
  assertEquals(keywordHit("hello", []), null);
});

Deno.test("journeys and rebooking rules: steps set the follow-up days; treatments set when they're due", () => {
  const r = rulesOf({ journey: [{ day: 3, action: "call_task" }, { day: 1, action: "sms" }, { day: 99, action: "email" }, { day: 5, action: "nonsense" as never }], rebookOn: true, rebookItems: [{ treatment: "Lip filler", days: 180 }, { treatment: "", days: 10 }] });
  assertEquals(r.journey, [{ day: 1, action: "sms" }, { day: 3, action: "call_task" }, { day: 5, action: "message" }]);
  assertEquals(r.followUpDays, [1, 3, 5]);
  assertEquals(rebookDaysFor("lip filler top-up", r), 180);
  assertEquals(rebookDaysFor("skin peel", r), 90);
  assertEquals(rulesOf({}).journey, []);
  assertEquals(rulesOf({}).followUpDays, [1, 3, 5, 8, 12, 16]);
});

Deno.test("journeys: a call-task step adds a GHL task instead of a message and schedules the next step", async () => {
  const c = scripted([() => ({ content: [tool("send_message", { text: "should not send" })] })]);
  const { ghl, calls } = fakeGhl({ messages: [{ id: "o1", direction: "outbound", body: "Hi Jess", messageType: "TYPE_SMS", dateAdded: "2026-11-23T15:00:00Z" }] });
  const thread = { ...newThread(), next_action: "followup" as const, last_outbound_at: "2026-11-23T15:00:00Z", sent_ids: ["o1"] };
  const a2 = { ...agent, rules: { journey: [{ day: 1, action: "call_task" as const }, { day: 3, action: "sms" as const }] } };
  const r = await work(fakeDb().db, a2, thread, { kind: "followup", touch: 0 }, { claude: c.claude, ghl, now: new Date("2026-11-24T15:00:00Z") });
  assertEquals(r.journey, "call_task");
  assert(calls.some((x) => x.path === "/contacts/c1/tasks" && String(x.body?.title).startsWith("Call Jess Doe")));
  assert(!calls.some((x) => x.path === "/conversations/messages"));
  assertEquals(thread.touches, 1);
  assertEquals(thread.next_action, "followup");
  assertEquals(c.seen.length, 0);
});

Deno.test("review request: sent after a visit, then the rebooking reminder is scheduled", async () => {
  const c = scripted([() => ({ content: [tool("send_message", { text: "Hope it went well! Would you mind leaving a quick review?" })] })]);
  const { ghl } = fakeGhl({});
  const thread = { ...newThread(), state: "booked" as const, next_action: "review" as const, rebook_at: "2027-02-22T15:00:00.000Z", last_outbound_at: "2026-11-01T10:00:00Z" };
  const r = await work(fakeDb().db, { ...agent, business: { ...business, reviewLink: "https://g.page/r/glow" } }, thread, { kind: "review" }, { claude: c.claude, ghl, now: new Date("2026-11-24T15:00:00Z") });
  assertStringIncludes(String(r.sent), "review");
  assertStringIncludes(JSON.stringify(c.seen[0]), "https://g.page/r/glow");
  assertEquals(thread.state, "booked");
  assertEquals(thread.next_action, "rebook");
  assertEquals(thread.next_action_at, "2027-02-22T15:00:00.000Z");
});

Deno.test("rebooking: the reminder starts a short new conversation", async () => {
  const c = scripted([() => ({ content: [tool("send_message", { text: "It's about that time again for your top-up. Shall I find you a time?" })] })]);
  const { ghl, calls } = fakeGhl({});
  const thread = { ...newThread(), state: "booked" as const, next_action: "rebook" as const, treatment: "lip filler", last_outbound_at: "2026-08-01T10:00:00Z" };
  await work(fakeDb().db, agent, thread, { kind: "rebook" }, { claude: c.claude, ghl, now: new Date("2026-11-24T15:00:00Z") });
  assertEquals(thread.state, "active");
  assertEquals(thread.origin, "rebooking");
  assertEquals(thread.next_action, "followup");
  assert(calls.some((x) => x.path === "/contacts/c1/tags" && JSON.stringify(x.body).includes("ai-rebooking")));
});

Deno.test("website scan: reads the home page and useful pages on the same site, then pulls out the facts", async () => {
  const pages: Record<string, string> = {
    "https://glow.example/": `<html><body><h1>Glow Aesthetics</h1><p>${"Welcome to our clinic in Cardiff. ".repeat(10)}</p><a href="/treatments">Treatments</a><a href="/faq">FAQ</a><a href="https://other.example/treatments">x</a><a href="/logo.png">x</a><script>bad()</script></body></html>`,
    "https://glow.example/treatments": `<p>${"Lip filler from &pound;180. ".repeat(12)}</p>`,
    "https://glow.example/faq": `<p>${"Is there downtime? Usually none. ".repeat(10)}</p>`,
  };
  const fetcher = (async (u: string | URL) => new Response(pages[String(u)] ?? "", { status: pages[String(u)] ? 200 : 404, headers: { "content-type": "text/html" } })) as typeof fetch;
  const read = await readSite(new URL("https://glow.example/"), fetcher);
  assertEquals(read.map((p) => p.url), ["https://glow.example/", "https://glow.example/treatments", "https://glow.example/faq"]);
  assert(!read[0].text.includes("bad()"));
  assertStringIncludes(read[1].text, "£180");
  const c = scripted([() => ({ content: [tool("findings", { clinicName: "Glow Aesthetics", location: "Cardiff", services: "Lip filler from £180", knowledge: [{ question: "Is there downtime?", answer: "Usually none." }, { question: "", answer: "x" }] })] })]);
  const found = await scanSite(c.claude as never, read);
  assertEquals(found.business.clinicName, "Glow Aesthetics");
  assertEquals(found.knowledge, [{ question: "Is there downtime?", answer: "Usually none." }]);
});
