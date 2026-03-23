"use client";

import Link from "next/link";
import { getActiveCaseId, setActiveCaseId, clearActiveCaseId } from "@/lib/case-client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CaseRecord = {
  id: string;
  title: string;
  targetAddress: string;
  chain: string;
  updatedAt: string;
};

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [localActiveCaseId, setLocalActiveCaseId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [targetAddress, setTargetAddress] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDeleteCaseId, setPendingDeleteCaseId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const activeCase = useMemo(() => cases.find((item) => item.id === localActiveCaseId) || null, [cases, localActiveCaseId]);

  const loadCases = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/cases");
      if (!response.ok) return;
      const data = await response.json();
      const fetchedCases = Array.isArray(data.cases) ? data.cases : [];
      setCases(fetchedCases);

      const stored = getActiveCaseId();
      const firstId = fetchedCases[0]?.id || "";
      const nextActive = stored && fetchedCases.some((item: CaseRecord) => item.id === stored) ? stored : firstId;
      setLocalActiveCaseId(nextActive);
      if (nextActive) {
        setActiveCaseId(nextActive);
        window.dispatchEvent(new CustomEvent("caseswitched", { detail: { caseId: nextActive } }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCases();
  }, []);

  const createNewCase = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: title.trim(),
      targetAddress: targetAddress.trim(),
      chain,
    };

    if (!payload.title || !payload.targetAddress) {
      setMessage("Title and target address are required.");
      return;
    }

    const response = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setMessage("Failed to create case.");
      return;
    }

    const data = await response.json();
    const created = data.case as CaseRecord;
    const nextCases = [created, ...cases];
    setCases(nextCases);
    setLocalActiveCaseId(created.id);
    setActiveCaseId(created.id);
    window.dispatchEvent(new CustomEvent("caseswitched", { detail: { caseId: created.id } }));
    setTitle("");
    setTargetAddress("");
    setChain("ethereum");
    setMessage(`Case "${created.title}" created successfully.`);
  };

  const onSelect = (caseId: string) => {
    setLocalActiveCaseId(caseId);
    if (caseId) {
      setActiveCaseId(caseId);
      window.dispatchEvent(new CustomEvent("caseswitched", { detail: { caseId } }));
      const selectedCase = cases.find((c) => c.id === caseId);
      setMessage(`Switched to case: ${selectedCase?.title}`);
      router.push(`/dashboard/cases/${caseId}`);
    } else {
      clearActiveCaseId();
      setMessage("Case deselected.");
    }
  };

  const requestDeleteCase = (caseId: string) => {
    setPendingDeleteCaseId(caseId);
  };

  const onDeleteCase = async () => {
    if (!pendingDeleteCaseId) return;

    const caseId = pendingDeleteCaseId;
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
      if (!response.ok) {
        setMessage("Failed to delete case.");
        return;
      }

      const nextCases = cases.filter((c) => c.id !== caseId);
      setCases(nextCases);

      if (localActiveCaseId === caseId) {
        const nextActive = nextCases[0]?.id || "";
        if (nextActive) {
          setLocalActiveCaseId(nextActive);
          setActiveCaseId(nextActive);
          window.dispatchEvent(new CustomEvent("caseswitched", { detail: { caseId: nextActive } }));
          router.push(`/dashboard/cases/${nextActive}`);
        } else {
          setLocalActiveCaseId("");
          clearActiveCaseId();
          window.dispatchEvent(new CustomEvent("caseswitched", { detail: { caseId: null } }));
          router.push("/dashboard/cases");
        }
      }

      setMessage(`Deleted case: ${targetCase.title}`);
      setPendingDeleteCaseId(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const pendingDeleteCase = pendingDeleteCaseId
    ? cases.find((item) => item.id === pendingDeleteCaseId) || null
    : null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent)]"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
            <h2 className="text-2xl font-bold text-[var(--ink)]">Your Investigation Cases</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Select a case to make it active, or create a new one below.
            </p>

            {loading ? (
              <p className="mt-4 text-center text-sm text-[var(--muted)]">Loading cases...</p>
            ) : cases.length === 0 ? (
              <p className="mt-4 text-center text-sm text-[var(--muted)]">No cases yet. Create one to get started.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {cases.map((caseItem) => {
                  const isActive = caseItem.id === localActiveCaseId;
                  return (
                    <div
                      key={caseItem.id}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--line)] bg-[var(--paper)] hover:border-[var(--accent)]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <button
                          type="button"
                          onClick={() => onSelect(caseItem.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="font-semibold">{caseItem.title}</p>
                          <p className={`mt-1 text-xs ${isActive ? "opacity-90" : "text-[var(--muted)]"}`}>
                            {caseItem.targetAddress.slice(0, 12)}...{caseItem.targetAddress.slice(-10)} • {caseItem.chain}
                          </p>
                        </button>
                        <div className="ml-3 flex items-center gap-2">
                          {isActive ? (
                            <span className="rounded-full bg-brand-accent-strong px-2 py-1 text-xs font-semibold">
                              Active
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => requestDeleteCase(caseItem.id)}
                            className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${
                              isActive
                                ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                : "border-red-300 bg-white text-red-700 hover:bg-red-50"
                            }`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <h2 className="text-xl font-bold text-[var(--ink)]">Create New Case</h2>
          <form onSubmit={createNewCase} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Case Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Suspicious Bridge Activity"
                className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Target Address
              </label>
              <input
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                placeholder="0x..."
                className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2 font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Chain
              </label>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="ethereum">Ethereum</option>
                <option value="bsc">BSC</option>
                <option value="base">Base</option>
                <option value="arbitrum">Arbitrum</option>
                <option value="hyperliquid">Hyperliquid</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--accent)] px-3 py-2 font-semibold text-white hover:bg-[var(--accent-strong)]"
            >
              Create Case
            </button>
          </form>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3 text-sm text-[var(--muted)]">
          {message}
        </div>
      )}

      {pendingDeleteCase ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--ink)]">Delete Case?</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              This will permanently remove
              <span className="font-semibold text-[var(--ink)]"> {pendingDeleteCase.title}</span>
              and all saved evidence events.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setPendingDeleteCaseId(null)}
                className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => void onDeleteCase()}
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteLoading ? "Deleting..." : "Delete Case"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
