import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import ProductAimDiagram from "@/components/auth/ProductAimDiagram";
import BrandMark from "@/components/brand/BrandMark";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">
            <BrandMark href="/login" />
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--ink)]">Log in</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Continue your investigation workspace.</p>

            <div className="mt-6">
              <AuthForm mode="signin" withCard={false} showTitle={false} />
            </div>

            <p className="mt-5 text-center text-sm text-[var(--muted)]">
              <Link href="/forgot-password" className="font-medium text-[var(--accent-strong)] hover:underline">
                Reset password
              </Link>
            </p>

            <p className="mt-3 text-center text-sm text-[var(--muted)]">
              New to Aubox?{" "}
              <Link href="/signup" className="font-semibold text-[var(--accent-strong)] hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </section>

        <section className="hidden bg-[radial-gradient(circle_at_18%_12%,rgba(10,110,93,0.25),transparent_42%),radial-gradient(circle_at_82%_84%,rgba(191,78,30,0.2),transparent_46%),linear-gradient(180deg,#f7f3eb_0%,#ece6db_100%)] lg:flex lg:items-center lg:justify-center">
          <div className="max-w-md px-10 text-center">
            <ProductAimDiagram className="mb-6" />
            <p className="text-3xl font-semibold tracking-tight text-[var(--ink)]">Investigation Workspace</p>
            <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
              Trace, cluster, and report complex cross-chain cases from one focused analyst cockpit.
            </p>
            <Link
              href="/guide"
              className="mt-8 inline-flex items-center border border-[var(--accent-strong)] bg-[var(--accent)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-[var(--accent-strong)]"
            >
              Open guide
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
