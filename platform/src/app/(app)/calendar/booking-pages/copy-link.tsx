"use client";

import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";

export function CopyLink({ link, label = "Copy link" }: { link: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(link).then(
          () => notify("Copied"),
          () => notify("Couldn't copy. Select the link and copy it instead.", "bad"),
        );
      }}
      className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold"
    >
      <Icon name="copy" size={14} /> {label}
    </button>
  );
}
