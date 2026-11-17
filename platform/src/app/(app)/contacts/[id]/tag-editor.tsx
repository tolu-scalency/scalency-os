"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { addTag, removeTag } from "./actions";

type Tag = { id: string; name: string };

/** Tags on a contact. Changes show instantly and save in the background. */
export function TagEditor({ contactId, tags, allTags }: { contactId: string; tags: Tag[]; allTags: string[] }) {
  const [shown, change] = useOptimistic(tags, (current: Tag[], op: { add?: string; remove?: string }) => {
    if (op.add && !current.some((t) => t.name.toLowerCase() === op.add!.toLowerCase())) return [...current, { id: `new-${op.add}`, name: op.add }];
    if (op.remove) return current.filter((t) => t.id !== op.remove);
    return current;
  });
  const [, start] = useTransition();
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function add(name: string) {
    const tag = name.trim().slice(0, 40);
    if (!tag) return;
    setError("");
    if (input.current) input.current.value = "";
    start(async () => {
      change({ add: tag });
      const fd = new FormData();
      fd.set("contact_id", contactId);
      fd.set("tag", tag);
      const res = await addTag({}, fd);
      if (res.error) setError(res.error);
    });
  }

  function remove(tag: Tag) {
    if (tag.id.startsWith("new-")) return;
    setError("");
    start(async () => {
      change({ remove: tag.id });
      const fd = new FormData();
      fd.set("contact_id", contactId);
      fd.set("tag_id", tag.id);
      const res = await removeTag({}, fd);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div>
      {shown.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {shown.map((t) => (
            <li key={t.id} className="inline-flex items-center gap-1 rounded-full bg-chip py-1 pl-3 pr-1 text-[12.5px] font-medium text-brand">
              {t.name}
              <button type="button" onClick={() => remove(t)} aria-label={`Remove ${t.name}`} title="Remove" className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-white">
                <Icon name="x" size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(input.current?.value ?? "");
        }}
        className="flex flex-wrap gap-2"
      >
        <input ref={input} name="tag" list="contact-tags" required maxLength={40} placeholder="Add a tag…" aria-label="Tag" className="field min-w-0 flex-1" />
        <datalist id="contact-tags">
          {allTags.filter((t) => !shown.some((x) => x.name === t)).map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button type="submit" className="btn-primary inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold">
          <Icon name="plus" size={14} /> Add
        </button>
      </form>
      {error && <p role="alert" className="mt-2 rounded-xl border border-bad/20 bg-bad-bg px-3 py-2 text-[13px] text-bad">{error}</p>}
    </div>
  );
}
