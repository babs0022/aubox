"use client";

import { useEffect, useMemo, useState } from "react";
import { useActiveCaseId } from "@/lib/use-active-case";
import type { FundFlowEdge, FundFlowSummary, FundFlowTraceResponse } from "@/app/api/fund-flow/trace/route";

type CaseRecord = {
  id: string;
  title: string;
  targetAddress: string;
  chain: "ethereum" | "bsc" | "base" | "arbitrum" | "hyperliquid";
};

type BridgeRow = {
  blockchain: string;
  address: string;
  bridge_name: string;
  bridge_address: string;
  tx_count: number;
  inflow_txs: number;
  outflow_txs: number;
  total_amount_usd: number;
  avg_amount_usd: number;
  first_seen: string;
  last_seen: string;
  activity_span_days: number;
};

type BridgeAnalyzeResponse = {
  success?: boolean;
  summary?: {
    walletAddress: string;
    chain: string;
    matchedRows: number;
    bridgeCount: number;
    totalTxs: number;
    totalVolumeUsd: number;
    inflowTxs: number;
    outflowTxs: number;
    topBridge: string | null;
    activeChains: string[];
  };
  rows?: BridgeRow[];
  debug?: {
    requestId?: string;
    elapsedMs?: number;
    rowCountRaw?: number;
    rowCountNormalized?: number;
    topBridgeAddress?: string | null;
    chainsSeen?: string[];
  };
  error?: string;
};

type HopDetailsResponse = {
  details?: {
    txHash: string;
    chain: string;
    from: {
      address: string;
      label: string;
      entity: string;
      entityType: string;
      tags: string[];
      clusterIds: string[];
      isContract: boolean;
    };
    to: {
      address: string;
      label: string;
      entity: string;
      entityType: string;
      tags: string[];
      clusterIds: string[];
      isContract: boolean;
    };
    tx: {
      from: string;
      to: string;
      method: string;
      functionSignature: string;
      value: string;
      usd: number | null;
      gasUsed: string;
      timestamp: string;
      blockNumber: string;
    };
    transfers: Array<{
      transferType: "external" | "internal" | "token";
      from: string;
      to: string;
      value: string;
      usd: number | null;
      tokenSymbol: string;
      tokenName: string;
      tokenAddress: string;
    }>;
    swaps?: Array<{
      protocol: string;
      dex: string;
      amountIn: string;
      amountOut: string;
      tokenInSymbol: string;
      tokenOutSymbol: string;
      usd: number | null;
      timestamp: string;
    }>;
    social?: Array<{
      author: string;
      handle: string;
      text: string;
      url: string;
      timestamp: string;
      engagementScore: number | null;
    }>;
    narrative?: string;
  };
  error?: string;
};

type ClusterResponse = {
  success?: boolean;
  clusters?: Array<{
    label: string;
    addresses: string[];
    confidence: number;
    confidenceBand: "low" | "medium" | "high";
    evidence: Array<{
      code: string;
      label: string;
      weight: number;
      value: number;
      detail: string;
      proofs: Array<{
        type: "tx" | "address" | "graph";
        source: string;
        label: string;
        txHash?: string;
        address?: string;
        explorerUrl?: string;
        graphRef?: string;
      }>;
    }>;
    sources: string[];
  }>;
  thresholds?: {
    minEdgeConfidence: number;
  };
  message?: string;
  error?: string;
  requestId?: string;
};

type StageKey = "seed" | "trace" | "bridge" | "junctions" | "cluster" | "recovery" | "report";
type StageStatus = "idle" | "running" | "complete" | "error";

type StageState<T> = {
  status: StageStatus;
  error: string | null;
  data: T | null;
};

type WorkflowState = {
  seed: StageState<{
    walletAddress: string;
    chain: string;
    startTimestamp: number;
    stolenAmount?: number;
    txHash?: string;
    caseTitle?: string;
  }>;
  trace: StageState<{
    response: FundFlowTraceResponse;
    firstHopEdges: FundFlowEdge[];
    firstHopNodes: string[];
    topDestinations: FundFlowSummary["topDestinations"];
  }>;
  bridge: StageState<BridgeAnalyzeResponse>;
  junctions: StageState<Array<{
    txHash: string;
    hop: FundFlowEdge;
    details: NonNullable<HopDetailsResponse["details"]>;
  }>>;
  cluster: StageState<ClusterResponse>;
  recovery: StageState<{
    highConfidence: string[];
    mediumConfidence: string[];
    lowConfidence: string[];
    notes: string[];
  }>;
  report: StageState<{
    title: string;
    narrative: string;
    bullets: string[];
  }>;
};

