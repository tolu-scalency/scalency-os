"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Icon, type IconName } from "./icon";

export type ActionResult = { error?: string; ok?: string };
type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

/** A form that runs a server action and shows its result underneath, without reloading the page. */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnOk = false,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnOk?: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnOk && state.ok) ref.current?.reset();
  }, [state, resetOnOk]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state.error && (
        <p role="alert" className="rise basis-full rounded-xl border border-bad/20 bg-bad-bg px-3 py-2 text-[13px] text-bad">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rise basis-full text-[13px] font-medium text-ok">
          {state.ok}
        </p>
      )}
    </form>
  );
}

/** A submit button that shows it's working while the action runs. */
export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
  icon,
  className = "",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "ghost" | "danger" | "plain";
  icon?: IconName;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const look = {
    primary: "btn-primary",
    ghost: "btn-ghost",
    danger: "border border-bad/25 bg-white text-bad hover:bg-bad-bg",
    plain: "text-muted hover:text-navy",
  }[variant];
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-[13.5px] font-semibold transition disabled:cursor-wait disabled:opacity-70 ${look} ${className}`}
    >
      {icon && <Icon name={icon} size={15} />}
      {pending ? pendingText : children}
    </button>
  );
}

/** A small icon-only submit button, e.g. a tick or a bin. */
export function IconSubmit({ icon, label, className = "" }: { icon: IconName; label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-label={label} title={label} disabled={pending} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-50 ${className}`}>
      <Icon name={icon} size={16} />
    </button>
  );
}

/** A delete button that asks first. */
export function ConfirmSubmit({ children, message, className = "" }: { children: React.ReactNode; message: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-bad/25 bg-white px-4 text-[13.5px] font-semibold text-bad transition hover:bg-bad-bg disabled:opacity-60 ${className}`}
    >
      {pending ? "Deleting…" : children}
    </button>
  );
}
