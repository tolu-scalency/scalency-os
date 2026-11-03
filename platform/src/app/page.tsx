import Image from "next/image";

// The parts of the platform from docs/plans/automation-engine.md, in build order.
const modules = [
  {
    name: "Applications",
    description: "Lead-gen application forms: capture step 1 straight away, then qualify or route to the unqualified page.",
    status: "Building first",
  },
  {
    name: "Contacts",
    description: "Every lead and customer, with their answers, tags and history.",
    status: "Next",
  },
  {
    name: "Pipelines",
    description: "Where every lead is, from application to closed.",
    status: "Next",
  },
  {
    name: "Workflows",
    description: "Automations that send emails and texts, move leads and alert the team.",
    status: "Next",
  },
];

export default function Home() {
  return (
    <>
      <header className="bg-white border-b border-line before:block before:h-1 before:bg-[image:var(--gradient)]">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between px-4">
          <Image src="/scalency-logo.png" alt="Scalency" width={132} height={48} priority className="-ml-1.5 h-12 w-auto" />
          <span className="text-sm font-semibold text-muted">OS</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 py-14">
        <span className="mb-4 block text-xs font-bold uppercase tracking-[0.12em] text-brand">Scalency OS</span>
        <h1 className="text-4xl font-extrabold leading-tight tracking-[-0.02em] sm:text-5xl">
          Your automations, <span className="text-brand">in your own hands.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          The engine that will replace GoHighLevel and Zapier, one workflow at a time.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {modules.map((m) => (
            <li key={m.name} className="rounded-[14px] border border-line bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{m.name}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${m.status === "Building first" ? "bg-brand text-white" : "bg-tint text-muted"}`}>
                  {m.status}
                </span>
              </div>
              <p className="mt-2 text-[15px] text-muted">{m.description}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="border-t border-line bg-white py-8 text-sm text-muted">
        <div className="mx-auto flex max-w-[1080px] flex-wrap justify-between gap-3 px-4">
          <span className="font-semibold text-navy">Helping businesses scale with efficiency.</span>
          <span>© 2026 Scalency</span>
        </div>
      </footer>
    </>
  );
}
