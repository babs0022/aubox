"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function AccessCodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const response = await fetch("/api/onboarding/status");
      if (!response.ok) {
        router.push("/login");
        return;
      }

      const data = await response.json();
      if (data.user.onboardingCompleted) {
        router.push("/cases");
        return;
      }
      if (data.user.accessGranted) {
        router.push("/onboarding/welcome");
      }
    };

    checkStatus();
  }, [router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/redeem-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to verify code");
        return;
      }

      router.push("/onboarding/welcome");
    } catch {
      setError("Failed to verify code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-xl px-6 py-20">
        <div className="dash-frame p-8">
          <p className="dash-kicker">Access Verification</p>
          <h1 className="mt-4 text-3xl font-semibold text-[var(--ink)]">Enter your Aubox code</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Your account is created. Verify your access code to unlock onboarding and continue to your dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Enter access code"
              required
              className="dash-frame-soft w-full px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full border border-[var(--accent-strong)] bg-[var(--accent)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify Code"}
            </button>
          </form>

          {error ? (
            <div className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
