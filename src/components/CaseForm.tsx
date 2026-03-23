"use client";

import { useState } from "react";

export default function CaseForm() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chains = ["ethereum", "bsc", "base", "arbitrum", "hyperliquid"];

  const profileAddress = async () => {
    if (!address) {
      setError("Please enter an address");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chain }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data.profile || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to profile address");
    } finally {
      setLoading(false);
    }
  };

  const traceFunds = async () => {
    if (!address) {
      setError("Please enter an address");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAddress: address,
          chain,
          depth: 2,
          direction: "outbound",
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trace funds");
    } finally {
      setLoading(false);
    }
  };

  const clusterEntities = async () => {
    if (!address) {
      setError("Please enter an address");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedAddresses: [address],
          heuristics: ["sharedFunder", "counterparty"],
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cluster entities");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6">
      <h3 className="mb-4 text-xl font-bold">Quick Investigation</h3>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="0x..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-mono text-sm"
        />
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value)}
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2"
        >
          {chains.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={profileAddress}
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
        >
          {loading ? "Loading..." : "Profile"}
        </button>
        <button
          onClick={traceFunds}
          disabled={loading}
          className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 font-semibold hover:border-[var(--accent)] disabled:opacity-50"
        >
          {loading ? "Loading..." : "Trace"}
        </button>
        <button
          onClick={clusterEntities}
          disabled={loading}
          className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 font-semibold hover:border-[var(--accent)] disabled:opacity-50"
        >
          {loading ? "Loading..." : "Cluster"}
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}

      {result && (
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-white p-4">
          <pre className="max-h-64 overflow-auto font-mono text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
