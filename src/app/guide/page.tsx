import Link from "next/link";

const workflow = [
  {
    title: "1. Create Or Select A Case",
    detail:
      "Use the Case Context panel at the top of dashboard pages. All feature outputs attach to this active case.",
  },
  {
    title: "2. Profile Address",
    detail:
      "Start with wallet/entity profiling to collect labels, transaction context, and initial intelligence before deeper tracing.",
  },
  {
    title: "3. Trace Funds",
    detail:
      "Run inbound/outbound traces, review top hops, and inspect token risk scoring to prioritize suspicious routes.",
  },
  {
    title: "4. Cluster Entities",
    detail:
      "Group related addresses using heuristics (shared funders, counterparties, behavior) and verify linked clusters.",
  },
  {
    title: "5. Build Timeline",
    detail:
      "Assemble all saved evidence events into a chronological timeline with extracted entities and risk indicators.",
  },
  {
    title: "6. Generate Report",
    detail:
      "Export markdown narrative and graph evidence for case handoff, internal review, or formal reporting.",
  },
];

const featureBreakdown = [
  {
    feature: "Profile Address",
    purpose: "Build a high-signal dossier for a target wallet or entity.",
    outputs: "Entity labels, counterparties, metadata, and saved evidence nodes.",
  },
  {
    feature: "Trace Funds",
    purpose: "Investigate movement paths across hops and directions.",
    outputs: "Trace edges, hop table, async job status, fallback intelligence, token risk flags.",
  },
  {
    feature: "Cluster Entities",
    purpose: "Identify likely ownership or operational linkage patterns.",
    outputs: "Cluster groups, cluster metrics, linked addresses, heuristic-attributed evidence.",
  },
  {
    feature: "Build Timeline",
    purpose: "Transform discrete findings into a complete case narrative timeline.",
    outputs: "Chronological events, risk flags, feature usage summary, markdown export.",
  },
  {
    feature: "Evidence Graph",
    purpose: "Visualize relationships between entities, flows, and case events.",
    outputs: "Node-edge evidence map, graph stats, latest evidence references.",
  },
  {
    feature: "Generate Report",
    purpose: "Create a final case deliverable from accumulated evidence.",
    outputs: "Report markdown, mermaid graph diagram, executive-ready summary.",
  },
];

export default function GuidePage() {
  return (
    <main className="min-h-screen w-full px-4 py-8 sm:px-8 sm:py-10">
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[0_12px_28px_rgba(0,0,0,0.08)] sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Aubox User Guide</p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--ink)] sm:text-5xl">Complete Investigation Playbook</h1>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-[var(--muted)] sm:text-base">
          This guide explains every major Aubox workflow from case setup to final report export. Use it as onboarding,
          operational SOP, and daily reference while conducting manual onchain investigations.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl border border-[var(--accent-strong)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
          >
            Open Dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:border-[var(--accent)]"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:border-[var(--accent)]"
          >
            Create Account
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-bold">End-To-End Workflow</h2>
        <div className="mt-4 grid gap-3">
          {workflow.map((step) => (
            <div key={step.title} className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
              <p className="text-base font-semibold text-[var(--ink)]">{step.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{step.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-bold">Feature Breakdown</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[var(--paper)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Expected Outputs</th>
              </tr>
            </thead>
            <tbody>
              {featureBreakdown.map((row) => (
                <tr key={row.feature} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 font-semibold text-[var(--ink)]">{row.feature}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.purpose}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.outputs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-[var(--line)] bg-white p-6">
          <h2 className="text-xl font-bold">Case Management Rules</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            <li>Always verify the active case in the Case Context panel before running any feature.</li>
            <li>If you switch cases, refresh feature pages to confirm updated evidence state.</li>
            <li>Use descriptive case titles for easier handoff and report clarity.</li>
            <li>Keep chain selection aligned with the target address network.</li>
          </ul>
        </div>

        <div className="rounded-3xl border border-[var(--line)] bg-white p-6">
          <h2 className="text-xl font-bold">Troubleshooting</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            <li>If data is missing, confirm API keys and provider quotas in environment variables.</li>
            <li>If async jobs stall, verify job status from the trace and cluster pages.</li>
            <li>If case data does not appear, re-select the case from Case Context and refresh.</li>
            <li>If graph/timeline is empty, run profile/trace/cluster first to generate evidence events.</li>
          </ul>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-6 sm:p-8">
        <h2 className="text-2xl font-bold">Operational Best Practices</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="font-semibold">Preserve Evidence Integrity</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Do not overwrite case findings manually without adding narrative context.</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="font-semibold">Corroborate Before Escalation</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Use at least two signals (trace + cluster, or profile + timeline) before final conclusions.</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="font-semibold">Document Analyst Rationale</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Capture assumptions and confidence levels in the report narrative.</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="font-semibold">Export Frequently</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Generate timeline and report exports at key milestones to reduce rework risk.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
