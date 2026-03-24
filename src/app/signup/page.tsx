import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import ProductAimDiagram from "@/components/auth/ProductAimDiagram";
import BrandMark from "@/components/brand/BrandMark";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">
            <BrandMark href="/signup" />
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--ink)]">Sign up</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Create your investigator account.</p>

            <div className="mt-6">
              <AuthForm mode="signup" withCard={false} showTitle={false} />
            </div>

            <p className="mt-5 text-center text-sm text-[var(--muted)]">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-[var(--accent-strong)] hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </section>

        <section className="hidden bg-[radial-gradient(circle_at_82%_16%,rgba(10,110,93,0.24),transparent_42%),radial-gradient(circle_at_18%_86%,rgba(191,78,30,0.2),transparent_46%),linear-gradient(180deg,#f7f3eb_0%,#ece6db_100%)] lg:flex lg:items-center lg:justify-center">
          <div className="max-w-md px-10 text-center">
            <ProductAimDiagram className="mb-6" />
            <p className="text-3xl font-semibold tracking-tight text-[var(--ink)]">Cross-Chain Case Builder</p>
            <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
              Build reproducible evidence trails from wallet profile to final report with one continuous workflow.
            </p>
            <Link
              href="/guide"
              className="mt-8 inline-flex items-center rounded-full border border-[var(--accent)] bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--accent-strong)]"
            >
              Learn workflow
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
