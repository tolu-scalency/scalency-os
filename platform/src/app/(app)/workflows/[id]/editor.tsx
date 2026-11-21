"use client";

// The workflow builder: a canvas you can pan and zoom, with the trigger at the top
// and steps flowing down. If / else splits into side-by-side branches that join
// back up underneath. Click any card to edit it in the floating panel, drag cards
// onto a + to move them.

import { notify } from "@/components/toast";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import type { CustomField, CustomValue, Stage, StepType, WorkflowStep, WorkflowTrigger } from "@/lib/data";
import { mergeFields } from "@/lib/merge-fields";
import { cloneNode, countNodes, findNode, insertNode, locate, MAX_NODES, moveNode, newId, removeNode, toTree, updateNode, type BranchNode, type FlowNode } from "@/lib/flow";
import { saveWorkflow } from "../actions";
import { blank, groups, kinds, problem, StepFields, summary, type Option } from "./step-fields";
import { BranchFields, conditionText, newRoute } from "./branch-fields";
import { FloatingPanel } from "./panel";
import { newTrigger, triggerDef, TriggerFilters, TriggerPicker } from "./trigger-fields";
import { triggerLabel } from "../labels";

type Editable = { id: string; name: string; description: string; trigger: WorkflowTrigger; steps: WorkflowStep[]; graph: unknown[] | null; stopOnReply: boolean };
type Selection = { t: "trigger" } | { t: "node"; id: string } | { t: "add"; list: string; index: number } | { t: "settings" } | null;

const BRANCH_TONE = "from-[#c4b5fd] to-[#7c3aed]";

function initialTree(w: Editable): FlowNode[] {
  if (Array.isArray(w.graph) && w.graph.length) return w.graph as FlowNode[];
  return toTree(w.steps);
}

