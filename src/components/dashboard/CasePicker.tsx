"use client";

import { clearActiveCaseId, getActiveCaseId, setActiveCaseId } from "@/lib/case-client";
import { useEffect, useMemo, useState } from "react";

type CaseRecord = {
  id: string;
  title: string;
  targetAddress: string;
  chain: string;
  updatedAt: string;
};

export default function CasePicker() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [localActiveCaseId, setLocalActiveCaseId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [targetAddress, setTargetAddress] = useState("");
  const [chain, setChain] = useState("ethereum");

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
        // Dispatch custom event to notify all listeners
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
      return;
    }

    const response = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const created = data.case as CaseRecord;
    const nextCases = [created, ...cases];
    setCases(nextCases);
    setLocalActiveCaseId(created.id);
    setActiveCaseId(created.id);
    // Dispatch custom event to notify all listeners
    window.dispatchEvent(new CustomEvent("caseswitched", { detail: { caseId: created.id } }));
    setTitle("");
    setTargetAddress("");
  };

  const onSelect = (value: string) => {
    setLocalActiveCaseId(value);
    if (value) {
      setActiveCaseId(value);
    } else {
      clearActiveCaseId();
    }
    // Dispatch custom event to notify all listeners (same-tab communication)
    window.dispatchEvent(new CustomEvent("caseswitched", { detail: { caseId: value || null } }));
  };

  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Active Case</p>
        <select
          value={localActiveCaseId}
          onChange={(e) => onSelect(e.target.value)}
          className="min-w-[260px] rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm"
        >
          <option value="">Select a case...</option>
          {cases.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} ({item.chain})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void loadCases()}
          className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs font-semibold"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {activeCase ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Tracking {activeCase.targetAddress} on {activeCase.chain}. New feature outputs will auto-attach here.
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--muted)]">Create or select a case to persist evidence automatically.</p>
      )}

      <form onSubmit={createNewCase} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Case title"
          className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm"
        />
        <input
          value={targetAddress}
          onChange={(e) => setTargetAddress(e.target.value)}
          placeholder="Target 0x..."
          className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm font-mono"
        />
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value)}
          className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm"
        >
          <option value="ethereum">ethereum</option>
          <option value="bsc">bsc</option>
          <option value="base">base</option>
          <option value="arbitrum">arbitrum</option>
          <option value="hyperliquid">hyperliquid</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-strong)]"
        >
          New Case
        </button>
      </form>
    </div>
  );
}
