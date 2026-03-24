import Link from "next/link";

const workflow = [
  {
    title: "1. Create or select a case",
    detail:
      "Open Cases, create a new case (title, target address, chain), and set it active. Case-scoped tools read and write only to the active case.",
  },
  {
    title: "2. Profile Address",
    detail:
      "Run wallet profiling first to collect labels, tx count, risk score, and data source coverage. This also saves a case event and address artifact.",
  },
  {
    title: "3. Trace Funds",
    detail:
      "Trace money flow outbound, inbound, or both. Expand hops for enriched context, social chatter, swaps, transfers, and risk narrative.",
  },
  {
    title: "4. Cluster Entities",
    detail:
      "Group related wallets by heuristic evidence and confidence. Save seeds as artifacts and capture cluster evidence as case events.",
  },
  {
    title: "5. Social Investigation",
    detail:
      "Run targeted social queries across entities, tags, hashtags, tickers, usernames, and user focus. Review diagnostics and save terms as artifacts.",
  },
  {
    title: "6. Build Timeline",
    detail:
      "Aggregate saved case events into a chronological timeline with entities, risk indicators, and feature usage summaries.",
  },
  {
    title: "7. Evidence Graph",
    detail:
      "Convert case event nodes and edges into a connected visual map for relationship analysis and presentation.",
  },
  {
    title: "8. Generate Report",
    detail:
      "Create and export report markdown manually, or auto-build a case report pack with summary and Mermaid graph.",
  },
];

const featureBreakdown = [
  {
    route: "/dashboard/cases",
    feature: "Cases",
    purpose: "Create, select, and delete investigations.",
    howTo: [
      "Create a case with title, target address, and chain.",
      "Select the case to make it active for all case-scoped tools.",
      "Delete a case only when you want to remove its scoped records.",
    ],
    exampleInput: "Case Title: Bridge Outflow Review | Target Address: 0x1111...1111 | Chain: Ethereum",
    exampleOutput: "A new case card appears, is selectable, and can be marked active for all tools.",
  },
  {
    route: "/dashboard/cases/{caseId}/profile-address",
    feature: "Profile Address",
    purpose: "Build a high-signal dossier for a target wallet or entity.",
    howTo: [
      "Enter a wallet address or use @artifact recall.",
      "Choose chain and run profile.",
      "Review analyst summary, risk score, labels, tx count, balance, and source coverage.",
      "Result auto-saves a case event and profile artifact when active case exists.",
    ],
    exampleInput: "Address: 0x2222...2222 | Chain: Base",
    exampleOutput: "You see risk score, label count, transactions, balance, source coverage bars, and attributed labels.",
  },
  {
    route: "/dashboard/cases/{caseId}/trace-funds",
    feature: "Trace Funds",
    purpose: "Investigate movement paths across hops and directions.",
    howTo: [
      "Enter source address, chain, direction, and depth (1-5).",
      "Run trace and monitor async job state if a jobId is returned.",
      "Expand hop rows to load per-hop enrichment from hop-details.",
      "Review transfer context, swap context, social context, token risk, and narrative.",
      "Use explorer links for address and transaction validation.",
    ],
    exampleInput: "Source Address: 0x3333...3333 | Chain: Ethereum | Direction: Outbound | Depth: 2",
    exampleOutput: "You get a trace result panel with hops, explorer links, and expandable enriched details per hop.",
  },
  {
    route: "/dashboard/cases/{caseId}/cluster-entities",
    feature: "Cluster Entities",
    purpose: "Identify likely ownership or operational linkage patterns.",
    howTo: [
      "Paste one seed address per line or comma separated list.",
      "Use @artifact recall in seed input when needed.",
      "Choose strictness and time window to control linkage sensitivity.",
      "Run clustering and poll async job if present.",
      "Review confidence, evidence codes, and address relationships.",
    ],
    exampleInput: "Seeds: 0x5555...5555 and 0x6666...6666 | Chain: Base | Strictness: Balanced | Time Window: 30d",
    exampleOutput: "Cluster cards appear with confidence bands, supporting evidence, and linked addresses.",
  },
  {
    route: "/dashboard/cases/{caseId}/social-investigation",
    feature: "Social Investigation",
    purpose: "Search social posts and convert discovered terms to reusable case artifacts.",
    howTo: [
      "Fill free-text query and optional entity/tag/hashtag/ticker/username lists.",
      "Set optional user focus and sort mode (Top or Latest).",
      "Run search and review compiled query plus result records.",
      "Use diagnostics panel to inspect selected deSearch route and attempt statuses.",
      "Terms are auto-saved to case artifacts when active case is selected.",
    ],
    exampleInput: "Query: bridge exploit | Entities: aubox | Hashtags: security | Ticker: ETH | User focus: investigator | Sort: Latest",
    exampleOutput: "You see compiled query text, post count, result cards, and diagnostics with request attempts.",
  },
  {
    route: "/dashboard/cases/{caseId}/artifacts",
    feature: "Artifact Manager",
    purpose: "Review, add, rename, search, and delete case intelligence tokens.",
    howTo: [
      "Create manual artifacts with value, optional tag, and kind.",
      "Search by tag, value, or alias.",
      "Rename tags and remove obsolete artifacts.",
      "Use artifact tags later with @artifact recall in Profile and Cluster inputs.",
    ],
    exampleInput: "Value: 0x7777...7777 | Tag: suspect_router | Kind: address",
    exampleOutput: "Artifact appears in the list with kind, source, updated time, and inline rename/delete controls.",
  },
  {
    route: "/dashboard/cases/{caseId}/build-timeline",
    feature: "Build Timeline",
    purpose: "Transform discrete findings into a complete case narrative timeline.",
    howTo: [
      "Load events from the active case.",
      "Inspect totals, timeline span, risk event count, entities involved, and social signal count.",
      "Review events newest-first with narrative and risk flags.",
      "Export timeline markdown at milestones.",
    ],
    exampleInput: "Click Refresh Timeline after running at least one investigation tool.",
    exampleOutput: "Timeline summary tiles and ordered event cards appear, with optional risk flags and Export Markdown button.",
  },
  {
    route: "/dashboard/cases/{caseId}/evidence-graph",
    feature: "Evidence Graph",
    purpose: "Visualize relationships between entities, flows, and case events.",
    howTo: [
      "Load case events with node and edge payloads.",
      "Render graph as Mermaid flow chart.",
      "Review node, edge, and event totals plus latest evidence cards.",
    ],
    exampleInput: "Open Evidence Graph after profile, trace, cluster, or social runs have been saved.",
    exampleOutput: "You see a relationship graph, graph stats, and latest evidence cards from the active case.",
  },
  {
    route: "/dashboard/cases/{caseId}/generate-report",
    feature: "Generate Report",
    purpose: "Create a final case deliverable from accumulated evidence.",
    howTo: [
      "Either write report fields manually or use Build From Active Case.",
      "When using case pack, generated summary and graph are loaded automatically.",
      "Copy markdown to clipboard or download .md file.",
      "Inspect Mermaid source to audit relationships before sharing.",
    ],
    exampleInput: "Click Build From Active Case, then optionally edit title, target, summary, findings, and narrative.",
    exampleOutput: "Auto-pack markdown and graph preview appear, plus a final report preview you can copy or download.",
  },
  {
    route: "/dashboard/profile",
    feature: "Profile Settings",
    purpose: "Manage analyst profile fields used in your account session.",
    howTo: [
      "Open Profile from the dashboard.",
      "Update full name and optional avatar URL.",
      "Use quick avatar color buttons if you want an auto-generated icon.",
      "Save profile and confirm the updated card values.",
    ],
    exampleInput: "Full Name: Case Analyst | Optional Avatar URL: https://example.com/avatar.png",
    exampleOutput: "Profile card and avatar update immediately after save.",
  },
];

