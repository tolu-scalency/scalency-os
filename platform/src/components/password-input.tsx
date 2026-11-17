"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

/** A password box with an eye button to show or hide what was typed. */
export function PasswordInput({ className = "", ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input {...props} type={show ? "text" : "password"} className={`${className} w-full pr-12`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        title={show ? "Hide password" : "Show password"}
        className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-navy"
      >
        <Icon name={show ? "eyeOff" : "eye"} size={17} />
      </button>
    </span>
  );
}
