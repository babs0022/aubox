export default function SupportPage() {
  return (
    <div>
      <p className="dash-kicker">Support</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Support</h1>
      <div className="dash-frame mt-6 p-6">
        <p className="text-sm text-[var(--muted)]">Need help with an investigation workflow or onboarding issue?</p>
        <a href="mailto:support@aubox.app" className="mt-3 inline-block border border-[var(--accent-strong)] bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--paper)] hover:bg-[var(--accent-strong)]">Contact support@aubox.app</a>
      </div>
    </div>
  );
}
