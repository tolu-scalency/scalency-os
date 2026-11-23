"use client";

import { shortId } from "@/lib/short-id-shared";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Icon } from "@/components/icon";
import type { BoardCard, BoardColumn, PipelineSummary } from "@/lib/data";
import { createDeal } from "./actions";
import {
  Board,
  CARD_FIELDS,
  DEFAULT_CARD_FIELDS,
  type CardField,
} from "./board";
import { DealPanel, type Person, type StageOption } from "./deal-panel";

const money = (p: number | null) =>
  p == null
    ? ""
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
      }).format(p / 100);
const FIELDS_KEY = "scalency.card-fields";

type Props = {
  pipelines: PipelineSummary[];
  pipelineId: string;
  columns: BoardColumn[];
  cards: BoardCard[];
  view: "board" | "list";
  stages: StageOption[];
  people: Person[];
  sources: string[];
  tags: string[];
  contacts: { id: string; name: string }[];
  canEdit: boolean;
  children?: React.ReactNode;
};

/** The pipeline screen: switch pipelines, board or list, filters, card fields and the deal panel. */
export function PipelineView(p: Props) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const [panel, setPanel] = useState<"filters" | "fields" | "new" | null>(null);
  const [fields, setFields] = useState<CardField[]>(DEFAULT_CARD_FIELDS);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FIELDS_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setFields(saved);
    } catch {}
  }, []);
  function toggleField(k: CardField) {
    const next = fields.includes(k)
      ? fields.filter((f) => f !== k)
      : [...fields, k];
    setFields(next);
    try {
      localStorage.setItem(FIELDS_KEY, JSON.stringify(next));
    } catch {}
  }

  function go(changes: Record<string, string | null>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    router.push(`${path}?${q.toString()}`);
  }

  const active = [
    "q",
    "owner",
    "status",
    "source",
    "tag",
    "min",
    "max",
    "from",
    "to",
  ].filter(
    (k) => params.get(k) && !(k === "status" && params.get(k) === "open"),
  );
  const currentStages = p.stages.filter((s) => s.pipelineId === p.pipelineId);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Pipeline</span>
          <select
            value={p.pipelineId}
            onChange={(e) => go({ p: e.target.value })}
            className="field h-10 w-auto min-w-[180px] pr-9 text-[14px] font-semibold"
          >
            {p.pipelines.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <div
          className="inline-flex rounded-xl border border-line bg-white p-0.5"
          role="group"
          aria-label="View"
        >
          {(["board", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => go({ view: v === "board" ? null : v })}
              aria-pressed={p.view === v}
              className={`inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition-colors ${p.view === v ? "bg-brand text-white" : "text-muted hover:text-navy"}`}
            >
              <Icon name={v === "board" ? "columns" : "list"} size={14} />{" "}
              {v === "board" ? "Board" : "List"}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go({
              q:
                String(new FormData(e.currentTarget).get("q") ?? "").trim() ||
                null,
            });
          }}
          className="flex h-10 min-w-0 flex-[1_1_200px] items-center gap-2 rounded-xl border border-line bg-white px-3 focus-within:border-sky"
        >
          <Icon name="search" size={15} className="text-faint" />
          <input
            name="q"
            defaultValue={params.get("q") ?? ""}
            placeholder="Search deals, names, emails"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
          />
        </form>
        <button
          type="button"
          onClick={() => setPanel(panel === "filters" ? null : "filters")}
          aria-expanded={panel === "filters"}
          className={`btn-ghost inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold ${active.length ? "border-brand text-brand" : ""}`}
        >
          <Icon name="filter" size={14} /> Filters
          {active.length ? ` (${active.length})` : ""}
        </button>
        {p.view === "board" && (
          <button
            type="button"
            onClick={() => setPanel(panel === "fields" ? null : "fields")}
            aria-expanded={panel === "fields"}
            className="btn-ghost inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold"
          >
            <Icon name="settings" size={14} /> Card fields
          </button>
        )}
        {p.canEdit && (
          <button
            type="button"
            onClick={() => setPanel(panel === "new" ? null : "new")}
            className="btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold"
          >
            <Icon name="plus" size={14} /> New deal
          </button>
        )}
      </div>

      {panel === "filters" && (
        <form
          className="rise card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const changes: Record<string, string | null> = {};
            for (const k of [
              "owner",
              "status",
              "source",
              "tag",
              "min",
              "max",
              "from",
              "to",
            ])
              changes[k] = String(fd.get(k) ?? "").trim() || null;
            go(changes);
            setPanel(null);
          }}
        >
          <Field label="Owner">
            <select
              name="owner"
              defaultValue={params.get("owner") ?? ""}
              className="field"
            >
              <option value="">Anyone</option>
              <option value="none">No owner</option>
              {p.people.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              name="status"
              defaultValue={params.get("status") ?? "open"}
              className="field"
            >
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="abandoned">Abandoned</option>
              <option value="all">All</option>
            </select>
          </Field>
          <Field label="Source">
            <select
              name="source"
              defaultValue={params.get("source") ?? ""}
              className="field"
            >
              <option value="">Any source</option>
              {p.sources.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tag">
            <select
              name="tag"
              defaultValue={params.get("tag") ?? ""}
              className="field"
            >
              <option value="">Any tag</option>
              {p.tags.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Value from (£)">
            <input
              name="min"
              type="number"
              min="0"
              defaultValue={params.get("min") ?? ""}
              className="field"
            />
          </Field>
          <Field label="Value to (£)">
            <input
              name="max"
              type="number"
              min="0"
              defaultValue={params.get("max") ?? ""}
              className="field"
            />
          </Field>
          <Field label="Added from">
            <input
              name="from"
              type="date"
              defaultValue={params.get("from") ?? ""}
              className="field"
            />
          </Field>
          <Field label="Added to">
            <input
              name="to"
              type="date"
              defaultValue={params.get("to") ?? ""}
              className="field"
            />
          </Field>
          <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="button"
              onClick={() => {
                go({
                  q: null,
                  owner: null,
                  status: null,
                  source: null,
                  tag: null,
                  min: null,
                  max: null,
                  from: null,
                  to: null,
                });
                setPanel(null);
              }}
              className="btn-ghost min-h-10 rounded-xl px-4 text-[13px] font-semibold"
            >
              Clear all
            </button>
            <button
              type="submit"
              className="btn-primary min-h-10 rounded-xl px-5 text-[13px] font-semibold"
            >
              Apply filters
            </button>
          </div>
        </form>
      )}

      {panel === "fields" && (
        <div className="rise card flex flex-wrap gap-2 p-4">
          <span className="w-full text-[13px] font-semibold">
            Show on every card
          </span>
          {CARD_FIELDS.map((f) => (
            <label
              key={f.key}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[13px] has-[:checked]:border-brand has-[:checked]:bg-chip has-[:checked]:text-brand"
            >
              <input
                type="checkbox"
                checked={fields.includes(f.key)}
                onChange={() => toggleField(f.key)}
                className="h-3.5 w-3.5"
              />
              {f.label}
            </label>
          ))}
        </div>
      )}

      {panel === "new" && (
        <ActionForm
          action={createDeal}
          resetOnOk
          className="rise card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Field label="Contact">
            <select
              name="contact_id"
              required
              defaultValue=""
              className="field"
            >
              <option value="" disabled>
                Choose a contact…
              </option>
              {p.contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deal name (optional)">
            <input
              name="name"
              maxLength={120}
              placeholder="e.g. Website redesign"
              className="field"
            />
          </Field>
          <Field label="Stage">
            <select
              name="stage_id"
              required
              defaultValue={currentStages[0]?.id}
              className="field"
            >
              {p.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Value (£)">
            <input
              name="value"
              type="number"
              min="0"
              step="0.01"
              className="field"
            />
          </Field>
          <Field label="Owner">
            <select name="owner" defaultValue="" className="field">
              <option value="">No owner</option>
              {p.people.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Source">
            <input
              name="source"
              maxLength={80}
              list="deal-sources"
              placeholder="e.g. Referral"
              className="field"
            />
            <datalist id="deal-sources">
              {p.sources.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </Field>
          <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-3">
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="btn-ghost min-h-10 rounded-xl px-4 text-[13px] font-semibold"
            >
              Cancel
            </button>
            <SubmitButton icon="plus" pendingText="Adding…">
              Add deal
            </SubmitButton>
          </div>
        </ActionForm>
      )}

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="text-muted">Filtered by</span>
          {active.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => go({ [k]: null })}
              className="inline-flex items-center gap-1 rounded-full bg-chip px-2.5 py-1 font-medium text-brand hover:bg-white"
            >
              {k}:{" "}
              {k === "owner"
                ? params.get(k) === "none"
                  ? "no owner"
                  : (p.people.find((x) => x.id === params.get(k))?.name ??
                    "someone")
                : params.get(k)}
              <Icon name="x" size={11} />
            </button>
          ))}
        </div>
      )}

      {p.view === "board" ? (
        <Board
          key={
            p.columns.map((c) => c.id + c.name + c.cards.length).join("|") +
            p.cards.map((c) => c.opportunityId).join()
          }
          columns={p.columns}
          onOpen={setOpen}
          fields={fields}
        >
          {p.children}
        </Board>
      ) : (
        <DealList
          cards={p.cards}
          stages={p.stages}
          onOpen={setOpen}
          sort={params.get("sort") ?? "updated"}
          onSort={(s) => go({ sort: s === "updated" ? null : s })}
        />
      )}

      {open && (
        <DealPanel
          id={open}
          stages={p.stages}
          people={p.people}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function DealList({
  cards,
  stages,
  onOpen,
  sort,
  onSort,
}: {
  cards: BoardCard[];
  stages: StageOption[];
  onOpen: (id: string) => void;
  sort: string;
  onSort: (s: string) => void;
}) {
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const total = cards.reduce((s, c) => s + (c.valuePence ?? 0), 0);
  if (!cards.length)
    return (
      <div className="card p-10 text-center text-[14px] text-muted">
        No deals match. Try clearing the filters.
      </div>
    );
  // A spreadsheet of exactly what's shown (same filters and order).
  const exportCsv = () => {
    const cell = (v: unknown) => {
      const t = v == null ? "" : String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const rows = [
      [
        "Deal",
        "Contact",
        "Email",
        "Phone",
        "Stage",
        "Value",
        "Owner",
        "Source",
        "Status",
        "Tags",
        "Added",
      ],
      ...cards.map((c) => [
        c.name,
        c.contactName,
        c.email,
        c.phone,
        stageName.get(c.stageId) ?? "",
        c.valuePence == null ? "" : (c.valuePence / 100).toFixed(2),
        c.ownerName ?? "",
        c.source ?? "",
        c.status,
        c.tags.join("; "),
        c.createdAt.slice(0, 10),
      ]),
    ];
    const blob = new Blob(
      [rows.map((r) => r.map(cell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `opportunities-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={exportCsv}
          className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold"
        >
          <Icon name="download" size={14} /> Export to spreadsheet (CSV)
        </button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <thead className="border-b border-line bg-surface/60">
            <tr>
              <SortHead k="name" sort={sort} onSort={onSort}>
                Deal
              </SortHead>
              <SortHead sort={sort} onSort={onSort}>
                Contact
              </SortHead>
              <SortHead sort={sort} onSort={onSort}>
                Stage
              </SortHead>
              <SortHead
                k="value"
                className="text-right"
                sort={sort}
                onSort={onSort}
              >
                Value
              </SortHead>
              <SortHead sort={sort} onSort={onSort}>
                Owner
              </SortHead>
              <SortHead sort={sort} onSort={onSort}>
                Source
              </SortHead>
              <SortHead sort={sort} onSort={onSort}>
                Status
              </SortHead>
              <SortHead k="created" sort={sort} onSort={onSort}>
                Added
              </SortHead>
            </tr>
          </thead>
          <tbody className="stagger">
            {cards.map((c) => (
              <tr
                key={c.opportunityId}
                onClick={() => onOpen(c.opportunityId)}
                className="cursor-pointer border-b border-line text-[13.5px] transition-colors last:border-0 hover:bg-surface/70"
              >
                <td className="px-3 py-3 font-semibold">{c.name}</td>
                <td className="px-3 py-3">
                  <Link
                    href={`/contacts/${shortId(c.contactId)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-brand hover:underline"
                  >
                    {c.contactName}
                  </Link>
                </td>
                <td className="px-3 py-3">{stageName.get(c.stageId) ?? ""}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">
                  {money(c.valuePence)}
                </td>
                <td className="px-3 py-3 text-muted">
                  {c.ownerName ?? "No owner"}
                </td>
                <td className="px-3 py-3 text-muted">{c.source ?? ""}</td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${c.status === "won" ? "bg-ok-bg text-ok" : c.status === "open" ? "bg-chip text-brand" : "bg-bad-bg text-bad"}`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-muted">
                  {new Date(c.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface/60 text-[13px]">
              <td className="px-3 py-2.5 font-semibold" colSpan={3}>
                {cards.length} {cards.length === 1 ? "deal" : "deals"}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                {money(total)}
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function SortHead({
  k,
  children,
  className = "",
  sort,
  onSort,
}: {
  k?: string;
  children: React.ReactNode;
  className?: string;
  sort: string;
  onSort: (s: string) => void;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-muted ${className}`}
    >
      {k ? (
        <button
          type="button"
          onClick={() => onSort(k)}
          className={`inline-flex items-center gap-1 uppercase tracking-wide ${sort === k ? "text-brand" : ""}`}
        >
          {children}
          {sort === k && <Icon name="down" size={11} />}
        </button>
      ) : (
        children
      )}
    </th>
  );
}
