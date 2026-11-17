import { inputValue } from "@/lib/field-types";

type Field = { key: string; label: string; type: string; options: string[] };

/** The right form control for a custom field. Values arrive in the form as cf_<key>. */
export function FieldInput({ field, value, disabled }: { field: Field; value: unknown; disabled?: boolean }) {
  const name = `cf_${field.key}`;
  const current = inputValue(field.type, value);
  const common = { name, disabled, "aria-label": field.label } as const;

  switch (field.type) {
    case "long_text":
      return <textarea {...common} defaultValue={current} rows={3} maxLength={5000} className="field resize-y" />;
    case "number":
      return <input {...common} type="number" inputMode="decimal" step="any" defaultValue={current} className="field" />;
    case "money":
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted">£</span>
          <input {...common} type="number" inputMode="decimal" step="0.01" min="0" defaultValue={current} className="field pl-7" />
        </div>
      );
    case "date":
      return <input {...common} type="date" defaultValue={current} className="field" />;
    case "yes_no":
      return (
        <select {...common} defaultValue={current} className="field">
          <option value="">Not set</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      );
    case "select":
      return (
        <select {...common} defaultValue={current} className="field">
          <option value="">Not set</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          {current && !field.options.includes(current) && <option value={current}>{current}</option>}
        </select>
      );
    case "multi_select": {
      const picked = new Set(Array.isArray(value) ? (value as string[]) : current ? current.split(",").map((s) => s.trim()) : []);
      const all = [...field.options, ...[...picked].filter((p) => !field.options.includes(p))];
      if (!all.length) return <p className="text-[12.5px] text-muted">No options yet. Add them in Settings, Custom fields.</p>;
      return (
        <div className="flex flex-wrap gap-2" role="group" aria-label={field.label}>
          <input type="hidden" name={`${name}__multi`} value="1" />
          {all.map((o) => (
            <label key={o} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] has-[:checked]:border-brand has-[:checked]:bg-chip has-[:checked]:text-brand">
              <input type="checkbox" name={name} value={o} defaultChecked={picked.has(o)} disabled={disabled} className="h-3.5 w-3.5" />
              {o}
            </label>
          ))}
        </div>
      );
    }
    case "url":
      return <input {...common} type="url" inputMode="url" placeholder="https://" defaultValue={current} className="field" />;
    case "email":
      return <input {...common} type="email" inputMode="email" defaultValue={current} className="field" />;
    case "phone":
      return <input {...common} type="tel" inputMode="tel" defaultValue={current} className="field" />;
    default:
      return <input {...common} defaultValue={current} maxLength={500} className="field" />;
  }
}