const stageOrder: StageKey[] = ["seed", "trace", "bridge", "junctions", "cluster", "recovery", "report"];

const initialWorkflowState = (): WorkflowState => ({
  seed: { status: "idle", error: null, data: null },
  trace: { status: "idle", error: null, data: null },
  bridge: { status: "idle", error: null, data: null },
  junctions: { status: "idle", error: null, data: null },
  cluster: { status: "idle", error: null, data: null },
  recovery: { status: "idle", error: null, data: null },
  report: { status: "idle", error: null, data: null },
});

const formatUsd = (value: number | null | undefined): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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

const shortenAddress = (value: string): string => {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const EXPLORER_BASE_URLS: Record<string, string> = {
  ethereum: "https://etherscan.io",
  bsc: "https://bscscan.com",
  base: "https://basescan.org",
  arbitrum: "https://arbiscan.io",
  hyperliquid: "https://hypurrscan.io",
};

const formatDateTime = (value: number): string => {
  const date = new Date(value * 1000);
  return date.toLocaleString();
};

export default function FundFlowPage() {
  const caseIdFromUrl = useActiveCaseId();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCase, setActiveCase] = useState<CaseRecord | null>(null);
  const [formData, setFormData] = useState({
    walletAddress: "",
    chain: "ethereum" as "ethereum" | "bsc" | "base" | "arbitrum" | "hyperliquid" | "all",
    startDateTime: toLocalDateTimeInput(Math.floor(Date.now() / 1000) - 86400 * 7),
    stolenAmount: 0,
    txHash: "",
    depth: 3,
  });
  const [workflow, setWorkflow] = useState<WorkflowState>(initialWorkflowState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCases = async () => {
      try {
        const response = await fetch("/api/cases");
        if (!response.ok) return;

        const data = await response.json();
        const nextCases = data.cases || [];
        setCases(nextCases);

        if (caseIdFromUrl) {
          const found = nextCases.find((c: CaseRecord) => c.id === caseIdFromUrl);
          if (found) {
            setActiveCase(found);
            setFormData((current) => ({
              ...current,
              walletAddress: found.targetAddress || "",
              chain: found.chain || "ethereum",
            }));
          }
        }
      } catch (loadError) {
        console.error("Failed to load cases", loadError);
      }
    };

    loadCases();
  }, [caseIdFromUrl]);

  const setStage = <K extends StageKey>(stage: K, next: StageState<WorkflowState[K]["data"]>) => {
    setWorkflow((current) => ({
      ...current,
      [stage]: next,
    }));
  };

  const resetWorkflow = () => {
    setWorkflow(initialWorkflowState());
  };

  const runManualWorkflow = async () => {
    const walletAddress = formData.walletAddress.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
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
    resetWorkflow();

    const seedData = {
      walletAddress,
      chain: formData.chain,
      startTimestamp,
      stolenAmount: formData.stolenAmount || undefined,
      txHash: formData.txHash || undefined,
      caseTitle: activeCase?.title,
    };

    setStage("seed", { status: "running", error: null, data: seedData });
    setStage("seed", { status: "complete", error: null, data: seedData });

    try {
      setStage("trace", { status: "running", error: null, data: null });
      const traceResponse = await fetch("/api/fund-flow/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: walletAddress,
          chain: formData.chain,
          startTimestamp,
          stolenAmount: formData.stolenAmount || undefined,
          txHash: formData.txHash || undefined,
        }),
      });

      if (!traceResponse.ok) {
        const body = await traceResponse.json().catch(() => ({}));
        throw new Error(body.error || "Failed to trace fund flow");
      }

      const traceResult = (await traceResponse.json()) as FundFlowTraceResponse;
      if (!traceResult.success || !traceResult.summary) {
        throw new Error(traceResult.error || "No trace data returned");
      }

      const firstHopEdges = (traceResult.edges || []).filter((edge) => edge.hopLevel === 1).slice(0, 10);
      const firstHopNodes = Array.from(
        new Set(
          firstHopEdges.flatMap((edge) => [edge.source, edge.target]).filter((value) => typeof value === "string" && value.length > 0)
        )
      );

      setStage("trace", {
        status: "complete",
        error: null,
        data: {
          response: traceResult,
          firstHopEdges,
          firstHopNodes,
          topDestinations: traceResult.summary.topDestinations || [],
        },
      });

      setStage("bridge", { status: "running", error: null, data: null });
      const bridgeResponse = await fetch("/api/bridge/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: walletAddress,
          chain: formData.chain,
        }),
      });

      if (!bridgeResponse.ok) {
        const body = await bridgeResponse.json().catch(() => ({}));
        throw new Error(body.error || "Failed to analyze bridge activity");
      }

      const bridgeResult = (await bridgeResponse.json()) as BridgeAnalyzeResponse;
      setStage("bridge", { status: "complete", error: null, data: bridgeResult });

      setStage("junctions", { status: "running", error: null, data: null });
      const junctions: Array<{
        txHash: string;
        hop: FundFlowEdge;
        details: NonNullable<HopDetailsResponse["details"]>;
      }> = [];

      for (const hop of firstHopEdges.slice(0, 3)) {
        const txHash = hop.txHashes[0];
        if (!txHash) continue;

        const hopResponse = await fetch("/api/trace/hop-details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chain: formData.chain,
            txHash,
            from: hop.source,
            to: hop.target,
          }),
        });

        if (!hopResponse.ok) continue;

        const hopResult = (await hopResponse.json()) as HopDetailsResponse;
        if (hopResult.details) {
          junctions.push({ txHash, hop, details: hopResult.details });
        }
      }

      setStage("junctions", { status: "complete", error: null, data: junctions });

      setStage("cluster", { status: "running", error: null, data: null });
      const clusterSeeds = Array.from(
        new Set([
          walletAddress,
          ...firstHopEdges.flatMap((edge) => [edge.source, edge.target]),
        ])
      )
        .filter((value) => /^0x[a-fA-F0-9]{40}$/.test(value))
        .slice(0, 10);

      const clusterResponse = await fetch("/api/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedAddresses: clusterSeeds.length > 0 ? clusterSeeds : [walletAddress],
          chain: formData.chain === "all" ? "ethereum" : formData.chain,
          strictness: "balanced",
          timeWindow: "30d",
        }),
      });

      if (!clusterResponse.ok) {
        const body = await clusterResponse.json().catch(() => ({}));
        throw new Error(body.error || "Failed to cluster related entities");
      }

      const clusterResult = (await clusterResponse.json()) as ClusterResponse;
      setStage("cluster", { status: "complete", error: null, data: clusterResult });

      setStage("recovery", { status: "running", error: null, data: null });
      const recoveryBuckets = buildRecoveryBuckets(traceResult.summary, bridgeResult, clusterResult, junctions);
      setStage("recovery", { status: "complete", error: null, data: recoveryBuckets });

      setStage("report", { status: "running", error: null, data: null });
      const report = buildFinalReport(seedData, traceResult.summary, bridgeResult, clusterResult, recoveryBuckets, junctions);
      setStage("report", { status: "complete", error: null, data: report });
    } catch (workflowError) {
      const message = workflowError instanceof Error ? workflowError.message : "Unknown workflow error";
      setError(message);
      const failedStage = stageOrder.find((stage) => workflow[stage].status === "running");
      if (failedStage) {
        setWorkflow((current) => ({
          ...current,
          [failedStage]: { ...current[failedStage], status: "error", error: message },
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  const traceData = workflow.trace.data;
  const bridgeData = workflow.bridge.data;
  const junctionData = workflow.junctions.data || [];
  const clusterData = workflow.cluster.data;
  const recoveryData = workflow.recovery.data;
  const reportData = workflow.report.data;

  const firstHopEdges = traceData?.firstHopEdges || [];
  const traceSummary = traceData?.response.summary;
  const explorerBase = EXPLORER_BASE_URLS[traceSummary?.chain || formData.chain || "ethereum"];
  const topDestinations = traceSummary?.topDestinations || [];

  const workflowCards = useMemo(
    () =>
      stageOrder.map((stage) => ({
        stage,
        title: {
          seed: "1. Genesis",
          trace: "2. First-Hop Trace",
          bridge: "3. Bridge Pivot",
          junctions: "4. Junction Details",
          cluster: "5. Entity Clustering",
          recovery: "6. Recovery Targets",
          report: "7. Revelation",
        }[stage],
        description: {
          seed: "Lock the case seed and investigation context.",
          trace: "Pull the first movement layer and rank split points.",
          bridge: "Check for cross-chain movement and bridge exposure.",
          junctions: "Inspect the first meaningful stops and transaction detail.",
          cluster: "Group related wallets into likely controlled entities.",
          recovery: "Classify what is likely recoverable, monitorable, or lost.",
          report: "Turn the chain into a case-ready narrative and evidence pack.",
        }[stage],
      })),
    []
  );

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Feature 03</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Fund Flow Analysis</h1>
      <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
        Trace a stolen-funds case the way an investigator works it manually: seed the case, inspect the first hop,
        pivot through bridges, recurse through junctions, cluster entities, and finish with recovery targets and a
        final evidence pack.
      </p>

      {cases.length > 1 && (
        <div className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
          <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">Active Case</label>
          <select
            value={activeCase?.id || ""}
            onChange={(event) => {
              const found = cases.find((item) => item.id === event.target.value);
              if (!found) return;

              setActiveCase(found);
              setFormData((current) => ({
                ...current,
                walletAddress: found.targetAddress || "",
                chain: found.chain || "ethereum",
              }));
            }}
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            <option value="">Select a case...</option>
            {cases.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-[var(--line)] bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Manual seed</h2>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Wallet Address</label>
              <input
                type="text"
                placeholder="0x..."
                value={formData.walletAddress}
                onChange={(event) => setFormData((current) => ({ ...current, walletAddress: event.target.value }))}
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-mono text-sm"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Starting Chain</label>
              <select
                value={formData.chain}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    chain: event.target.value as typeof formData.chain,
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

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Theft Date & Time</label>
              <input
                type="datetime-local"
                value={formData.startDateTime}
                onChange={(event) => setFormData((current) => ({ ...current, startDateTime: event.target.value }))}
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">Unix: {toUnixTimestamp(formData.startDateTime) ?? "invalid"}</p>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Stolen Amount (USD)</label>
              <input
                type="number"
                placeholder="Optional"
                value={formData.stolenAmount || ""}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    stolenAmount: event.target.value ? Number(event.target.value) : 0,
                  }))
                }
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Theft Tx Hash (Optional)</label>
              <input
                type="text"
                placeholder="0x..."
                value={formData.txHash}
                onChange={(event) => setFormData((current) => ({ ...current, txHash: event.target.value }))}
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-mono text-sm"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Trace Depth</label>
              <select
                value={formData.depth}
                onChange={(event) => setFormData((current) => ({ ...current, depth: Number(event.target.value) }))}
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
              >
                <option value={1}>1 hop</option>
                <option value={2}>2 hops</option>
                <option value={3}>3 hops</option>
                <option value={4}>4 hops</option>
                <option value={5}>5 hops</option>
              </select>
            </div>

            <button
              onClick={runManualWorkflow}
              disabled={loading}
              className="mt-5 w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Running manual workflow..." : "Run Manual Workflow"}
            </button>

            {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          </section>

          <section className="rounded-xl border border-[var(--line)] bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Workflow sequence</h2>
            <div className="mt-4 space-y-3">
              {workflowCards.map((item, index) => {
                const current = workflow[item.stage];
                return (
                  <div key={item.stage} className="flex gap-3 rounded-lg border border-[var(--line)] p-3">
                    <div
                      className={`mt-1 h-3 w-3 rounded-full ${
                        current.status === "complete"
                          ? "bg-green-500"
                          : current.status === "running"
                            ? "bg-[var(--accent)]"
                            : current.status === "error"
                              ? "bg-red-500"
                              : "bg-[var(--line)]"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">{item.title}</p>
                      <p className="mt-1 text-xs leading-6 text-[var(--muted)]">{item.description}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                        {current.status === "running" ? "Running" : current.status === "complete" ? "Complete" : current.status === "error" ? "Error" : `Step 0${index + 1}`}
                      </p>
                      {current.error ? <p className="mt-1 text-xs text-red-600">{current.error}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-[var(--line)] bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Genesis</h2>
            {workflow.seed.data ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Wallet" value={shortenAddress(workflow.seed.data.walletAddress)} />
                <MetricCard label="Chain" value={workflow.seed.data.chain} />
                <MetricCard label="Theft timestamp" value={String(workflow.seed.data.startTimestamp)} />
                <MetricCard label="Case" value={workflow.seed.data.caseTitle || "Manual case"} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">Seed the case to begin the manual investigation sequence.</p>
            )}
          </section>

          {traceSummary ? (
            <section className="rounded-xl border border-[var(--line)] bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">First-hop trace</h2>
                <p className="text-xs text-[var(--muted)]">{traceSummary.chain || formData.chain} trace</p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total flow" value={formatUsd(traceSummary.totalFlowUsd)} />
                <MetricCard label="Entities" value={String(traceSummary.nodeCount)} />
                <MetricCard label="Transfers" value={String(traceSummary.edgeCount)} />
                <MetricCard label="Active chains" value={String(traceSummary.activeChains?.length || 0)} />
              </div>

              {firstHopEdges.length > 0 ? (
                <div className="mt-5 overflow-hidden rounded-lg border border-[var(--line)]">
                  <div className="border-b border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--ink)]">First-hop ledger</p>
                    <p className="text-xs text-[var(--muted)]">Where the money moved first, and what it touched.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[#f5f2eb] text-xs uppercase tracking-[0.1em] text-[var(--muted)]">
                        <tr>
                          <th className="px-4 py-3">Source</th>
                          <th className="px-4 py-3">Target</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Hop</th>
                          <th className="px-4 py-3">Tx</th>
                        </tr>
                      </thead>
                      <tbody>
                        {firstHopEdges.map((edge) => (
                          <tr key={`${edge.source}-${edge.target}-${edge.hopLevel}`} className="border-t border-[var(--line)]">
                            <td className="px-4 py-3 font-mono text-xs">{shortenAddress(edge.source)}</td>
                            <td className="px-4 py-3 font-mono text-xs">{shortenAddress(edge.target)}</td>
                            <td className="px-4 py-3">{formatUsd(edge.amount)}</td>
                            <td className="px-4 py-3">{edge.hopLevel}</td>
                            <td className="px-4 py-3 font-mono text-xs">
                              {edge.txHashes[0] && explorerBase ? (
                                <a
                                  href={`${explorerBase}/tx/${edge.txHashes[0]}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--accent)] hover:underline"
                                >
                                  {shortenAddress(edge.txHashes[0])}
                                </a>
                              ) : (
                                shortenAddress(edge.txHashes[0] || "n/a")
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {topDestinations.length > 0 ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {topDestinations.slice(0, 4).map((destination, index) => (
                    <div key={`${destination.address}-${index}`} className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-4">
                      <p className="font-mono text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Top destination</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{destination.name}</p>
                      <p className="text-xs text-[var(--muted)]">{destination.type}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{formatUsd(destination.usd)}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {bridgeData?.summary ? (
            <section className="rounded-xl border border-[var(--line)] bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Bridge pivot</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Bridge hits" value={String(bridgeData.summary.bridgeCount)} />
                <MetricCard label="Total txs" value={String(bridgeData.summary.totalTxs)} />
                <MetricCard label="Volume" value={formatUsd(bridgeData.summary.totalVolumeUsd)} />
                <MetricCard label="Active chains" value={String(bridgeData.summary.activeChains.length)} />
              </div>

              <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)]">
                <p>
                  Top bridge: <span className="font-semibold text-[var(--ink)]">{bridgeData.summary.topBridge || "None identified"}</span>
                </p>
                <p className="mt-1">This is where the investigator pivots if the money leaves the original chain.</p>
              </div>

              {bridgeData.rows?.length ? (
                <div className="mt-5 overflow-hidden rounded-lg border border-[var(--line)]">
                  <div className="border-b border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--ink)]">Bridge rows</p>
                    <p className="text-xs text-[var(--muted)]">Contract-level bridge exposure and activity history.</p>
                  </div>
                  <div className="divide-y divide-[var(--line)]">
                    {bridgeData.rows.slice(0, 4).map((row) => (
                      <div key={`${row.bridge_address}-${row.address}`} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-4 md:items-center">
                        <div>
                          <p className="font-semibold text-[var(--ink)]">{row.bridge_name}</p>
                          <p className="text-xs text-[var(--muted)]">{shortenAddress(row.bridge_address)}</p>
                        </div>
                        <p className="text-[var(--muted)]">{row.blockchain}</p>
                        <p className="text-[var(--muted)]">{row.tx_count} tx</p>
                        <p className="font-semibold text-[var(--ink)]">{formatUsd(row.total_amount_usd)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {junctionData.length > 0 ? (
            <section className="rounded-xl border border-[var(--line)] bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Junction details</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {junctionData.map((item) => (
                  <article key={item.txHash} className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-sm">
                    <p className="font-mono text-xs uppercase tracking-[0.1em] text-[var(--muted)]">{shortenAddress(item.txHash)}</p>
                    <p className="mt-2 font-semibold text-[var(--ink)]">{shortenAddress(item.details.from.address)} → {shortenAddress(item.details.to.address)}</p>
                    <p className="mt-1 text-[var(--muted)]">{item.details.tx.method || item.details.tx.functionSignature || "Unknown method"}</p>
                    <p className="mt-2 text-[var(--muted)]">Transfers: {item.details.transfers.length} | Swaps: {item.details.swaps?.length || 0} | Social: {item.details.social?.length || 0}</p>
                    {item.details.narrative ? <p className="mt-2 text-[var(--ink)]">{item.details.narrative}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {clusterData?.clusters?.length ? (
            <section className="rounded-xl border border-[var(--line)] bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Entity clustering</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {clusterData.clusters.map((cluster) => (
                  <article key={cluster.label} className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--ink)]">{cluster.label}</p>
                        <p className="text-xs text-[var(--muted)]">{cluster.confidenceBand} confidence</p>
                      </div>
                      <p className="font-semibold text-[var(--ink)]">{cluster.confidence}%</p>
                    </div>
                    <p className="mt-2 text-[var(--muted)]">{cluster.addresses.length} addresses linked by Arkham overlap, counterparties, and transfer behavior.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {cluster.addresses.slice(0, 5).map((address) => (
                        <span key={address} className="rounded-full border border-[var(--line)] bg-white px-2 py-1 font-mono text-[11px] text-[var(--ink)]">
                          {shortenAddress(address)}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {recoveryData ? (
            <section className="rounded-xl border border-[var(--line)] bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Recovery targets</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <RecoveryBucket title="High confidence" items={recoveryData.highConfidence} tone="green" />
                <RecoveryBucket title="Medium confidence" items={recoveryData.mediumConfidence} tone="amber" />
                <RecoveryBucket title="Low confidence" items={recoveryData.lowConfidence} tone="slate" />
              </div>
              {recoveryData.notes.length > 0 ? (
                <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)]">
                  {recoveryData.notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {reportData ? (
            <section className="rounded-xl border border-[var(--line)] bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Final revelation</h2>
              <p className="mt-3 text-lg font-semibold text-[var(--ink)]">{reportData.title}</p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{reportData.narrative}</p>
              <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                {reportData.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      <footer className="mt-10 rounded-xl border border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]">
        <p>
          The manual workflow is now staged, not monolithic: genesis, first hop, bridge pivot, junction detail, clustering, recovery, and final report.
        </p>
        <p className="mt-1">
          {traceSummary?.chain ? `Primary chain: ${traceSummary.chain}. ` : ""}
          {traceSummary?.startTimestamp ? `Seed time: ${formatDateTime(traceSummary.startTimestamp)}.` : ""}
        </p>
      </footer>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-4">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function RecoveryBucket({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "green" | "amber" | "slate";
}) {
  const toneClasses = {
    green: "border-green-200 bg-green-50 text-green-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
  }[tone];

  return (
    <article className={`rounded-lg border p-4 ${toneClasses}`}>
      <p className="font-semibold">{title}</p>
      <div className="mt-3 space-y-2 text-sm">
        {items.length > 0 ? items.map((item) => <p key={item}>{item}</p>) : <p>No items identified yet.</p>}
      </div>
    </article>
  );
}

function buildRecoveryBuckets(
  traceSummary: FundFlowSummary,
  bridgeResult: BridgeAnalyzeResponse,
  clusterResult: ClusterResponse,
  junctions: Array<{ txHash: string; hop: FundFlowEdge; details: NonNullable<HopDetailsResponse["details"]> }>
) {
  const highConfidence: string[] = [];
  const mediumConfidence: string[] = [];
  const lowConfidence: string[] = [];

  for (const destination of traceSummary.topDestinations.slice(0, 5)) {
    const descriptor = `${destination.name} (${shortenAddress(destination.address)}) - ${formatUsd(destination.usd)}`;
    if (/exchange|custody|cex|bridge/i.test(`${destination.name} ${destination.type}`)) {
      highConfidence.push(descriptor);
    } else if (destination.usd >= traceSummary.totalFlowUsd * 0.2) {
      mediumConfidence.push(descriptor);
    } else {
      lowConfidence.push(descriptor);
    }
  }

  if (bridgeResult.summary?.topBridge) {
    mediumConfidence.push(`Bridge route: ${bridgeResult.summary.topBridge}`);
  }

  const bridgeRows = bridgeResult.rows || [];

  if (bridgeRows.length > 0) {
    const bridgeText = bridgeRows
      .slice(0, 2)
      .map((row) => `${row.bridge_name} on ${row.blockchain} (${formatUsd(row.total_amount_usd)})`)
      .join("; ");
    lowConfidence.push(bridgeText);
  }

  if (clusterResult.clusters?.length) {
    mediumConfidence.push(`Entity clusters identified: ${clusterResult.clusters.length}`);
    const strongest = clusterResult.clusters[0];
    if (strongest) {
      lowConfidence.push(`Strongest cluster: ${strongest.label} (${strongest.confidence}% confidence)`);
    }
  }

  if (junctions.length > 0) {
    lowConfidence.push(`Junctions inspected: ${junctions.length}`);
  }

  return {
    highConfidence: Array.from(new Set(highConfidence)).slice(0, 5),
    mediumConfidence: Array.from(new Set(mediumConfidence)).slice(0, 5),
    lowConfidence: Array.from(new Set(lowConfidence)).slice(0, 5),
    notes: [
      `Recovered workflow from ${traceSummary.nodeCount} entities and ${traceSummary.edgeCount} transfers.`,
      traceSummary.activeChains.length > 0 ? `Active chains observed: ${traceSummary.activeChains.join(", ")}.` : "No active chain diversity captured yet.",
    ],
  };
}

function buildFinalReport(
  seed: {
    walletAddress: string;
    chain: string;
    startTimestamp: number;
    stolenAmount?: number;
    txHash?: string;
    caseTitle?: string;
  },
  traceSummary: FundFlowSummary,
  bridgeResult: BridgeAnalyzeResponse,
  clusterResult: ClusterResponse,
  recoveryBuckets: ReturnType<typeof buildRecoveryBuckets>,
  junctions: Array<{ txHash: string; hop: FundFlowEdge; details: NonNullable<HopDetailsResponse["details"]> }>
) {
  const title = seed.caseTitle
    ? `${seed.caseTitle}: manual fund-flow reconstruction`
    : `Manual fund-flow reconstruction for ${shortenAddress(seed.walletAddress)}`;

  const narrative = [
    `The case begins at ${shortenAddress(seed.walletAddress)} on ${seed.chain}.`,
    `The trace surfaced ${traceSummary.edgeCount} movements across ${traceSummary.nodeCount} entities, with ${traceSummary.activeChains.length} active chains in view.`,
    bridgeResult.summary?.bridgeCount
      ? `Bridge exposure was detected across ${bridgeResult.summary.bridgeCount} bridge records, so the analyst should pivot cross-chain at that junction.`
      : "No strong bridge concentration was surfaced in the bridge scan, so the analyst should continue local hop inspection.",
    clusterResult.clusters?.length
      ? `Clustering produced ${clusterResult.clusters.length} likely entities, which is the point where wallet-level noise turns into entity-level evidence.`
      : "No confident cluster emerged yet, so the investigation stays wallet-centric.",
    recoveryBuckets.highConfidence.length > 0
      ? `The most actionable recovery candidates are: ${recoveryBuckets.highConfidence.slice(0, 2).join("; ")}.`
      : "No high-confidence freeze target has been confirmed yet.",
  ].join(" ");

  const bullets = [
    `First-hop ledger captured ${traceSummary.topDestinations.length} major destination buckets.`,
    junctions.length > 0 ? `Junction details were inspected for ${junctions.length} early hops.` : "No hop-detail enrichment was available for the current trace.",
    bridgeResult.summary?.topBridge ? `Bridge focus: ${bridgeResult.summary.topBridge}.` : "Bridge focus not yet resolved.",
    clusterResult.clusters?.length ? `Top cluster confidence: ${clusterResult.clusters[0]?.confidence}%.` : "No clustered entity with strong confidence yet.",
  ];

  return { title, narrative, bullets };
}
