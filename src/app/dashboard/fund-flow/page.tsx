"use client";

import { useActiveCaseId } from "@/lib/use-active-case";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FundFlowNode, FundFlowEdge, FundFlowTraceResponse, FundFlowSummary } from "@/app/api/fund-flow/trace/route";
import dynamic from "next/dynamic";

// Dynamically import Cytoscape to avoid SSR issues
const CytoscapeComponent = dynamic(() => import("@/components/cytoscape-graph"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-xl border border-[var(--line)] bg-white text-sm text-[var(--muted)]">
      Loading graph...
    </div>
  ),
});

type CaseRecord = {
  id: string;
  title: string;
  targetAddress: string;
  chain: "ethereum" | "bsc" | "base" | "arbitrum" | "hyperliquid";
};

type FundFlowDebug = NonNullable<FundFlowTraceResponse["debug"]>;
type TopDestination = FundFlowSummary["topDestinations"][number];

const EXPLORER_BASE_URLS: Record<string, string> = {
  ethereum: "https://etherscan.io",
  bsc: "https://bscscan.com",
  base: "https://basescan.org",
  arbitrum: "https://arbiscan.io",
};

const toLocalDateTimeInput = (unixTs: number): string => {
  const date = new Date(unixTs * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toUnixTimestamp = (localDateTime: string): number | null => {
  if (!localDateTime) return null;
  const parsed = new Date(localDateTime);
  const ms = parsed.getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
};

export default function FundFlowPage() {
  const caseIdFromUrl = useActiveCaseId();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCase, setActiveCase] = useState<CaseRecord | null>(null);

  const [formData, setFormData] = useState<{
    walletAddress: string;
    chain: "ethereum" | "bsc" | "base" | "arbitrum" | "hyperliquid" | "all";
    startDateTime: string;
    stolenAmount: number;
    txHash: string;
  }>({
    walletAddress: "",
    chain: "ethereum",
    startDateTime: toLocalDateTimeInput(Math.floor(Date.now() / 1000) - 86400 * 7), // 7 days ago
    stolenAmount: 0,
    txHash: "",
  });

  const [graphData, setGraphData] = useState<{
    nodes: FundFlowNode[];
    edges: FundFlowEdge[];
  } | null>(null);

  const [summary, setSummary] = useState<FundFlowSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<FundFlowDebug | null>(null);

  // Fetch cases
  useEffect(() => {
    const loadCases = async () => {
      try {
        const response = await fetch("/api/cases");
        if (response.ok) {
          const data = await response.json();
          setCases(data.cases || []);

          // Set active case if URL has caseId
          if (caseIdFromUrl) {
            const found = data.cases.find((c: CaseRecord) => c.id === caseIdFromUrl);
            if (found) {
              setActiveCase(found);
              setFormData((prev) => ({
                ...prev,
                walletAddress: found.targetAddress || "",
                chain: found.chain || "ethereum",
              }));
            }
          }
        }
      } catch (err) {
        console.error("Failed to load cases:", err);
      }
    };

    loadCases();
  }, [caseIdFromUrl]);

  const handleRunAnalysis = useCallback(async () => {
    if (!formData.walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(formData.walletAddress)) {
      setError("Invalid wallet address");
      return;
    }

    const startTimestamp = toUnixTimestamp(formData.startDateTime);
    if (!startTimestamp || startTimestamp <= 0) {
      setError("Invalid theft date/time");
      return;
    }

    setLoading(true);
    setError(null);
    setGraphData(null);
    setSummary(null);

    try {
      const response = await fetch("/api/fund-flow/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: formData.walletAddress,
          chain: formData.chain,
          startTimestamp,
          stolenAmount: formData.stolenAmount || undefined,
          txHash: formData.txHash || undefined,
          debug,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to trace fund flow");
      }

      const result = (await response.json()) as FundFlowTraceResponse;

      if (result.success && result.nodes && result.edges) {
        setGraphData({
          nodes: result.nodes,
          edges: result.edges,
        });
        setSummary(result.summary ?? null);
        setDebugInfo(result.debug ?? null);

        console.log("[fund-flow] Analysis complete", {
          nodes: result.nodes.length,
          edges: result.edges.length,
          totalFlow: result.summary?.totalFlowUsd,
        });
      } else {
        throw new Error(result.error || "No data returned");
      }
    } catch (err) {
      console.error("[fund-flow] Analysis failed:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [formData, debug]);

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Feature 03</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Fund Flow Analysis</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Track stolen funds across chains, bridges, exchanges, and protocols.</p>

        {/* Case Selection */}
      {cases.length > 1 && (
        <div className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
          <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Active Case</label>
            <select
              value={activeCase?.id || ""}
              onChange={(e) => {
                const found = cases.find((c) => c.id === e.target.value);
                if (found) {
                  setActiveCase(found);
                  setFormData((prev) => ({
                    ...prev,
                    walletAddress: found.targetAddress || "",
                    chain: found.chain || "ethereum",
                  }));
                }
              }}
              className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
            >
              <option value="">Select a case...</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-[var(--line)] bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Trace Configuration</h2>

              {/* Wallet Address */}
              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Wallet Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={formData.walletAddress}
                  onChange={(e) => setFormData((prev) => ({ ...prev, walletAddress: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-mono text-sm"
                />
              </div>

              {/* Chain */}
              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Starting Chain</label>
                <select
                  value={formData.chain}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      chain: e.target.value as "ethereum" | "bsc" | "base" | "arbitrum" | "hyperliquid" | "all",
                    }))
                  }
                  className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="bsc">BSC</option>
                  <option value="base">Base</option>
                  <option value="arbitrum">Arbitrum</option>
                  <option value="hyperliquid">Hyperliquid</option>
                  <option value="all">All Chains</option>
                </select>
              </div>

              {/* Start Date */}
              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Theft Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.startDateTime}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startDateTime: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Unix: {toUnixTimestamp(formData.startDateTime) ?? "invalid"}
                </p>
              </div>

              {/* Stolen Amount (Optional) */}
              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Stolen Amount (USD)</label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={formData.stolenAmount || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, stolenAmount: e.target.value ? Number(e.target.value) : 0 }))
                  }
                  className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                />
              </div>

              {/* Tx Hash (Optional) */}
              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Theft Tx Hash (Optional)</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={formData.txHash}
                  onChange={(e) => setFormData((prev) => ({ ...prev, txHash: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-mono text-sm"
                />
              </div>

              {/* Debug Mode */}
              <div className="mt-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="debug-mode"
                  checked={debug}
                  onChange={(e) => setDebug(e.target.checked)}
                  className="rounded border-[var(--line)]"
                />
                <label htmlFor="debug-mode" className="cursor-pointer text-sm text-[var(--ink)]">
                  Debug Mode
                </label>
              </div>

              {/* Run Button */}
              <button
                onClick={handleRunAnalysis}
                disabled={loading}
                className="mt-5 w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Analyzing..." : "Run Analysis"}
              </button>

              {/* Error Display */}
              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}

              {/* Debug Info */}
              {debugInfo && (
                <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-3 text-xs font-mono text-[var(--muted)]">
                  <p>
                    <strong>Request:</strong> {debugInfo.requestId}
                  </p>
                  <p>
                    <strong>Time:</strong> {debugInfo.elapsedMs}ms
                  </p>
                  <p>
                    <strong>Rows:</strong> {debugInfo.rowCountRaw}
                  </p>
                </div>
              )}
          </section>
        </div>

        <div className="space-y-6">
            {/* Summary Stats */}
            {summary && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Total Flow</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--ink)]">${summary.totalFlowUsd?.toFixed(0)}</p>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Entities</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{summary.nodeCount}</p>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Transactions</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{summary.edgeCount}</p>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Active Chains</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{summary.activeChains?.length || 0}</p>
                </div>
              </div>
            )}

            {/* Graph */}
            {graphData ? (
              <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
                <div className="border-b border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3">
                  <h3 className="text-sm font-semibold text-[var(--ink)]">Fund Flow Graph</h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">Click nodes for details • Drag to reposition • Scroll to zoom</p>
                </div>
                <CytoscapeComponent nodes={graphData.nodes} edges={graphData.edges} />
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--line)] bg-white p-16 text-center">
                <p className="text-sm text-[var(--muted)]">Configure parameters and click Run Analysis to visualize fund flows.</p>
              </div>
            )}

            {/* Distribution Breakdown */}
            {summary && summary.distributionByType && Object.keys(summary.distributionByType).length > 0 && (
              <div className="rounded-xl border border-[var(--line)] bg-white p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Distribution by Protocol Type</h3>
                <div className="space-y-3">
                  {Object.entries(summary.distributionByType as Record<string, number>)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, usd]) => {
                      const pct = summary.totalFlowUsd > 0 ? ((usd / summary.totalFlowUsd) * 100).toFixed(1) : "0";
                      return (
                        <div key={type}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium capitalize text-[var(--ink)]">{type}</span>
                            <span className="text-sm font-semibold text-[var(--ink)]">${usd?.toFixed(0)} ({pct}%)</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-[var(--surface-soft)]">
                            <div
                              className="h-2 rounded-full bg-[var(--accent)]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Top Destinations */}
            {summary && summary.topDestinations && summary.topDestinations.length > 0 && (
              <div className="rounded-xl border border-[var(--line)] bg-white p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Top Destinations</h3>
                <div className="space-y-2">
                  {summary.topDestinations.map((dest: TopDestination, idx: number) => (
                    <div key={`${dest.address}-${idx}`} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-3">
                      <div className="flex-1">
                        <p className="font-mono text-sm text-[var(--ink)]">{dest.name}</p>
                        <p className="text-xs text-[var(--muted)]">{dest.type}</p>
                      </div>
                      <p className="text-sm font-semibold text-[var(--ink)]">${dest.usd?.toFixed(0)}</p>
                      {dest.address && EXPLORER_BASE_URLS[summary.activeChains?.[0]] && (
                        <Link
                          href={`${EXPLORER_BASE_URLS[summary.activeChains[0]]}/address/${dest.address}`}
                          target="_blank"
                          className="ml-2 text-xs font-semibold text-[var(--accent)] hover:underline"
                        >
                          ↗
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
