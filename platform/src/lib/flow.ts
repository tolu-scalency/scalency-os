// Workflow layout as the builder sees it: a tree, where an If / else has its own
// branches, each with its own steps. The engine runs a flat list, so the tree is
// compiled before saving (branch steps jump to the right place, "goto" steps skip
// the branches that weren't taken). Shared by the builder and the server.

import type { Condition, WorkflowStep } from "./data";

export type Route = { id: string; name: string; match: "all" | "any"; conditions: Condition[]; steps: FlowNode[] };
export type BranchNode = { id: string; type: "branch"; label?: string; branches: Route[]; otherwise: { name: string; steps: FlowNode[] } };
export type ActionNode = Exclude<WorkflowStep, { type: "if_else" } | { type: "branch" } | { type: "goto" }> & { id: string; label?: string };
export type FlowNode = ActionNode | BranchNode;

export const newId = () => Math.random().toString(36).slice(2, 10);

export const MAX_BRANCHES = 10;
export const MAX_NODES = 120;

/** Turns an older top-to-bottom list (with "if / else, otherwise skip to") into a tree. */
export function toTree(steps: WorkflowStep[]): FlowNode[] {
  const list = steps.map((s) => ({ ...s, id: s.id || newId() })) as (WorkflowStep & { id: string })[];
  function build(from: number, to: number): FlowNode[] {
    const out: FlowNode[] = [];
    let i = from;
    while (i < to) {
      const s = list[i];
      if (s.type === "if_else") {
        // Yes: carry on. No: jump to a later step, or end.
        const target = s.else === "end" ? -1 : list.findIndex((x, j) => j > i && x.id === s.else);
        const joinAt = target > i && target <= to ? target : to;
        const yes = build(i + 1, joinAt);
        const node: BranchNode = {
          id: s.id,
          type: "branch",
          branches: [{ id: newId(), name: "Yes", match: "all", conditions: [s.condition], steps: yes }],
          otherwise: { name: "No", steps: s.else === "end" || target < 0 ? [{ id: newId(), type: "end" }] : [] },
        };
        out.push(node);
        i = joinAt;
        continue;
      }
      if (s.type === "branch" || s.type === "goto") {
        // Compiled steps never reach here when a saved layout exists; skip them safely.
        i++;
        continue;
      }
      out.push(s as ActionNode);
      i++;
    }
    return out;
  }
  return build(0, list.length);
}

/** Counts every step in the tree, branches included. */
export function countNodes(nodes: FlowNode[]): number {
  return nodes.reduce((n, x) => n + 1 + (x.type === "branch" ? x.branches.reduce((m, r) => m + countNodes(r.steps), 0) + countNodes(x.otherwise.steps) : 0), 0);
}

/** Flat list for the engine. Branch steps hold where each branch starts; gotos jump past the other branches. */
export function compile(nodes: FlowNode[]): WorkflowStep[] {
  type Pending = { step: Record<string, unknown>; refs: { key: string; at: number; route?: number }[] };
  const out: Pending[] = [];
  function emit(list: FlowNode[]) {
    for (const n of list) {
      if (n.type !== "branch") {
        out.push({ step: { ...n }, refs: [] });
        continue;
      }
      const head: Pending = {
        step: { id: n.id, type: "branch", label: n.label, routes: n.branches.map((r) => ({ name: r.name, match: r.match, conditions: r.conditions, goto: "" })), otherwise_name: n.otherwise.name, otherwise_goto: "" },
        refs: [],
      };
      out.push(head);
      const jumps: Pending[] = [];
      const starts: number[] = [];
      n.branches.forEach((r) => {
        const start = out.length;
        emit(r.steps);
        if (out.length > start) {
          starts.push(start);
          const last = out[out.length - 1].step;
          if (last.type !== "end") {
            const g: Pending = { step: { id: newId(), type: "goto", target: "" }, refs: [] };
            out.push(g);
            jumps.push(g);
          }
        } else starts.push(-1);
      });
      const elseStart = out.length;
      emit(n.otherwise.steps);
      const join = out.length; // whatever comes next, or the end
      starts.forEach((s, i) => head.refs.push({ key: "route", at: s < 0 ? join : s, route: i }));
      head.refs.push({ key: "otherwise_goto", at: out.length > elseStart ? elseStart : join });
      for (const g of jumps) g.refs.push({ key: "target", at: join });
    }
  }
  emit(nodes);
  const idAt = (i: number) => (i < out.length ? String(out[i].step.id) : "end");
  return out.map(({ step, refs }) => {
    const s = { ...step };
    for (const r of refs) {
      if (r.key === "route") {
        const routes = (s.routes as { goto: string }[]).map((x, i) => (i === r.route ? { ...x, goto: idAt(r.at) } : x));
        s.routes = routes;
      } else s[r.key] = idAt(r.at);
    }
    if (!s.label) delete s.label;
    return s as WorkflowStep;
  });
}

