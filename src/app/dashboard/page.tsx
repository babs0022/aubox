export default function DashboardPage() {
  return (
    <div>
      <p className="dash-kicker">Investigation Operations Workspace</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Investigation Command Center</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Navigate each module from the sidebar to run focused workflows across profiling, tracing, clustering, and
        reporting. Every page is structured for investigator-led execution and clean case outputs.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          "Profile Address",
          "Trace Funds",
          "Fund Flow Analysis",
          "Cluster Entities",
          "Token Movement",
          "Social Investigation",
          "Artifact Manager",
        ].map((feature, index) => (
          <div key={feature} className="dash-frame p-4">
            <p className="dash-kicker">Feature 0{index + 1}</p>
            <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{feature}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
