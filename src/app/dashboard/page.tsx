export default function DashboardPage() {
  return (
    <div>
      <p className="dash-kicker">Aubox Workspace</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Investigation Dashboard</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Use the left sidebar to navigate each investigation module. Every feature now has a dedicated page so you can
        run one workflow at a time and keep outputs organized.
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
