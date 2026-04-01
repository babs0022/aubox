import Link from "next/link";

export default function ResourcesPage() {
  return (
    <div>
      <p className="dash-kicker">Resources</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Investigation Resources</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link href="/guide" className="dash-frame p-5 hover:bg-white">
          <p className="text-lg font-semibold text-[var(--ink)]">Product Guide</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Workflow and case-handling best practices across all modules.</p>
        </Link>
        <a href="mailto:support@aubox.app" className="dash-frame p-5 hover:bg-white">
          <p className="text-lg font-semibold text-[var(--ink)]">Direct Support</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Get hands-on help for urgent investigation and onboarding questions.</p>
        </a>
      </div>
    </div>
  );
}
