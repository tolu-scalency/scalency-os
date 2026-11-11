import type { Metadata } from "next";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/action-form";
import { getWorkspace, listCustomFields, listCustomValues } from "@/lib/data";
import { addCustomField, deleteCustomField, deleteCustomValue, saveCustomValue } from "../actions";

export const metadata: Metadata = { title: "Custom fields" };

export default async function FieldsPage() {
  const ws = await getWorkspace();
  const [fields, values] = await Promise.all([listCustomFields(ws.account.id), listCustomValues(ws.account.id)]);
  const manager = ws.account.role === "owner" || ws.account.role === "admin";

  return (
    <div className="flex flex-col gap-4">
      <section className="card grid gap-5 p-5 sm:p-6 md:grid-cols-[260px_1fr]">
        <div>
          <h2 className="text-[16px] font-semibold">Custom fields</h2>
          <p className="mt-1 text-[13.5px] text-muted">Extra details you keep on every contact, like budget or company size. Fill them in on the contact page, or with an “Update a field” workflow step.</p>
        </div>
        <div className="flex flex-col gap-3">
          {fields.length === 0 ? (
            <p className="rounded-xl bg-surface p-4 text-[13.5px] text-muted">No custom fields yet.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {fields.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-[14px] font-medium">{f.label}</span>
                  <code className="rounded bg-surface px-2 py-0.5 text-[12px] text-muted">{`{{contact.${f.key}}}`}</code>
                  {manager && (
                    <ActionForm action={deleteCustomField}>
                      <input type="hidden" name="id" value={f.id} />
                      <ConfirmSubmit message={`Delete the field “${f.label}”? Values already saved on contacts stay, but you won't see them.`} className="min-h-8 px-3 text-[12.5px]">Delete</ConfirmSubmit>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}
          {manager && (
            <ActionForm action={addCustomField} resetOnOk className="flex flex-wrap gap-2">
              <input name="label" required maxLength={60} placeholder="New field, e.g. Budget" aria-label="Field name" className="field min-w-0 flex-1" />
              <SubmitButton icon="plus" pendingText="Adding…">Add field</SubmitButton>
            </ActionForm>
          )}
        </div>
      </section>

      <section className="card grid gap-5 p-5 sm:p-6 md:grid-cols-[260px_1fr]">
        <div>
          <h2 className="text-[16px] font-semibold">Custom values</h2>
          <p className="mt-1 text-[13.5px] text-muted">Things you use in lots of messages, like your booking link or address. Change it here once and every message updates.</p>
        </div>
        <div className="flex flex-col gap-3">
          {values.length > 0 && (
            <ul className="flex flex-col gap-2">
              {values.map((v) => (
                <li key={v.key} className="rounded-xl border border-line p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <code className="rounded bg-surface px-2 py-0.5 text-[12px] text-muted">{`{{custom_values.${v.key}}}`}</code>
                    {manager && (
                      <ActionForm action={deleteCustomValue}>
                        <input type="hidden" name="key" value={v.key} />
                        <ConfirmSubmit message="Delete this value? Messages that use it will show a blank." className="min-h-8 px-3 text-[12.5px]">Delete</ConfirmSubmit>
                      </ActionForm>
                    )}
                  </div>
                  <ActionForm action={saveCustomValue} className="flex flex-wrap gap-2">
                    <input type="hidden" name="key" value={v.key} />
                    <input name="value" required defaultValue={v.value} disabled={!manager} aria-label={`Value for ${v.key}`} className="field min-w-0 flex-1" />
                    {manager && <SubmitButton variant="ghost">Save</SubmitButton>}
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
          {manager && (
            <ActionForm action={saveCustomValue} resetOnOk className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
              <input name="name" required maxLength={60} placeholder="Name, e.g. Booking link" aria-label="Value name" className="field" />
              <input name="value" required maxLength={1000} placeholder="https://cal.com/you" aria-label="Value" className="field" />
              <SubmitButton icon="plus" pendingText="Adding…">Add</SubmitButton>
            </ActionForm>
          )}
        </div>
      </section>
    </div>
  );
}
