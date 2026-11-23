"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { shortId } from "@/lib/short-id-shared";

/** Shows an ID (workspace, pipeline, stage, contact, field, workflow) with a copy button, for use in integrations and support.
 *  Long IDs show as their first 8 characters; the copy button always copies the whole ID. */
export function CopyId({ label, id, className = "" }: { label: string; id: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-surface py-1 pl-2.5 pr-1 text-[12px] text-muted ${className}`}>
      <span className="flex-none font-medium">{label}</span>
      <code className="min-w-0 truncate font-mono text-[11.5px] text-navy" title={id}>
        {shortId(id)}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(id);
          } catch {
            window.prompt(`Copy the ${label}:`, id);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        aria-label={`Copy ${label}`}
        title={`Copy the full ${label}`}
        className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-md text-muted transition-colors hover:bg-white hover:text-brand"
      >
        <Icon name={copied ? "check" : "copy"} size={13} />
      </button>
    </span>
  );
}
