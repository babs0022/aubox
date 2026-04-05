"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type RequestAccessResponse = {
  success: boolean;
  alreadyPending?: boolean;
  message?: string;
};

const roleOptions = [
  "Exchange compliance",
  "Investigator / analyst",
  "Protocol / DeFi team",
  "Security operations",
  "Law enforcement",
  "Venture / risk team",
  "Other",
] as const;

const useCaseOptions = [
  "Incident response",
  "Wallet profiling",
  "Fund tracing",
  "Compliance investigations",
  "Case reporting",
  "Research / intelligence",
  "Other",
] as const;

export default function RequestAccessPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [ecosystemRole, setEcosystemRole] = useState<(typeof roleOptions)[number]>("Investigator / analyst");
  const [ecosystemRoleOther, setEcosystemRoleOther] = useState("");
  const [primaryUseCase, setPrimaryUseCase] = useState<(typeof useCaseOptions)[number]>("Fund tracing");
  const [expectations, setExpectations] = useState("");
  const [telegramOrDiscord, setTelegramOrDiscord] = useState("");
  const [websiteOrLinkedIn, setWebsiteOrLinkedIn] = useState("");
  const [region, setRegion] = useState("");
  const [xHandle, setXHandle] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RequestAccessResponse | null>(null);

  const roleIsOther = useMemo(() => ecosystemRole === "Other", [ecosystemRole]);

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          organization,
          ecosystemRole,
          ecosystemRoleOther: roleIsOther ? ecosystemRoleOther : "",
          primaryUseCase,
          expectations,
          telegramOrDiscord,
          websiteOrLinkedIn,
          region,
          xHandle,
        }),
      });

      const data = (await response.json()) as RequestAccessResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      setResult(data);
      if (!data.alreadyPending) {
        setFullName("");
        setEmail("");
        setOrganization("");
        setEcosystemRole("Investigator / analyst");
        setEcosystemRoleOther("");
        setPrimaryUseCase("Fund tracing");
        setExpectations("");
        setTelegramOrDiscord("");
        setWebsiteOrLinkedIn("");
        setRegion("");
        setXHandle("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="dash-frame bg-white p-6 sm:p-8">
          <p className="dash-kicker">Aubox Access</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Request Access</h1>
          <p className="mt-3 max-w-2xl text-sm text-[var(--muted)]">
            Aubox is currently gated. Submit your details and our team will review your request. If approved, we will send a one-time access code with signup instructions.
          </p>

          {result ? (
            <div className="mt-5 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {result.message || "Your request was submitted successfully."}
            </div>
          ) : null}
          {error ? (
            <div className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <form onSubmit={submitRequest} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-[var(--ink)]">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Full name *</span>
              <input
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="dash-frame-soft w-full px-3 py-2"
              />
            </label>

            <label className="block text-sm text-[var(--ink)]">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Work email *</span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="dash-frame-soft w-full px-3 py-2"
              />
            </label>

            <label className="block text-sm text-[var(--ink)]">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Organization / project *</span>
              <input
                required
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
                className="dash-frame-soft w-full px-3 py-2"
              />
            </label>

            <label className="block text-sm text-[var(--ink)]">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Role in ecosystem *</span>
              <select
                required
                value={ecosystemRole}
                onChange={(event) => setEcosystemRole(event.target.value as (typeof roleOptions)[number])}
                className="dash-frame-soft w-full px-3 py-2"
              >
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            {roleIsOther ? (
              <label className="block text-sm text-[var(--ink)] sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Role (Other) *</span>
                <input
                  required={roleIsOther}
                  value={ecosystemRoleOther}
                  onChange={(event) => setEcosystemRoleOther(event.target.value)}
                  className="dash-frame-soft w-full px-3 py-2"
                />
              </label>
            ) : null}

            <label className="block text-sm text-[var(--ink)] sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Primary use case *</span>
              <select
                required
                value={primaryUseCase}
                onChange={(event) => setPrimaryUseCase(event.target.value as (typeof useCaseOptions)[number])}
                className="dash-frame-soft w-full px-3 py-2"
              >
                {useCaseOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-[var(--ink)] sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">What are you expecting to see in Aubox? *</span>
              <textarea
                required
                minLength={10}
                value={expectations}
                onChange={(event) => setExpectations(event.target.value)}
                rows={5}
                className="dash-frame-soft w-full px-3 py-2"
              />
            </label>

            <label className="block text-sm text-[var(--ink)]">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Telegram / Discord</span>
              <input
                value={telegramOrDiscord}
                onChange={(event) => setTelegramOrDiscord(event.target.value)}
                className="dash-frame-soft w-full px-3 py-2"
              />
            </label>

            <label className="block text-sm text-[var(--ink)]">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Website / LinkedIn</span>
              <input
                value={websiteOrLinkedIn}
                onChange={(event) => setWebsiteOrLinkedIn(event.target.value)}
                className="dash-frame-soft w-full px-3 py-2"
              />
            </label>

            <label className="block text-sm text-[var(--ink)]">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Country / Region</span>
              <input
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                className="dash-frame-soft w-full px-3 py-2"
              />
            </label>

            <label className="block text-sm text-[var(--ink)]">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">X / Twitter handle</span>
              <input
                value={xHandle}
                onChange={(event) => setXHandle(event.target.value)}
                className="dash-frame-soft w-full px-3 py-2"
              />
            </label>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="border border-[var(--accent-strong)] bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
              <Link href="/guide" className="dash-frame-soft px-4 py-2 text-sm text-[var(--ink)]">
                View Guide
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
