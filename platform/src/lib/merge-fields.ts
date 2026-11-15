import type { CustomField, CustomValue } from "@/lib/data";

export type MergeField = { token: string; label: string; group: string };

/** Every merge field a message can use, for the "Insert field" menu. */
export function mergeFields(fields: CustomField[] = [], values: CustomValue[] = []): MergeField[] {
  return [
    { token: "{{first_name}}", label: "First name", group: "Contact" },
    { token: "{{last_name}}", label: "Last name", group: "Contact" },
    { token: "{{name}}", label: "Full name", group: "Contact" },
    { token: "{{email}}", label: "Email", group: "Contact" },
    { token: "{{phone}}", label: "Phone", group: "Contact" },
    { token: "{{source}}", label: "Source", group: "Contact" },
    ...fields.map((f) => ({ token: `{{contact.${f.key}}}`, label: f.label, group: "Custom fields" })),
    { token: "{{owner_name}}", label: "Owner's full name", group: "Owner" },
    { token: "{{owner_first_name}}", label: "Owner's first name", group: "Owner" },
    { token: "{{owner_email}}", label: "Owner's email", group: "Owner" },
    { token: "{{owner_phone}}", label: "Owner's phone", group: "Owner" },
    { token: "{{workspace}}", label: "Business name", group: "Business" },
    ...values.map((v) => ({ token: `{{custom_values.${v.key}}}`, label: v.key.replace(/_/g, " "), group: "Custom values" })),
  ];
}
