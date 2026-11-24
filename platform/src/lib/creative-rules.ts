// UK advertising rules for aesthetics, checked as you type in the Creative studio.
// The same rules run in the ai-setter function when the AI writes copy.

export type CreativeIssue = { level: "block" | "warn"; rule: string; match: string };

const POM = /\b(botox|botulinum|dysport|xeomin|bocouture|azzalure|letybo|relfydess|alluzience|vistabel|nuceiva|daxxify|jeuveau|toxins?|neuro ?toxins?|anti[- ]?wrinkle injections?)\b/gi;

const RULES: { level: "block" | "warn"; re: RegExp; rule: string }[] = [
  { level: "block", re: POM, rule: "Names a prescription-only medicine. Advertising these to the public is illegal in the UK (Human Medicines Regulations 2012, CAP Code 12.12)." },
  { level: "block", re: /\b(teen(ager)?s?|under[- ]?18s?|school|sixth form|prom|year (9|10|11|12|13))\b/gi, rule: "Cosmetic interventions must not be aimed at under-18s (CAP Code 16.6)." },
  { level: "warn", re: /\b(guaranteed?|100%|permanent(ly)?|pain[- ]?free|no side[- ]effects|risk[- ]free|completely safe|safe for everyone|instant results)\b/gi, rule: "Absolute or misleading claim. Results and risks vary (CAP Code 3.1, 12.1)." },
  { level: "warn", re: /\b(today only|last chance|hurry|ends tonight|only \d+ (left|spaces|slots)|book now before|limited time)\b/gi, rule: "Time pressure on a medical treatment discourages an informed choice (CAP Code 12, JCCP guidance)." },
  { level: "warn", re: /\b(flaws?|ugly|look old|embarrass(ed|ing)?|insecure|hate your|fix your face)\b/gi, rule: "Plays on insecurities about appearance (ASA social responsibility)." },
  { level: "warn", re: /\bbefore (and|&) after\b/gi, rule: "Before-and-after images must be real, unedited, typical and consented (CAP Code 3.1, 3.7)." },
  { level: "warn", re: /\b(doctor|nurse|surgeon) (approved|recommended)\b/gi, rule: "Endorsements by health professionals need care (CAP Code 12.2)." },
];

export function checkCreative(text: string): { status: "ok" | "warn" | "block"; issues: CreativeIssue[] } {
  const issues: CreativeIssue[] = [];
  for (const r of RULES) {
    const found = [...new Set((text.match(new RegExp(r.re.source, "gi")) ?? []).map((m) => m.toLowerCase()))];
    for (const m of found) issues.push({ level: r.level, rule: r.rule, match: m });
  }
  return { status: issues.some((i) => i.level === "block") ? "block" : issues.length ? "warn" : "ok", issues };
}
