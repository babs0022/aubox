import Link from "next/link";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--paper)] px-5 py-7 shadow-[0_15px_45px_rgba(0,0,0,0.08)] sm:px-8 sm:py-10">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Account Recovery</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Reset your password</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </section>

      <section className="mt-8">
        <ForgotPasswordForm />
      </section>

      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        Remember your password?{" "}
        <Link href="/login" className="font-semibold text-[var(--accent-strong)]">
          Back to login
        </Link>
      </p>
    </main>
  );
}
