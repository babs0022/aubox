import Link from "next/link";
import BrandMark from "@/components/brand/BrandMark";
import ProductAimDiagram from "@/components/auth/ProductAimDiagram";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">
            <BrandMark href="/login" />
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--ink)]">Reset your password</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Enter your email address below and we'll send you a link to reset your password.
            </p>

            <div className="dash-frame mt-6 p-6 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
              <div className="space-y-4">
                <p className="text-sm text-[var(--muted)]">
                  If you have a password reset link from your email, copy and paste it into your browser's address bar, or click the link directly from the email to proceed.
                </p>
                <p className="text-sm text-[var(--muted)]">
                  If you haven't received an email yet, you can request a new password reset link below.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/forgot-password"
                className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] transition"
              >
                Request Password Reset
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--bg-secondary)] transition"
              >
                Back to login
              </Link>
            </div>
          </div>
        </section>

        <section className="hidden bg-[radial-gradient(circle_at_16%_22%,rgba(10,110,93,0.22),transparent_44%),radial-gradient(circle_at_84%_78%,rgba(191,78,30,0.2),transparent_48%),linear-gradient(180deg,#f7f3eb_0%,#ece6db_100%)] lg:flex lg:items-center lg:justify-center">
          <div className="dash-frame max-w-md px-10 py-10 text-center">
            <ProductAimDiagram className="mb-6" />
            <p className="text-3xl font-semibold tracking-tight text-[var(--ink)]">Secure Reset</p>
            <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
              Lock in a strong new password and return to monitoring wallets and suspicious flows.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