// ---------------------------------------------------------------------------
// Tree edits. A list is named "root", "<branchId>/<routeId>" or "<branchId>/else".
// ---------------------------------------------------------------------------

export function mapLists(nodes: FlowNode[], key: string, fn: (list: FlowNode[], key: string) => FlowNode[], here = "root"): FlowNode[] {
  const mine = here === key || key === "*" ? fn(nodes, here) : nodes;
  return mine.map((n) =>
    n.type === "branch"
      ? {
          ...n,
          branches: n.branches.map((r) => ({ ...r, steps: mapLists(r.steps, key, fn, `${n.id}/${r.id}`) })),
          otherwise: { ...n.otherwise, steps: mapLists(n.otherwise.steps, key, fn, `${n.id}/else`) },
        }
      : n,
  );
}

export function findNode(nodes: FlowNode[], id: string): FlowNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.type === "branch") {
      for (const r of n.branches) {
        const f = findNode(r.steps, id);
        if (f) return f;
      }
      const f = findNode(n.otherwise.steps, id);
      if (f) return f;
    }
  }
  return null;
}

/** Where a step sits: its list and position. */
export function locate(nodes: FlowNode[], id: string, here = "root"): { list: string; index: number } | null {
  for (const [i, n] of nodes.entries()) {
    if (n.id === id) return { list: here, index: i };
    if (n.type === "branch") {
      for (const r of n.branches) {
        const f = locate(r.steps, id, `${n.id}/${r.id}`);
        if (f) return f;
      }
      const f = locate(n.otherwise.steps, id, `${n.id}/else`);
      if (f) return f;
    }
  }
  return null;
}

export function updateNode(nodes: FlowNode[], id: string, fn: (n: FlowNode) => FlowNode): FlowNode[] {
  return mapLists(nodes, "*", (list) => list.map((n) => (n.id === id ? fn(n) : n)));
}

export function removeNode(nodes: FlowNode[], id: string): FlowNode[] {
  return mapLists(nodes, "*", (list) => list.filter((n) => n.id !== id));
}

export function insertNode(nodes: FlowNode[], list: string, index: number, node: FlowNode): FlowNode[] {
  return mapLists(nodes, list, (l) => [...l.slice(0, index), node, ...l.slice(index)]);
}

/** Moves a step. Refuses to drop an If / else inside itself. */
export function moveNode(nodes: FlowNode[], id: string, list: string, index: number): FlowNode[] {
  const node = findNode(nodes, id);
  const from = locate(nodes, id);
  if (!node || !from) return nodes;
  if (node.type === "branch" && list !== "root" && findNode([node], list.split("/")[0])) return nodes;
  let at = index;
  if (from.list === list && from.index < index) at -= 1;
  if (from.list === list && from.index === at) return nodes;
  return insertNode(removeNode(nodes, id), list, at, node);
}

/** A copy with fresh ids, for "Duplicate". */
export function cloneNode(n: FlowNode): FlowNode {
  if (n.type !== "branch") return { ...structuredClone(n), id: newId() };
  return {
    ...structuredClone(n),
    id: newId(),
    branches: n.branches.map((r) => ({ ...structuredClone(r), id: newId(), steps: r.steps.map(cloneNode) })),
    otherwise: { ...n.otherwise, steps: n.otherwise.steps.map(cloneNode) },
  };
}