export function WorkflowEditor({
  workflow,
  stages,
  pipelines,
  members,
  workflows,
  tags,
  hookBase,
  locked,
  customFields,
  customValues,
  forms = [],
}: {
  workflow: Editable;
  stages: Stage[];
  pipelines: Option[];
  members: Option[];
  workflows: Option[];
  tags: string[];
  hookBase: string;
  locked: boolean;
  customFields: CustomField[];
  customValues: CustomValue[];
  forms?: Option[];
}) {
  const fieldsList = mergeFields(customFields, customValues);
  const others = workflows.filter((w) => w.id !== workflow.id);
  const ctx = { stages, members, workflows: others, customFields, pipelines, forms };

  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description);
  const [trigger, setTrigger] = useState<WorkflowTrigger>(workflow.trigger);
  const [stopOnReply, setStopOnReply] = useState(workflow.stopOnReply);
  const [nodes, setNodes] = useState<FlowNode[]>(() => initialTree(workflow));
  const [sel, setSel] = useState<Selection>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropOver, setDropOver] = useState<string | null>(null);
  const [choosingTrigger, setChoosingTrigger] = useState(false);
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const disabled = locked;

  function change(fn: () => void) {
    fn();
    setDirty(true);
    setMessage({});
  }
  const edit = (fn: (n: FlowNode[]) => FlowNode[]) => change(() => setNodes(fn));

  // ---------------------------------------------------------------- saving
  const savedRef = useRef({ name: workflow.name, description: workflow.description, trigger: workflow.trigger, stopOnReply: workflow.stopOnReply, nodes });
  const backupKey = `scalency.wf-draft.${workflow.id}`;
  const [restorable, setRestorable] = useState(false);

  function save(auto = false) {
    start(async () => {
      const snapshot = { name, description, trigger, stopOnReply, nodes };
      const result = await saveWorkflow(workflow.id, { name, description, trigger, graph: nodes, stopOnReply }).catch(() => ({ error: "We couldn't save. Check your connection and try again.", token: undefined }));
      if (auto && result.error) {
        setMessage({ error: `Not saved yet: ${result.error}` });
        notify(`Not saved yet: ${result.error}`, "bad");
        return;
      }
      setMessage(auto ? { ok: "All changes saved" } : result);
      notify("Saved");
      if (!result.error) {
        setDirty(false);
        savedRef.current = { ...snapshot, trigger: result.token ? { type: "webhook", token: result.token } : trigger };
        try {
          localStorage.removeItem(backupKey);
        } catch {}
        if (result.token) setTrigger({ type: "webhook", token: result.token });
      }
    });
  }

  function cancel() {
    const s0 = savedRef.current;
    setName(s0.name);
    setDescription(s0.description);
    setTrigger(s0.trigger);
    setStopOnReply(s0.stopOnReply);
    setNodes(s0.nodes);
    setDirty(false);
    setSel(null);
    setMessage({ ok: "Changes discarded" });
    try {
      localStorage.removeItem(backupKey);
    } catch {}
  }

  // Autosave two seconds after the last change, with a copy kept on this device.
  useEffect(() => {
    if (!dirty || locked) return;
    try {
      localStorage.setItem(backupKey, JSON.stringify({ at: Date.now(), name, description, trigger, graph: nodes, stopOnReply }));
    } catch {}
    const t = setTimeout(() => save(true), 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, name, description, trigger, nodes, stopOnReply]);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(backupKey)) setRestorable(true);
    } catch {}
  }, [backupKey]);

  function restore() {
    try {
      const b = JSON.parse(localStorage.getItem(backupKey) ?? "null");
      if (b) {
        setName(b.name);
        setDescription(b.description);
        setTrigger(b.trigger);
        setStopOnReply(b.stopOnReply);
        setNodes(Array.isArray(b.graph) ? b.graph : toTree(b.steps ?? []));
        setDirty(true);
      }
    } catch {}
    setRestorable(false);
  }

  // ---------------------------------------------------------------- canvas
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [zoom, setZoomState] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 24 });
  const panning = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const setZoom = useCallback((z: number, around?: { x: number; y: number }) => {
    const next = Math.round(Math.min(1.5, Math.max(0.25, z)) * 100) / 100;
    setZoomState((old) => {
      if (around)
        setPan((p) => ({ x: around.x - ((around.x - p.x) * next) / old, y: around.y - ((around.y - p.y) * next) / old }));
      return next;
    });
    try {
      localStorage.setItem("scalency.wf-zoom", String(next));
    } catch {}
  }, []);

  const centre = useCallback((z: number) => {
    const v = viewport.current;
    const c = content.current;
    if (!v || !c) return;
    setPan({ x: (v.clientWidth - c.offsetWidth * z) / 2, y: 24 });
  }, []);

  function fit() {
    const v = viewport.current;
    const c = content.current;
    if (!v || !c) return;
    const z = Math.max(0.25, Math.min(1, (v.clientWidth - 40) / c.offsetWidth, (v.clientHeight - 48) / c.offsetHeight));
    setZoom(z);
    centre(z);
  }

  useEffect(() => {
    let z = 1;
    try {
      const saved = Number(localStorage.getItem("scalency.wf-zoom"));
      if (saved >= 0.25 && saved <= 1.5) z = saved;
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZoomState(z);
    centre(z);
  }, [centre]);

  // Scroll to move around, Ctrl or Cmd + scroll (or pinch) to zoom.
  useEffect(() => {
    const v = viewport.current;
    if (!v) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[data-scroll]")) return;
      e.preventDefault();
      const r = v.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        setZoomState((old) => {
          const next = Math.round(Math.min(1.5, Math.max(0.25, old * (e.deltaY < 0 ? 1.1 : 0.9))) * 100) / 100;
          const ax = e.clientX - r.left;
          const ay = e.clientY - r.top;
          setPan((p) => ({ x: ax - ((ax - p.x) * next) / old, y: ay - ((ay - p.y) * next) / old }));
          return next;
        });
      } else setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    };
    v.addEventListener("wheel", onWheel, { passive: false });
    return () => v.removeEventListener("wheel", onWheel);
  }, []);

  function onPanStart(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-node],button,input,select,textarea,a")) return;
    panning.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPanMove(e: React.PointerEvent) {
    const p = panning.current;
    if (!p) return;
    setPan({ x: p.px + e.clientX - p.x, y: p.py + e.clientY - p.y });
  }
  function onPanEnd() {
    panning.current = null;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------------------------------------------------------------- edits
  const total = useMemo(() => countNodes(nodes), [nodes]);
  const issues = useMemo(() => {
    let n = 0;
    const walk = (list: FlowNode[]) =>
      list.forEach((x) => {
        if (x.type === "branch") {
          x.branches.forEach((r) => walk(r.steps));
          walk(x.otherwise.steps);
        } else if (problem(x as WorkflowStep)) n++;
      });
    walk(nodes);
    return n;
  }, [nodes]);

  function add(type: StepType, list: string, index: number) {
    if (total >= MAX_NODES) {
      setMessage({ error: `Keep it to ${MAX_NODES} steps or fewer.` });
      return;
    }
    const node: FlowNode =
      type === "if_else"
        ? { id: newId(), type: "branch", branches: [{ ...newRoute(1), name: "Yes" }], otherwise: { name: "None", steps: [] } }
        : blank(type, stages, members, others);
    edit((n) => insertNode(n, list, index, node));
    setSel({ t: "node", id: node.id });
  }

  function remove(id: string) {
    const n = findNode(nodes, id);
    if (n?.type === "branch") {
      const inside = countNodes([n]) - 1;
      if (inside > 0 && !confirm(`Delete this If / else and the ${inside} step${inside === 1 ? "" : "s"} inside its branches?`)) return;
    }
    edit((all) => removeNode(all, id));
    setSel(null);
  }

  function duplicate(id: string) {
    const n = findNode(nodes, id);
    if (!n) return;
    if (total + countNodes([n]) > MAX_NODES) {
      setMessage({ error: `Keep it to ${MAX_NODES} steps or fewer.` });
      return;
    }
    const copy = cloneNode(n);
    edit((all) => {
      const at = locate(all, id);
      return at ? insertNode(all, at.list, at.index + 1, copy) : all;
    });
    setSel({ t: "node", id: copy.id });
  }

  function drop(list: string, index: number) {
    if (!dragId) return;
    edit((n) => moveNode(n, dragId, list, index));
    setDragId(null);
    setDropOver(null);
  }

  function pickTrigger(type: string) {
    const old = workflow.trigger.type === "webhook" ? workflow.trigger.token : undefined;
    change(() => setTrigger(newTrigger(type, stages, pipelines, old)));
    setChoosingTrigger(false);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const hookUrl = trigger.type === "webhook" && trigger.token ? `${hookBase}/api/hooks/${trigger.token}` : "";
  const selected = sel?.t === "node" ? findNode(nodes, sel.id) : null;

  // ---------------------------------------------------------------- render helpers
  function plus(list: string, index: number) {
    const open = sel?.t === "add" && sel.list === list && sel.index === index;
    const spot = `${list}#${index}`;
    const over = dropOver === spot;
    return (
      <div key={`plus-${spot}`} className="flex flex-col items-center">
        <span className="h-4 w-0.5 bg-line-strong" />
        {disabled ? (
          <span className="h-3 w-0.5 bg-line-strong" />
        ) : (
          <button
            type="button"
            onClick={() => setSel(open ? null : { t: "add", list, index })}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setDropOver(spot);
            }}
            onDragLeave={() => setDropOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDropOver(null);
              drop(list, index);
            }}
            aria-label="Add a step here"
            title={dragId ? "Drop here" : "Add a step"}
            className={`inline-flex items-center justify-center rounded-full border bg-white shadow-sm transition-all ${
              dragId ? (over ? "h-9 w-24 border-brand bg-[#e8f1ff] text-brand" : "h-7 w-20 border-dashed border-sky text-sky") : open ? "h-7 w-7 border-brand bg-brand text-white" : "h-7 w-7 border-line-strong text-muted hover:border-sky hover:text-brand"
            }`}
          >
            {dragId ? <span className="text-[11px] font-semibold">Drop here</span> : <Icon name="plus" size={14} />}
          </button>
        )}
        <span className="h-4 w-0.5 bg-line-strong" />
      </div>
    );
  }

  function card(node: FlowNode) {
    const isSel = sel?.t === "node" && sel.id === node.id;
    const isBranch = node.type === "branch";
    const k = isBranch ? null : (kinds.find((x) => x.type === node.type) ?? kinds[0]);
    const issue = isBranch ? null : problem(node as WorkflowStep);
    return (
      <div
        data-node
        draggable={!disabled}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", node.id);
          setDragId(node.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setDropOver(null);
        }}
        onClick={() => setSel({ t: "node", id: node.id })}
        className={`group relative w-[280px] cursor-pointer rounded-2xl border bg-white p-3 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] ${
          isSel ? "border-brand ring-4 ring-[#0a5fe3]/15" : issue ? "border-warn/60" : "border-line"
        } ${dragId === node.id ? "opacity-40" : ""}`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br text-white ${isBranch ? BRANCH_TONE : k!.tone}`}>
            <Icon name={isBranch ? "branch" : k!.icon} size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold">{node.label || (isBranch ? "If / else" : k!.label)}</div>
            <div className="truncate text-[12px] text-muted">
              {isBranch ? `${node.branches.length + 1} branches` : summary(node as WorkflowStep, ctx)}
            </div>
          </div>
          {!disabled && <Icon name="grip" size={14} className="flex-none text-faint opacity-0 transition-opacity group-hover:opacity-100" />}
        </div>
        {issue && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-warn-bg px-1.5 py-0.5 text-[11px] font-semibold text-warn">
            <Icon name="warning" size={11} /> {issue}
          </div>
        )}
      </div>
    );
  }

  function list(key: string, items: FlowNode[], root?: boolean) {
    const ended = items.at(-1)?.type === "end";
    return (
      <>
        {items.map((n, i) => (
          <div key={n.id} className="flex flex-col items-center">
            {plus(key, i)}
            {card(n)}
            {n.type === "branch" && branches(n)}
          </div>
        ))}
        {!ended && plus(key, items.length)}
        {root && !ended && (
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[12.5px] font-semibold text-muted shadow-[var(--shadow-card)] ring-1 ring-line">
            <Icon name="checkCircle" size={14} className="text-ok" /> End
          </div>
        )}
      </>
    );
  }

  function branches(node: BranchNode) {
    const cols = [...node.branches.map((r) => ({ key: `${node.id}/${r.id}`, name: r.name, steps: r.steps, sub: r.conditions.map((c) => conditionText(c, ctx)).join(r.match === "all" ? " and " : " or ") })), { key: `${node.id}/else`, name: node.otherwise.name, steps: node.otherwise.steps, sub: "None of the above" }];
    const n = cols.length;
    const allEnd = cols.every((c) => c.steps.at(-1)?.type === "end");
    return (
      <div className="flex flex-col items-center">
        <span className="h-5 w-0.5 bg-line-strong" />
        <div className="flex items-stretch">
          {cols.map((c, i) => {
            const ended = c.steps.at(-1)?.type === "end";
            return (
              <div key={c.key} className="relative flex flex-col items-center px-5">
                <span className="absolute top-0 h-0.5 bg-line-strong" style={{ left: i === 0 ? "50%" : 0, right: i === n - 1 ? "50%" : 0 }} />
                <span className="h-4 w-0.5 bg-line-strong" />
                <button
                  type="button"
                  data-node
                  onClick={() => setSel({ t: "node", id: node.id })}
                  title={c.sub}
                  className={`max-w-[240px] rounded-xl border px-3 py-1.5 text-left shadow-sm transition-colors ${i === n - 1 ? "border-line bg-surface text-muted" : "border-[#ddd6fe] bg-[#f5f3ff] text-[#5b21b6]"} hover:border-[#a78bfa]`}
                >
                  <div className="truncate text-[12.5px] font-bold">{c.name || "Branch"}</div>
                  <div className="truncate text-[11px] opacity-80">{c.sub}</div>
                </button>
                {list(c.key, c.steps)}
                {!ended && <span className="w-0.5 flex-1 bg-line-strong" />}
                {ended && <span className="flex-1" />}
                {!allEnd && <span className="absolute bottom-0 h-0.5 bg-line-strong" style={{ left: i === 0 ? "50%" : 0, right: i === n - 1 ? "50%" : 0 }} />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- panel
  function renderPanel() {
    if (!sel) return null;
    if (sel.t === "add") return <AddPanel onPick={(t) => add(t, sel.list, sel.index)} onClose={() => setSel(null)} />;
    if (sel.t === "settings")
      return (
        <FloatingPanel title="Workflow settings" icon={<Icon name="settings" size={15} />} onClose={() => setSel(null)}>
          <fieldset disabled={disabled} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Name</span>
              <input value={name} onChange={(e) => change(() => setName(e.target.value))} className="field h-11 font-semibold" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">What it&apos;s for</span>
              <input value={description} onChange={(e) => change(() => setDescription(e.target.value))} placeholder="Optional" className="field h-11" />
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={stopOnReply} onChange={(e) => change(() => setStopOnReply(e.target.checked))} className="mt-0.5 h-4 w-4 accent-[#0a5fe3]" />
              <span className="text-[13.5px]">
                <span className="font-medium">Stop when the lead replies</span>
                <span className="block text-[12.5px] text-muted">So nobody gets chased after they&apos;ve answered. “Wait for a reply” steps still carry on.</span>
              </span>
            </label>
          </fieldset>
        </FloatingPanel>
      );
    if (sel.t === "trigger") {
      const picking = !disabled && (choosingTrigger || trigger.type === "none");
      const def = triggerDef(trigger.type);
      return (
        <FloatingPanel
          title={picking ? "Choose a trigger" : (def?.label ?? "Trigger")}
          subtitle={picking ? "What starts this workflow" : "What starts this workflow"}
          icon={<Icon name={picking ? "play" : (def?.icon ?? "play")} size={15} />}
          onClose={() => {
            setSel(null);
            setChoosingTrigger(false);
          }}
        >
          {picking ? (
            <>
              {trigger.type !== "none" && (
                <button type="button" onClick={() => setChoosingTrigger(false)} className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand">
                  <Icon name="arrowLeft" size={13} /> Keep “{def?.label}”
                </button>
              )}
              <TriggerPicker onPick={pickTrigger} />
            </>
          ) : (
            <fieldset disabled={disabled} className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
                <span className="tile h-9 w-9 rounded-xl"><Icon name={def?.icon ?? "play"} size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold">{def?.label}</div>
                  <div className="text-[12px] text-muted">{def?.hint}</div>
                </div>
                {!disabled && (
                  <button type="button" onClick={() => setChoosingTrigger(true)} className="btn-ghost inline-flex min-h-9 items-center rounded-xl px-3 text-[12.5px] font-semibold">Change</button>
                )}
              </div>
              <TriggerFilters trigger={trigger} onChange={(t) => change(() => setTrigger(t))} stages={stages} pipelines={pipelines} forms={forms} />
              {trigger.type === "webhook" && (
                <div className="rounded-xl bg-surface p-3 text-[13px]">
                  {hookUrl ? (
                    <>
                      <div className="mb-1.5 font-medium">Send leads to this address (POST):</div>
                      <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2.5 py-2 text-[12px] ring-1 ring-line">{hookUrl}</code>
                        <button type="button" onClick={() => copy(hookUrl)} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
                          <Icon name={copied ? "check" : "link"} size={13} /> {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="mt-2 text-muted">
                        Send JSON with <code>first_name</code>, <code>last_name</code>, <code>email</code>, <code>phone</code>, and optionally <code>source</code> and <code>tags</code>. Keep this address private.
                      </p>
                    </>
                  ) : (
                    <p className="text-muted">Save to get the address other apps send leads to.</p>
                  )}
                </div>
              )}
            </fieldset>
          )}
        </FloatingPanel>
      );
    }
    if (!selected) return null;
    const isBranch = selected.type === "branch";
    const k = isBranch ? null : (kinds.find((x) => x.type === selected.type) ?? kinds[0]);
    return (
      <FloatingPanel
        title={selected.label || (isBranch ? "If / else" : k!.label)}
        subtitle={isBranch ? "Split contacts down different paths" : `${k!.group} action`}
        icon={<Icon name={isBranch ? "branch" : k!.icon} size={15} />}
        tone={isBranch ? BRANCH_TONE : k!.tone}
        onClose={() => setSel(null)}
        footer={
          disabled ? undefined : (
            <>
              <button type="button" onClick={() => duplicate(selected.id)} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
                <Icon name="copy" size={14} /> Duplicate
              </button>
              <button type="button" onClick={() => remove(selected.id)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-bad hover:bg-bad-bg">
                <Icon name="trash" size={14} /> Delete
              </button>
              <span className="flex-1" />
              <button type="button" onClick={() => setSel(null)} className="btn-primary inline-flex min-h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
                <Icon name="check" size={14} /> Done
              </button>
            </>
          )
        }
      >
        <fieldset disabled={disabled} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-muted">Step name (optional)</span>
            <input
              value={selected.label ?? ""}
              maxLength={60}
              onChange={(e) => edit((n) => updateNode(n, selected.id, (x) => ({ ...x, label: e.target.value || undefined }) as FlowNode))}
              placeholder={isBranch ? "e.g. Did they book?" : k!.label}
              className="field h-10"
            />
          </label>
          <div className="h-px bg-line" />
          {isBranch ? (
            <BranchFields
              node={selected}
              onChange={(nb) => edit((n) => updateNode(n, selected.id, () => nb))}
              stages={stages}
              pipelines={pipelines}
              members={members}
              customFields={customFields}
              tags={tags}
              forms={forms}
              workflows={others}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              <StepFields
                step={selected as WorkflowStep}
                stages={stages}
                members={members}
                workflows={others}
                fields={fieldsList}
                customFields={customFields}
                pipelines={pipelines}
                allTags={tags}
                onChange={(p) => edit((n) => updateNode(n, selected.id, (x) => ({ ...x, ...p }) as FlowNode))}
              />
            </div>
          )}
        </fieldset>
      </FloatingPanel>
    );
  }

  // ---------------------------------------------------------------- page
  const zbtn = "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-semibold text-navy transition-colors hover:bg-surface disabled:opacity-40";
  return (
    <div className="flex flex-col gap-3">
      <datalist id="wf-tags">
        {tags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {restorable && !disabled && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warn/30 bg-warn-bg p-3 text-[13.5px]">
          <Icon name="refresh" size={15} />
          <span className="min-w-0 flex-1">You have changes from last time that weren&apos;t saved.</span>
          <button type="button" onClick={restore} className="btn-primary min-h-9 rounded-lg px-3 text-[13px] font-semibold">Restore them</button>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(backupKey);
              } catch {}
              setRestorable(false);
            }}
            className="btn-ghost min-h-9 rounded-lg px-3 text-[13px] font-semibold"
          >
            Discard
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white p-2 pl-3 shadow-[var(--shadow-card)]">
        <button type="button" onClick={() => setSel({ t: "settings" })} className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-surface" title="Workflow settings">
          <span className="truncate text-[15px] font-semibold">{name || "Untitled workflow"}</span>
          <Icon name="edit" size={13} className="flex-none text-faint" />
        </button>
        <span className={`min-w-0 flex-1 truncate text-[12.5px] ${message.error ? "text-bad" : message.ok ? "text-ok" : "text-muted"}`}>
          {locked ? (
            <span className="inline-flex items-center gap-1.5"><Icon name="lock" size={13} /> On. Pause it to make changes.</span>
          ) : pending ? "Saving…" : (message.error ?? message.ok ?? (dirty ? "Saving automatically…" : trigger.type === "none" ? "Choose a trigger to start" : issues ? `${issues} step${issues === 1 ? "" : "s"} still to finish` : "Changes save automatically"))}
        </span>
        <div className="flex items-center gap-0.5 rounded-xl bg-surface p-0.5">
          <button type="button" onClick={() => setZoom(zoom - 0.1)} disabled={zoom <= 0.25} aria-label="Zoom out" className={zbtn}>−</button>
          <button type="button" onClick={() => { setZoom(1); centre(1); }} title="Back to 100%" className={`${zbtn} w-12 tabular-nums`}>{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => setZoom(zoom + 0.1)} disabled={zoom >= 1.5} aria-label="Zoom in" className={zbtn}>+</button>
          <button type="button" onClick={fit} className={`${zbtn} gap-1.5`} title="Fit the whole workflow on screen"><Icon name="panel" size={14} /> Fit</button>
        </div>
        <button type="button" onClick={() => setSel({ t: "settings" })} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
          <Icon name="settings" size={14} /> Settings
        </button>
        {!disabled && dirty && (
          <button type="button" onClick={cancel} disabled={pending} className="btn-ghost inline-flex min-h-9 items-center rounded-xl px-3 text-[13px] font-semibold">Cancel</button>
        )}
        {!disabled && (
          <button type="button" onClick={() => save()} disabled={pending} className="btn-primary inline-flex min-h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-70">
            <Icon name="check" size={14} /> Save
          </button>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={viewport}
        onPointerDown={onPanStart}
        onPointerMove={onPanMove}
        onPointerUp={onPanEnd}
        onPointerCancel={onPanEnd}
        className="relative h-[calc(100vh-166px-var(--chrome-h,64px))] min-h-[520px] cursor-grab touch-none overflow-hidden rounded-2xl border border-line active:cursor-grabbing"
        style={{ backgroundColor: "#f6f8fc", backgroundImage: "radial-gradient(#d5dbe6 1.2px, transparent 1.2px)", backgroundSize: `${22 * zoom}px ${22 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
      >
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }} className="absolute left-0 top-0">
          <div ref={content} className="inline-flex flex-col items-center px-16 pb-24 pt-2">
            <button
              type="button"
              data-node
              onClick={() => setSel({ t: "trigger" })}
              className={`w-[300px] rounded-2xl border-2 border-dashed bg-white p-3 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 ${sel?.t === "trigger" ? "border-brand" : trigger.type === "none" ? "border-warn/60" : "border-sky/60"}`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`h-9 w-9 rounded-xl ${trigger.type === "none" ? "inline-flex items-center justify-center bg-warn-bg text-warn" : "tile"}`}>
                  <Icon name={trigger.type === "none" ? "plus" : (triggerDef(trigger.type)?.icon ?? "play")} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-brand">Trigger</div>
                  <div className="truncate text-[13.5px] font-semibold">{trigger.type === "none" ? "Add a trigger" : triggerLabel(trigger, stages, pipelines, forms)}</div>
                </div>
              </div>
            </button>
            {list("root", nodes, true)}
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11.5px] text-muted ring-1 ring-line max-sm:hidden">
          Drag the background to move around. Ctrl + scroll to zoom. Drag a card onto a + to move it.
        </div>
      </div>

      {renderPanel()}
    </div>
  );
}

function AddPanel({ onPick, onClose }: { onPick: (t: StepType) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const found = kinds.filter((k) => !q.trim() || k.label.toLowerCase().includes(q.trim().toLowerCase()) || k.group.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <FloatingPanel title="Add a step" subtitle="Choose what happens next" icon={<Icon name="plus" size={15} />} onClose={onClose}>
      <div className="relative mb-3">
        <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actions" className="field h-10 w-full pl-9" aria-label="Search actions" />
      </div>
      {groups.map((g) => {
        const list = found.filter((k) => k.group === g);
        if (!list.length) return null;
        return (
          <div key={g} className="mb-3 last:mb-0">
            <div className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{g}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {list.map((k) => (
                <button key={k.type} type="button" onClick={() => onPick(k.type)} className="flex items-center gap-2.5 rounded-xl border border-line p-2 text-left text-[13px] font-medium transition-colors hover:border-sky hover:bg-surface">
                  <span className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gradient-to-br text-white ${k.tone}`}>
                    <Icon name={k.icon} size={15} />
                  </span>
                  {k.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {!found.length && <p className="py-6 text-center text-[13px] text-muted">Nothing matches “{q}”.</p>}
    </FloatingPanel>
  );
}
