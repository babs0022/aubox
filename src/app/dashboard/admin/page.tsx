"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type CodeRecord = {
  code: string;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
  expiresAt?: string;
};

type CreatorStat = {
  creatorUserId: string;
  creatorEmail?: string;
  codesCreated: number;
  totalCapacityIssued: number;
  successfulSignups: number;
};

type GrantUser = {
  id: string;
  email: string;
  username?: string;
  name?: string;
  inviteGrantLimit: number;
  inviteGrantUsed: number;
  inviteGrantRemaining: number;
  inviteGrantCycleDays?: number;
  inviteGrantCycleStartedAt?: string;
  inviteGrantNextResetAt?: string;
};

type ManagedUser = {
  id: string;
  email: string;
  username?: string;
  name?: string;
  createdAt?: string;
  lastLoginAt?: string;
  onboardingCompleted: boolean;
  accessGranted: boolean;
};

type UserSummary = {
  totalUsers: number;
  activeUsers: number;
};

export default function AdminDashboardPage() {
  const [codes, setCodes] = useState<CodeRecord[]>([]);
  const [creatorStats, setCreatorStats] = useState<CreatorStat[]>([]);
  const [grantUsers, setGrantUsers] = useState<GrantUser[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [userSummary, setUserSummary] = useState<UserSummary>({ totalUsers: 0, activeUsers: 0 });
  const [code, setCode] = useState("");
  const [maxUses, setMaxUses] = useState(100);
  const [delegateEmail, setDelegateEmail] = useState("");
  const [delegateLimit, setDelegateLimit] = useState(50);
  const [delegateCycleDays, setDelegateCycleDays] = useState(30);
  const [windowDays, setWindowDays] = useState<"7" | "30" | "90" | "all">("30");
  const [activeWindow, setActiveWindow] = useState<"24h" | "7d" | "30d" | "90d" | "all">("30d");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingGrant, setUpdatingGrant] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/access-codes?windowDays=${windowDays}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load codes");
      }
      setCodes(data.codes || []);
      setCreatorStats(data.creatorStats || []);
      setGrantUsers(data.grantUsers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load codes");
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ window: activeWindow });
      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load users");
      }

      setManagedUsers(Array.isArray(data.users) ? data.users : []);
      setUserSummary({
        totalUsers: Number(data.summary?.totalUsers || 0),
        activeUsers: Number(data.summary?.activeUsers || 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }, [activeWindow, searchTerm]);

  const updateGrant = async (event: FormEvent) => {
    event.preventDefault();
    setUpdatingGrant(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/access-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delegateUserEmail: delegateEmail.trim().toLowerCase(),
          grantLimit: delegateLimit,
          grantCycleDays: delegateCycleDays,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update delegated grant");
      }

      setMessage(`Updated grant for ${data.inviteGrant.email} to ${data.inviteGrant.inviteGrantLimit}`);
      setDelegateEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update delegated grant");
    } finally {
      setUpdatingGrant(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const createCode = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/access-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.toLowerCase(), maxUses }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create code");
      }
      setMessage(`Created ${data.code.code}`);
      setCode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create code");
    } finally {
      setCreating(false);
    }
  };

  const toggleCode = async (target: CodeRecord) => {
    setError(null);
    try {
      const response = await fetch(`/api/admin/access-codes/${target.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !target.isActive }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update code");
      }
      setCodes((previous) =>
        previous.map((item) => (item.code === target.code ? data.code : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update code");
    }
  };

  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };

  const exportUsersCsv = () => {
    const params = new URLSearchParams({ window: activeWindow });
    if (searchTerm.trim()) {
      params.set("search", searchTerm.trim());
    }
    window.location.href = `/api/admin/users/export?${params.toString()}`;
  };

  const deleteUser = async (target: ManagedUser) => {
    const confirmed = window.confirm(`Permanently delete ${target.email}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeletingUserId(target.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      setMessage(`Deleted user ${target.email}`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div>
      <p className="dash-kicker">Management</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">System Management</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Manage access codes, invite capacity, creator metrics, and user lifecycle operations.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Creator Window</p>
        {(["7", "30", "90", "all"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setWindowDays(option)}
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${windowDays === option ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)] bg-white text-[var(--ink)]"}`}
          >
            {option === "all" ? "All" : `${option}d`}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="dash-frame p-4">
          <p className="dash-kicker">Creator Activity</p>
          <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{creatorStats.length}</p>
        </div>
        <div className="dash-frame p-4">
          <p className="dash-kicker">Contributors</p>
          <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{grantUsers.length}</p>
        </div>
        <div className="dash-frame p-4">
          <p className="dash-kicker">Creator Signups</p>
          <p className="mt-2 text-2xl font-bold text-[var(--ink)]">
            {creatorStats.reduce((sum, item) => sum + item.successfulSignups, 0)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="dash-frame p-4">
          <p className="dash-kicker">Total Users</p>
          <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{userSummary.totalUsers}</p>
        </div>
        <div className="dash-frame p-4">
          <p className="dash-kicker">Active Users ({activeWindow})</p>
          <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{userSummary.activeUsers}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="dash-frame p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Issue New Code</h2>
          <form onSubmit={createCode} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Code</label>
              <input
                required
                minLength={4}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="aubx-private-beta"
                className="dash-frame-soft w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Max Uses</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={maxUses}
                onChange={(event) => setMaxUses(Number(event.target.value) || 1)}
                className="dash-frame-soft w-full px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !code.trim()}
              className="w-full border border-[var(--accent-strong)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create Code"}
            </button>
          </form>

          {message ? <p className="mt-3 border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}
          {error ? <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </section>

        <section className="dash-frame p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">All Access Codes</h2>
          {loading ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Loading codes...</p>
          ) : (
            <div className="mt-4 space-y-2">
              {codes.map((item) => (
                <div key={item.code} className="dash-frame-soft p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-semibold text-[var(--ink)]">{item.code}</p>
                      <p className="text-xs text-[var(--muted)]">Uses: {item.usedCount}/{item.maxUses}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleCode(item)}
                      className={`border px-2 py-1 text-xs font-semibold ${item.isActive ? "border-red-300 bg-red-50 text-red-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}
                    >
                      {item.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              ))}
              {codes.length === 0 ? <p className="text-sm text-[var(--muted)]">No access codes yet.</p> : null}
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="dash-frame p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Delegate Invite Capacity</h2>
          <form onSubmit={updateGrant} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">User email</label>
              <input
                type="email"
                required
                value={delegateEmail}
                onChange={(event) => setDelegateEmail(event.target.value)}
                placeholder="analyst@aubox.app"
                className="dash-frame-soft w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Grant limit (total uses)</label>
              <input
                type="number"
                min={0}
                max={100000}
                value={delegateLimit}
                onChange={(event) => setDelegateLimit(Number(event.target.value) || 0)}
                className="dash-frame-soft w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Cycle days</label>
              <input
                type="number"
                min={1}
                max={365}
                value={delegateCycleDays}
                onChange={(event) => setDelegateCycleDays(Number(event.target.value) || 30)}
                className="dash-frame-soft w-full px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={updatingGrant || !delegateEmail.trim()}
              className="w-full border border-[var(--accent-strong)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
            >
              {updatingGrant ? "Updating..." : "Set Delegated Grant"}
            </button>
          </form>
        </section>

        <section className="dash-frame p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Contributors</h2>
          <div className="mt-4 space-y-2">
            {grantUsers.length === 0 ? <p className="text-sm text-[var(--muted)]">No delegated grants configured.</p> : null}
            {grantUsers.map((item) => (
              <div key={item.id} className="dash-frame-soft p-3">
                <p className="text-sm font-semibold text-[var(--ink)]">{item.email}</p>
                <p className="text-xs text-[var(--muted)]">
                  Used {item.inviteGrantUsed}/{item.inviteGrantLimit} • Remaining {item.inviteGrantRemaining}
                </p>
                {item.inviteGrantCycleDays && item.inviteGrantNextResetAt ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">Cycle: {item.inviteGrantCycleDays} days • Resets {new Date(item.inviteGrantNextResetAt).toLocaleString()}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 dash-frame p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Creator Performance</h2>
        {creatorStats.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">No creator activity yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {creatorStats.slice(0, 12).map((item) => {
              const conversion = item.codesCreated > 0 ? ((item.successfulSignups / item.codesCreated) * 100).toFixed(1) : "0.0";
              return (
                <div key={item.creatorUserId} className="dash-frame-soft p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--ink)]">{item.creatorEmail || item.creatorUserId}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">{conversion}% conversion</p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Codes {item.codesCreated} • Capacity {item.totalCapacityIssued} • Signups {item.successfulSignups}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 dash-frame p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">User Management</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Browse, filter, export, and permanently remove user accounts.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["24h", "7d", "30d", "90d", "all"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setActiveWindow(option)}
                className={`border px-2 py-1 text-xs font-semibold ${activeWindow === option ? "border-[var(--accent-strong)] bg-[var(--accent)] text-white" : "dash-frame-soft text-[var(--ink)]"}`}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              onClick={exportUsersCsv}
              className="border border-[var(--accent-strong)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-[var(--accent-strong)]"
            >
              Export CSV
            </button>
          </div>
        </div>

        <form onSubmit={applySearch} className="mt-4 flex flex-wrap gap-2">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by email, uid, or username"
            className="dash-frame-soft min-w-[240px] flex-1 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="dash-frame-soft px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)]"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearchTerm("");
            }}
            className="dash-frame-soft px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"
          >
            Clear
          </button>
        </form>

        {usersLoading ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Loading users...</p>
        ) : managedUsers.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">No users found for the current filter.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border border-[var(--line)] text-left text-xs">
              <thead className="bg-[var(--panel)]">
                <tr>
                  <th className="border border-[var(--line)] px-2 py-2">UID</th>
                  <th className="border border-[var(--line)] px-2 py-2">Email</th>
                  <th className="border border-[var(--line)] px-2 py-2">Signed Up</th>
                  <th className="border border-[var(--line)] px-2 py-2">Last Login</th>
                  <th className="border border-[var(--line)] px-2 py-2">Onboarding</th>
                  <th className="border border-[var(--line)] px-2 py-2">Access</th>
                  <th className="border border-[var(--line)] px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {managedUsers.map((user) => (
                  <tr key={user.id} className="bg-[var(--paper)]">
                    <td className="border border-[var(--line)] px-2 py-2 font-mono">{user.id}</td>
                    <td className="border border-[var(--line)] px-2 py-2">{user.email}</td>
                    <td className="border border-[var(--line)] px-2 py-2">{user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}</td>
                    <td className="border border-[var(--line)] px-2 py-2">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</td>
                    <td className="border border-[var(--line)] px-2 py-2">{user.onboardingCompleted ? "Completed" : "Pending"}</td>
                    <td className="border border-[var(--line)] px-2 py-2">{user.accessGranted ? "Granted" : "Blocked"}</td>
                    <td className="border border-[var(--line)] px-2 py-2">
                      <button
                        type="button"
                        onClick={() => void deleteUser(user)}
                        disabled={deletingUserId === user.id}
                        className="border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        {deletingUserId === user.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
