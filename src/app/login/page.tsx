import Link from "next/link";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] px-5 py-7 shadow-[0_15px_45px_rgba(0,0,0,0.08)] sm:px-8 sm:py-10">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Aubox Access</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Log in to your investigation dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
          Access saved cases, run wallet traces, and generate report-ready exports from your workspace.
        </p>
      </section>

      <section className="mt-8">
        <AuthForm mode="signin" />
      </section>

      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        New to Aubox?{" "}
        <Link href="/signup" className="font-semibold text-[var(--accent-strong)]">
          Create your account
        </Link>

            <p className="mt-3 text-center text-sm text-[var(--muted)]">
              <Link href="/forgot-password" className="font-semibold text-[var(--accent-strong)]">
                Forgot your password?
              </Link>
            </p>
      </p>
    </main>
  );
}