const artifactRules = [
  "Artifact kinds: address, entity, hashtag, ticker, username, query, note.",
  "Artifact sourceFeature values: trace, cluster, social, profile, timeline, report, manual.",
  "@artifact recall is available in Profile Address and Cluster Entities input flows.",
  "Artifacts are case scoped and never shared across other cases.",
];

const intelligenceSources = [
  {
    name: "Dune",
    purpose: "Adds historical query context to bridge and laundering investigations when a Dune bridge query is configured.",
  },
  {
    name: "DefiLlama",
    purpose: "Matches bridge protocol hints so cross-chain movements are labeled with better protocol confidence.",
  },
  {
    name: "CoinGecko",
    purpose: "Provides token contract pricing context used for stronger value interpretation in cross-chain flows.",
  },
  {
    name: "Dexscreener",
    purpose: "Adds token risk scoring for suspect assets seen in traced bridge-related hops.",
  },
];

export default function GuidePage() {
  return (
    <main className="min-h-screen w-full px-4 py-8 sm:px-8 sm:py-10">
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[0_12px_28px_rgba(0,0,0,0.08)] sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Aubox User Guide</p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--ink)] sm:text-5xl">Complete Investigation Operator Guide</h1>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-[var(--muted)] sm:text-base">
          This page is a complete operating reference for the Aubox app. It documents every major tool, what each
          tool does, how to run it, what to enter in the UI, and what results appear on screen.
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
        <h2 className="text-2xl font-bold">Feature Operating Manual</h2>
        <div className="mt-4 space-y-4">
          {featureBreakdown.map((item) => (
            <article key={item.feature} className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-semibold text-[var(--ink)]">{item.feature}</p>
                <p className="font-mono text-xs text-[var(--muted)]">Route: {item.route}</p>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.purpose}</p>

              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">How to use</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink)]">
                  {item.howTo.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-[var(--line)] bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">What you enter</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink)]">{item.exampleInput}</p>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">What you see</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink)]">{item.exampleOutput}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-[var(--line)] bg-white p-6">
          <h2 className="text-xl font-bold">Artifact Recall Rules</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            {artifactRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-[var(--line)] bg-white p-6">
          <h2 className="text-xl font-bold">Intelligence Sources</h2>
          <div className="mt-3 space-y-2">
            {intelligenceSources.map((source) => (
              <div key={source.name} className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                <p className="text-sm font-semibold text-[var(--ink)]">{source.name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{source.purpose}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-bold">Operational Best Practices</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="font-semibold">Always Confirm Active Case</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Run all case-scoped tools only after confirming the active case id.</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="font-semibold">Persist Evidence Early</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Use profile, trace, cluster, and social tools to generate events before timeline or graph review.</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="font-semibold">Corroborate Across Signals</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Validate conclusions with at least two sources: onchain flow, clustering, and social context.</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="font-semibold">Export Milestones</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Export timeline and report snapshots at key checkpoints to preserve analyst rationale.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
