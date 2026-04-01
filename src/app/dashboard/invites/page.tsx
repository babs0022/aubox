"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type InviteCode = {
  code: string;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
};

type InviteSummary = {
  totalCodes: number;
  activeCodes: number;
  totalUses: number;
  remainingUses: number;
  successfulSignups: number;
  conversionRate: number;
};

type InviteGrant = {
  limit: number;
  used: number;
  remaining: number;
  cycleDays?: number;
  cycleStartedAt?: string;
  nextResetAt?: string;
};

export default function InvitesPage() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [summary, setSummary] = useState<InviteSummary | null>(null);
  const [grant, setGrant] = useState<InviteGrant | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [maxUses, setMaxUses] = useState(5);
  const [customCode, setCustomCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/invites");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load invite codes");
      }
      setCodes(data.codes || []);
      setSummary(data.summary || null);
      setGrant(data.grant || null);
      setIsAdmin(Boolean(data.isAdmin));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invite codes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      return;
    }

    if (!grant) {
      return;
    }

    const safeMax = Math.max(1, Math.min(25, grant.remaining || 1));
    if (maxUses > safeMax) {
      setMaxUses(safeMax);
    }
  }, [grant, isAdmin, maxUses]);

  const activeCodes = useMemo(() => codes.filter((item) => item.isActive), [codes]);
  const hasGrantCapacity = isAdmin || (grant ? grant.remaining > 0 : false);
  const grantMaxSelectable = isAdmin ? 25 : Math.max(1, Math.min(25, grant?.remaining || 1));
  const grantUtilization = grant && grant.limit > 0 ? Math.min((grant.used / grant.limit) * 100, 100) : 0;

  const createInvite = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxUses,
          code: customCode.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create invite code");
      }

      setMessage(`Created code: ${data.code.code}`);
      if (data.grant) {
        setGrant(data.grant);
      }
      setCustomCode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite code");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <p className="dash-kicker">Growth</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Invite Codes</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Create and track your invite codes from one place.</p>

      {!isAdmin && grant ? (
        <div className="dash-frame mt-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Available Capacity</p>
            <p className="font-mono text-xs text-[var(--muted)]">Used {grant.used} / {grant.limit} total uses</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--paper)]">
            <div className="h-full bg-[var(--accent)]" style={{ width: `${grantUtilization}%` }} />
          </div>
          <p className="mt-2 text-sm text-[var(--ink)]">Remaining capacity: {grant.remaining}</p>
          {grant.nextResetAt ? <p className="mt-1 text-xs text-[var(--muted)]">Resets on {new Date(grant.nextResetAt).toLocaleString()}</p> : null}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="dash-frame p-4">
          <p className="dash-kicker">Total Codes</p>
          <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{summary?.totalCodes ?? 0}</p>
        </div>
        <div className="dash-frame p-4">
          <p className="dash-kicker">Active Codes</p>
          <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{summary?.activeCodes ?? 0}</p>
        </div>
        <div className="dash-frame p-4">
          <p className="dash-kicker">Total Redemptions</p>
          <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{summary?.successfulSignups ?? 0}</p>
        </div>
        <div className="dash-frame p-4">
          <p className="dash-kicker">Code Conversion</p>
          <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{summary?.conversionRate ?? 0}%</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="rounded-xl border border-[var(--line)] bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Create New Invite</h2>
          <form onSubmit={createInvite} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Custom code (optional)</label>
              <input
                value={customCode}
                onChange={(event) => setCustomCode(event.target.value.toLowerCase())}
                placeholder="aubx-team-alpha"
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Max uses</label>
              <input
                type="number"
                min={1}
                max={grantMaxSelectable}
                value={maxUses}
                onChange={(event) => setMaxUses(Number(event.target.value) || 1)}
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                You can issue up to 25 uses per invite from this screen, subject to your available capacity.
              </p>
            </div>
            <button
              type="submit"
              disabled={creating || !hasGrantCapacity}
              className="w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {creating ? "Creating..." : hasGrantCapacity ? "Create Invite Code" : "No Capacity Remaining"}
            </button>
          </form>

          {message ? <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}
          {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Your Codes</h2>
          {loading ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Loading invite codes...</p>
          ) : activeCodes.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">No active invite codes yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {codes.map((item) => {
                const remaining = Math.max(item.maxUses - item.usedCount, 0);
                return (
                  <div key={item.code} className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-sm font-semibold text-[var(--ink)]">{item.code}</p>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-700"}`}>
                        {item.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">Used {item.usedCount} / {item.maxUses} • Remaining {remaining}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
