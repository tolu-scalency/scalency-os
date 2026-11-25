import type { CustomField, CustomValue } from "@/lib/data";

export type MergeField = { token: string; label: string; group: string; hint?: string };

/** Every merge field a message can use, for the "Insert field" menu. */
export function mergeFields(fields: CustomField[] = [], values: CustomValue[] = []): MergeField[] {
  return [
    { token: "{{first_name}}", label: "First name", group: "Contact", hint: "\"there\" if blank" },
    { token: "{{last_name}}", label: "Last name", group: "Contact" },
    { token: "{{name}}", label: "Full name", group: "Contact" },
    { token: "{{email}}", label: "Email", group: "Contact" },
    { token: "{{phone}}", label: "Phone", group: "Contact" },
    { token: "{{source}}", label: "Source", group: "Contact" },
    { token: "{{tags}}", label: "Tags", group: "Contact", hint: "All their tags" },
    { token: "{{added_date}}", label: "Date added", group: "Contact" },
    ...fields.map((f) => ({ token: `{{contact.${f.key}}}`, label: f.label, group: "Custom fields" })),
    { token: "{{deal_name}}", label: "Deal name", group: "Deal", hint: "Their latest deal" },
    { token: "{{deal_value}}", label: "Deal value", group: "Deal" },
    { token: "{{deal_stage}}", label: "Stage", group: "Deal" },
    { token: "{{deal_status}}", label: "Status", group: "Deal" },
    { token: "{{pipeline}}", label: "Pipeline", group: "Deal" },
    { token: "{{appointment_date}}", label: "Date", group: "Appointment", hint: "Their next booking, e.g. Thursday 3 December" },
    { token: "{{appointment_time}}", label: "Time", group: "Appointment", hint: "In their time zone, e.g. 2:30pm" },
    { token: "{{appointment_timezone}}", label: "Time zone", group: "Appointment" },
    { token: "{{appointment_with}}", label: "Who it's with", group: "Appointment" },
    { token: "{{appointment_title}}", label: "Title", group: "Appointment" },
    { token: "{{appointment_location}}", label: "Location", group: "Appointment" },
    { token: "{{meeting_link}}", label: "Meeting link", group: "Appointment", hint: "Google Meet, Teams or your own link" },
    { token: "{{manage_link}}", label: "Reschedule or cancel link", group: "Appointment" },
    { token: "{{owner_name}}", label: "Full name", group: "Assigned user" },
    { token: "{{owner_first_name}}", label: "First name", group: "Assigned user" },
    { token: "{{owner_email}}", label: "Email", group: "Assigned user" },
    { token: "{{owner_phone}}", label: "Phone", group: "Assigned user" },
    { token: "{{workspace}}", label: "Business name", group: "Business" },
    ...values.map((v) => ({ token: `{{custom_values.${v.key}}}`, label: v.key.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase()), group: "Custom values" })),
    { token: "{{today}}", label: "Today's date", group: "Date", hint: "e.g. 20 Nov 2026" },
    { token: "{{weekday}}", label: "Day of the week", group: "Date" },
    { token: "{{year}}", label: "Year", group: "Date" },
  ];
}
