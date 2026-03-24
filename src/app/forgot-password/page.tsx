import Link from "next/link";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";
import ProductAimDiagram from "@/components/auth/ProductAimDiagram";
import BrandMark from "@/components/brand/BrandMark";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">
            <BrandMark href="/forgot-password" />
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--ink)]">Reset password</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Enter your account email to receive a recovery link.</p>

            <div className="mt-6 rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0_6px_22px_rgba(0,0,0,0.05)]">
              <ForgotPasswordForm />
            </div>

            <p className="mt-5 text-center text-sm text-[var(--muted)]">
              Remember your password?{" "}
              <Link href="/login" className="font-semibold text-[var(--accent-strong)] hover:underline">
                Back to login
              </Link>
            </p>
          </div>
        </section>

        <section className="hidden bg-[radial-gradient(circle_at_14%_18%,rgba(10,110,93,0.22),transparent_42%),radial-gradient(circle_at_86%_82%,rgba(191,78,30,0.2),transparent_46%),linear-gradient(180deg,#f7f3eb_0%,#ece6db_100%)] lg:flex lg:items-center lg:justify-center">
          <div className="max-w-md px-10 text-center">
            <ProductAimDiagram className="mb-6" />
            <p className="text-3xl font-semibold tracking-tight text-[var(--ink)]">Account Recovery</p>
            <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
              Recover access quickly and continue your investigations with minimal interruption.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
