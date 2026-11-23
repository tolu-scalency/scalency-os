// A time picker as a dropdown: every quarter of an hour, shown as "8:00 am".
// Easier than typing a time, and it looks the same in every browser.

export const QUARTERS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const shown = h === 0 && m === 0 ? "12:00 am (midnight)" : h === 12 && m === 0 ? "12:00 pm (midday)" : `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
  return { value, shown };
});

type Props = { className?: string; disabled?: boolean; "aria-label"?: string } & (
  | { value: string; onChange: (v: string) => void; name?: string; defaultValue?: never }
  | { name: string; defaultValue: string; value?: never; onChange?: never }
);

export function TimeSelect(props: Props) {
  const current = props.value ?? props.defaultValue ?? "";
  const known = QUARTERS.some((q) => q.value === current);
  return (
    <select
      name={props.name}
      {...(props.onChange ? { value: props.value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => props.onChange!(e.target.value) } : { defaultValue: props.defaultValue })}
      disabled={props.disabled}
      aria-label={props["aria-label"]}
      className={props.className ?? "field"}
    >
      {!known && current && <option value={current}>{current}</option>}
      {QUARTERS.map((q) => (
        <option key={q.value} value={q.value}>
          {q.shown}
        </option>
      ))}
    </select>
  );
}
