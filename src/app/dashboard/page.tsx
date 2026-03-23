export default function DashboardPage() {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Aubox Workspace</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Investigation Dashboard</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Use the left sidebar to navigate each investigation module. Every feature now has a dedicated page so you can
        run one workflow at a time and keep outputs organized.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          "Profile Address",
          "Trace Funds",
          "Cluster Entities",
          "Social Investigation",
          "Artifact Manager",
          "Build Timeline",
          "Generate Report",
        ].map((feature, index) => (
          <div key={feature} className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Feature 0{index + 1}</p>
            <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{feature}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
