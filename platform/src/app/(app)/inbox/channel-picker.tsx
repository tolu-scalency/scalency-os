"use client";

import { useState } from "react";

/** Email or text, with the matching fields. */
export function ChannelPicker() {
  const [channel, setChannel] = useState<"email" | "sms">("email");
  return (
    <>
      <div className="flex gap-1 rounded-xl bg-[#eaeff6] p-1 text-[13px] font-medium sm:w-fit">
        {(["email", "sms"] as const).map((c) => (
          <label key={c} className={`flex-1 cursor-pointer rounded-lg px-4 py-1.5 text-center ${channel === c ? "bg-white text-navy shadow-sm" : "text-muted"}`}>
            <input type="radio" name="channel" value={c} checked={channel === c} onChange={() => setChannel(c)} className="sr-only" />
            {c === "email" ? "Email" : "Text"}
          </label>
        ))}
      </div>
      {channel === "email" && <input name="subject" placeholder="Subject" className="field" />}
      <textarea name="body" rows={3} required maxLength={channel === "sms" ? 640 : 5000} placeholder={channel === "email" ? "Write an email…" : "Write a text…"} className="field resize-y py-2.5" />
    </>
  );
}
