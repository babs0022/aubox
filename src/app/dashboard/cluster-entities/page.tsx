"use client";

import { getActiveCaseId } from "@/lib/case-client";
import { useActiveCaseId } from "@/lib/use-active-case";
import { shortenAddress } from "@/lib/onchain-format";
import MermaidDiagram from "@/components/dashboard/MermaidDiagram";
import { useEffect, useState } from "react";

type ClusterEvidence = {
  code: string;
  label: string;
  weight: number;
  value: number;
  detail: string;
  proofs?: ClusterProof[];
};

type ClusterProof = {
  type: "tx" | "address" | "graph";
  source: string;
  label: string;
  txHash?: string;
  address?: string;
  explorerUrl?: string;
  graphRef?: string;
};

type ClusterCard = {
  label: string;
  addresses: string[];
  confidence: number;
  confidenceBand: "low" | "medium" | "high";
  evidence: ClusterEvidence[];
  sources: string[];
};

type ClusterApiResponse = {
  success?: boolean;
  jobId?: string;
  message?: string;
  strictness?: "conservative" | "balanced" | "aggressive";
  timeWindow?: "7d" | "30d" | "90d" | "180d" | "365d";
  thresholds?: { minEdgeConfidence: number };
  clusters?: ClusterCard[];
};

type ClusterJobPollResponse = {
  success?: boolean;
  job?: {
    status: "queued" | "running" | "completed" | "failed";
    result?: ClusterApiResponse | null;
    error?: string | null;
  };
};

type CaseArtifact = {
  id: string;
  tag: string;
  value: string;
  kind: "address" | "entity" | "hashtag" | "ticker" | "username" | "query" | "note";
  sourceFeature: "trace" | "cluster" | "social" | "profile" | "timeline" | "report" | "manual";
};

const explorerBaseByChain: Record<string, string> = {
  ethereum: "https://etherscan.io",
  bsc: "https://bscscan.com",
  base: "https://basescan.org",
  arbitrum: "https://arbiscan.io",
  hyperliquid: "https://hyperevmscan.io",
};

const explorerTxLink = (chain: string, txHash: string): string | undefined => {
  const base = explorerBaseByChain[chain.toLowerCase()];
  if (!base || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return undefined;
  }
  return `${base}/tx/${txHash}`;
};

const explorerAddressLink = (chain: string, address: string): string | undefined => {
  const base = explorerBaseByChain[chain.toLowerCase()];
  if (!base || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return undefined;
  }
  return `${base}/address/${address}`;
};

export default function ClusterEntitiesPage() {
  const activeCaseIdHook = useActiveCaseId();
  const [seedInput, setSeedInput] = useState("");
  const [chain, setChain] = useState("base");
  const [strictness, setStrictness] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [timeWindow, setTimeWindow] = useState<"7d" | "30d" | "90d" | "180d" | "365d">("30d");
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState<ClusterApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRunSeeds, setLastRunSeeds] = useState<string[]>([]);
  const [artifactSuggestions, setArtifactSuggestions] = useState<CaseArtifact[]>([]);
  const [artifactLoading, setArtifactLoading] = useState(false);

  const activeCaseId = activeCaseIdHook || getActiveCaseId();

  const parseArtifactTokenFromInput = (input: string): string | null => {
    const caretCandidate = input.match(/(?:^|[\s,])(@[a-zA-Z0-9_-]+)$/);
    return caretCandidate ? caretCandidate[1] : null;
  };

  const replaceArtifactToken = (input: string, token: string, replacement: string): string => {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return input.replace(new RegExp(`${escapedToken}$`), replacement);
  };

  const saveSeedArtifacts = async (seedAddresses: string[]) => {
    if (!activeCaseId) {
      return;
    }

    await Promise.all(
      seedAddresses.map((address) =>
        fetch(`/api/cases/${activeCaseId}/artifacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            value: address,
            kind: "address",
            sourceFeature: "cluster",
            aliases: [shortenAddress(address)],
            metadata: { chain, strictness, timeWindow },
          }),
        }).catch(() => {
          // Non-blocking persistence.
        })
      )
    );
  };

  const clusterCount = result?.clusters?.length || 0;
  const linkedAddressCount = result?.clusters
    ? new Set(result.clusters.flatMap((cluster) => cluster.addresses.map((addr) => addr.toLowerCase()))).size
    : 0;
  const largestCluster = result?.clusters?.reduce((max, item) => Math.max(max, item.addresses.length), 0) || 0;
  const avgConfidence =
    result?.clusters && result.clusters.length
      ? Math.round(result.clusters.reduce((sum, item) => sum + item.confidence, 0) / result.clusters.length)
      : 0;

  const clusterDisplayLabel = (label: string, index: number) => {
    const normalized = label.trim().toLowerCase();
    if (normalized.startsWith("likely_entity_")) {
      return `Linked Wallet Group ${index + 1}`;
    }
    return label.replace(/_/g, " ");
  };

  const confidenceNarrative = (value: number, band: "low" | "medium" | "high") => {
    if (band === "high") {
      return `${value} (${band}) - strong linkage signal`;
    }
    if (band === "medium") {
      return `${value} (${band}) - moderate linkage signal`;
    }
    return `${value} (${band}) - preliminary linkage signal`;
  };

  const evidenceHeadline = (item: ClusterEvidence) => {
    if (item.code === "counterpartyOverlap") {
      return `Both wallets repeatedly interact with the same outside wallets (${item.value} shared links).`;
    }
    if (item.code === "syncBehavior") {
      return `Both wallets move through a similar wallet network pattern (${item.value} shared neighbors).`;
    }
    if (item.code === "directTransfers") {
      return "The wallets transact directly with each other.";
    }
    if (item.code === "arkhamCluster") {
      return "External intelligence indicates overlap in entity context.";
    }
    return item.detail;
  };

  const proofSourceLabel = (source: string) => {
    if (source === "counterparties") return "Onchain Link Evidence";
    if (source === "transfers") return "Onchain Transaction Evidence";
    if (source === "arkham") return "External Intelligence Evidence";
    return source;
  };

  const compactHash = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-8)}`;

  const proofHref = (proof: ClusterProof) => {
    if (proof.explorerUrl) {
      return proof.explorerUrl;
    }
    if (proof.txHash) {
      return explorerTxLink(chain, proof.txHash);
    }
    if (proof.address) {
      return explorerAddressLink(chain, proof.address);
    }
    return undefined;
  };

  const buildProofPackJson = () => {
    if (!result) {
      return null;
    }

    return {
      generatedAt: new Date().toISOString(),
      feature: "cluster-entities",
      chain,
      strictness: result.strictness || strictness,
      timeWindow: result.timeWindow || timeWindow,
      thresholds: result.thresholds || null,
      summary: {
        clustersFound: clusterCount,
        linkedAddresses: linkedAddressCount,
        largestCluster,
        avgConfidence,
      },
      clusters: (result.clusters || []).map((cluster) => ({
        label: cluster.label,
        confidence: cluster.confidence,
        confidenceBand: cluster.confidenceBand,
        addresses: cluster.addresses,
        evidence: cluster.evidence.map((item) => ({
          code: item.code,
          label: item.label,
          weight: item.weight,
          value: item.value,
          detail: item.detail,
          proofs: item.proofs || [],
        })),
      })),
    };
  };

  const buildProofPackMarkdown = () => {
    if (!result) {
      return "";
    }

    const lines: string[] = [
      "# Wallet Link Proof Pack",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Chain: ${chain}`,
      `Strictness: ${result.strictness || strictness}`,
      `Time Window: ${result.timeWindow || timeWindow}`,
      "",
      "## Summary",
      `- Clusters Found: ${clusterCount}`,
      `- Linked Addresses: ${linkedAddressCount}`,
      `- Largest Cluster: ${largestCluster}`,
      `- Average Confidence: ${avgConfidence}`,
      "",
      "## Wallet Link Findings",
      "",
    ];

    for (const [clusterIndex, cluster] of (result.clusters || []).entries()) {
      lines.push(`### ${clusterDisplayLabel(cluster.label, clusterIndex)}`);
      lines.push(`- Confidence: ${confidenceNarrative(cluster.confidence, cluster.confidenceBand)}`);
      lines.push(`- Linked Wallets: ${cluster.addresses.length}`);
      lines.push("");
      lines.push("#### Wallet Set");
      for (const address of cluster.addresses) {
        lines.push(`- ${address}`);
      }
      lines.push("");
      lines.push("#### Why This Link Is Likely");

      for (const item of cluster.evidence) {
        lines.push(`- ${evidenceHeadline(item)}`);
        lines.push(`  - Weight: ${item.weight}`);
        lines.push(`  - Supporting Count: ${item.value}`);

        if (item.proofs && item.proofs.length > 0) {
          lines.push("  - Verifiable Proof:");
          for (const proof of item.proofs) {
            const hashLabel = proof.txHash ? compactHash(proof.txHash) : "";
            const proofParts = [
              `[${proofSourceLabel(proof.source)}] ${hashLabel || proof.label}`,
              proof.txHash ? `tx=${proof.txHash}` : "",
              proof.address ? `address=${proof.address}` : "",
              proof.graphRef ? `graph=${proof.graphRef}` : "",
              proof.explorerUrl ? `url=${proof.explorerUrl}` : "",
            ].filter((part) => part.length > 0);
            lines.push(`    - ${proofParts.join(" | ")}`);
          }
        }
      }

      lines.push("");
    }

    return lines.join("\n");
  };

  const downloadProofPackJson = () => {
    const payload = buildProofPackJson();
    if (!payload) {
      return;
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cluster-proof-pack-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadProofPackMarkdown = () => {
    const markdown = buildProofPackMarkdown();
    if (!markdown) {
      return;
    }

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cluster-proof-pack-${Date.now()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const clusterRelationshipChart = (() => {
    if (!result?.clusters || result.clusters.length === 0) {
      return "";
    }

    const lines: string[] = [
      "flowchart LR",
      "classDef cluster fill:#0a6e5d,stroke:#07584b,color:#ffffff,stroke-width:1px",
      "classDef wallet fill:#f5faf9,stroke:#2f8577,color:#0f2e2a,stroke-width:1px",
    ];

    const addressNodeIds = new Map<string, string>();
    let addressIndex = 0;

    result.clusters.slice(0, 8).forEach((cluster, clusterIndex) => {
      const clusterId = `c${clusterIndex}`;
      const clusterLabel = `${cluster.label.replace(/\"/g, "'")} (${cluster.confidence}%)`;

      lines.push(`${clusterId}[\"${clusterLabel}\"]:::cluster`);

      cluster.addresses.slice(0, 8).forEach((address) => {
        const key = address.toLowerCase();
        let addressId = addressNodeIds.get(key);

        if (!addressId) {
          addressId = `a${addressIndex++}`;
          addressNodeIds.set(key, addressId);
          lines.push(`${addressId}[\"${shortenAddress(address)}\"]:::wallet`);
        }

        lines.push(`${clusterId} -->|${cluster.confidenceBand}| ${addressId}`);
      });
    });

    return lines.join("\n");
  })();

  const chains = ["ethereum", "bsc", "base", "arbitrum", "hyperliquid"];

  const saveCaseEvent = async (data: ClusterApiResponse, seedAddresses: string[]) => {
    const activeCaseId = activeCaseIdHook || getActiveCaseId();
    if (!activeCaseId) {
      return;
    }

    const clusterNodes = (data.clusters || []).map((cluster) => ({
      id: `cluster_${cluster.label}`,
      label: `${cluster.label} (${cluster.confidence})`,
      type: "cluster",
    }));
    const seedNodes = seedAddresses.map((address) => ({ id: address, label: address, type: "address" }));

    const clusterEdges = (data.clusters || []).flatMap((cluster) =>
      cluster.addresses.map((address) => ({
        source: `cluster_${cluster.label}`,
        target: address,
        label: `${cluster.confidenceBand}:${cluster.confidence}`,
      }))
    );

    await fetch(`/api/cases/${activeCaseId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature: "cluster",
        title: `Clustered ${seedAddresses.length} seed address(es)`,
        narrative: data.message || `Cluster analysis complete with ${data.clusters?.length || 0} discovered groups.`,
        metrics: {
          seedCount: seedAddresses.length,
          clusterCount: data.clusters?.length || 0,
          confidenceAvg:
            data.clusters && data.clusters.length
              ? Math.round(data.clusters.reduce((sum, item) => sum + item.confidence, 0) / data.clusters.length)
              : 0,
          hasJob: data.jobId ? 1 : 0,
        },
        nodes: [...seedNodes, ...clusterNodes],
        edges: clusterEdges,
      }),
    }).catch(() => {
      // Non-blocking persistence.
    });
  };

  const run = async () => {
    const seedAddresses = seedInput
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean);

    setLastRunSeeds(seedAddresses);

    if (seedAddresses.length === 0) {
      setError("Enter at least one address.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      await saveSeedArtifacts(seedAddresses);

      const response = await fetch("/api/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedAddresses, chain, strictness, timeWindow }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Cluster failed (${response.status})`);
      }

      const data = (await response.json()) as ClusterApiResponse;
      setResult(data);
      if (!data.jobId) {
        await saveCaseEvent(data, seedAddresses);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cluster failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = parseArtifactTokenFromInput(seedInput.trim());
    if (!activeCaseId || !token || token.length < 2) {
      setArtifactSuggestions([]);
      return;
    }

    let cancelled = false;
    setArtifactLoading(true);

    const runLookup = async () => {
      try {
        const query = token.slice(1);
        const response = await fetch(`/api/cases/${activeCaseId}/artifacts?q=${encodeURIComponent(query)}&limit=8`, {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as { artifacts?: CaseArtifact[] };
        if (!cancelled) {
          setArtifactSuggestions(body.artifacts || []);
        }
      } finally {
        if (!cancelled) {
          setArtifactLoading(false);
        }
      }
    };

    void runLookup();
    return () => {
      cancelled = true;
    };
  }, [seedInput, activeCaseId]);

  useEffect(() => {
    if (!result?.jobId) {
      setPolling(false);
      return;
    }

    let cancelled = false;
    setPolling(true);

    const poll = async () => {
      if (cancelled || !result.jobId) return;

      try {
        const response = await fetch(`/api/jobs/${result.jobId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to poll job (${response.status})`);
        }

        const data = (await response.json()) as ClusterJobPollResponse;
        const status = data.job?.status;

        if (!status || status === "queued" || status === "running") {
          setTimeout(poll, 2500);
          return;
        }

        if (status === "failed") {
          setPolling(false);
          setError(data.job?.error || "Cluster job failed");
          return;
        }

        const completed = {
          ...result,
          ...(data.job?.result || {}),
          jobId: result.jobId,
        } as ClusterApiResponse;

        setResult(completed);
        setPolling(false);
        await saveCaseEvent(completed, lastRunSeeds);
      } catch {
        setTimeout(poll, 3000);
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [result?.jobId]);

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Feature 03</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Cluster Entities</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Group likely co-controlled addresses with confidence-scored evidence.</p>

      <div className="relative mt-6">
        <textarea
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          placeholder="Paste one address per line or comma-separated. Use @artifact-tag to recall saved entries"
          className="min-h-[120px] w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-mono text-sm"
        />
        {artifactSuggestions.length > 0 || artifactLoading ? (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[var(--line)] bg-white shadow-sm">
            {artifactLoading ? <p className="px-3 py-2 text-xs text-[var(--muted)]">Loading artifacts...</p> : null}
            {artifactSuggestions.map((item) => {
              const token = parseArtifactTokenFromInput(seedInput.trim());
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (!token) return;
                    const replaced = replaceArtifactToken(seedInput.trim(), token, item.value);
                    setSeedInput(replaced + "\n");
                    setArtifactSuggestions([]);
                  }}
                  className="flex w-full items-start justify-between gap-3 border-t border-[var(--line)] px-3 py-2 text-left first:border-t-0 hover:bg-[var(--paper)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs font-semibold text-[var(--ink)]">@{item.tag}</span>
                    <span className="block truncate font-mono text-[11px] text-[var(--muted)]">{item.value}</span>
                  </span>
                  <span className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--muted)]">{item.kind}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-3 max-w-xs">
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Chain</label>
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        >
          {chains.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Strictness</label>
          <select
            value={strictness}
            onChange={(e) => setStrictness(e.target.value as "conservative" | "balanced" | "aggressive")}
            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            <option value="conservative">Conservative (higher confidence)</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive (wider net)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Time Window</label>
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value as "7d" | "30d" | "90d" | "180d" | "365d")}
            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="180d">Last 180 days</option>
            <option value="365d">Last 365 days</option>
          </select>
        </div>
      </div>

      <button
        onClick={run}
        disabled={loading}
        className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
      >
        {loading ? "Clustering..." : "Run Clustering"}
      </button>

      {error ? <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {result ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Cluster Summary</p>
            <p className="mt-2 text-sm text-[var(--ink)]">
              {result.message || "Cluster analysis completed."} Review: {result.strictness || strictness} confidence filter, {result.timeWindow || timeWindow} evidence window.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={downloadProofPackMarkdown}
                className="rounded-lg border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--paper)]"
              >
                Download Proof Pack (.md)
              </button>
              <button
                onClick={downloadProofPackJson}
                className="rounded-lg border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--paper)]"
              >
                Download Proof Pack (.json)
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Clusters Found</p>
              <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{clusterCount}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Linked Addresses</p>
              <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{linkedAddressCount}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Largest Cluster</p>
              <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{largestCluster}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Avg Confidence</p>
              <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{avgConfidence}</p>
            </div>
          </div>

          {result.jobId ? (
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Async Job Status</p>
              <p className="mt-2 break-all font-mono text-xs text-[var(--ink)]">{result.jobId}</p>
              <div className="mt-4 h-2 rounded-full bg-[var(--line)]">
                <div className={`h-2 rounded-full bg-[var(--accent)] ${polling ? "w-1/3 animate-pulse" : "w-full"}`} />
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">{polling ? "Processing..." : "Completed"}</p>
            </div>
          ) : null}

          {result.clusters && result.clusters.length > 0 ? (
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Cluster Relationship Map</p>
              <div className="mt-4">
                <MermaidDiagram chart={clusterRelationshipChart} />
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">Map shows up to 8 clusters and up to 8 addresses per cluster.</p>
            </div>
          ) : null}

          {result.clusters && result.clusters.length > 0 ? (
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Cluster Size Breakdown</p>
              <div className="mt-3 space-y-3">
                {result.clusters.map((cluster) => {
                  const width = Math.min(100, cluster.addresses.length * 20);
                  return (
                      <div key={cluster.label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                          <span>{clusterDisplayLabel(cluster.label, result.clusters?.indexOf(cluster) || 0)}</span>
                          <span>{cluster.addresses.length} wallets</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--line)]">
                        <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {result.clusters && result.clusters.length > 0 ? (
            <div className="space-y-3">
              {result.clusters.map((cluster, clusterIndex) => (
                <div key={cluster.label} className="rounded-xl border border-[var(--line)] bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Finding</p>
                      <h3 className="mt-1 text-lg font-semibold text-[var(--ink)]">{clusterDisplayLabel(cluster.label, clusterIndex)}</h3>
                    </div>
                    <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold">
                      {cluster.addresses.length} wallets linked
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-2 text-xs">
                      <p className="text-[var(--muted)]">Confidence</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{confidenceNarrative(cluster.confidence, cluster.confidenceBand)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-2 text-xs sm:col-span-2">
                      <p className="text-[var(--muted)]">Key Reasons</p>
                      <p className="mt-1 text-sm text-[var(--ink)]">
                        {cluster.evidence.slice(0, 2).map((item) => evidenceHeadline(item)).join(" ") || "No evidence details available."}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-[var(--muted)]">Linked Wallets</p>
                  <div className="mt-2 space-y-2">
                    {cluster.addresses.map((addr) => (
                      <p key={addr} className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-2 font-mono text-xs">
                        {explorerAddressLink(chain, addr) ? (
                          <a href={explorerAddressLink(chain, addr)} target="_blank" rel="noreferrer" className="onchain-link">
                            {shortenAddress(addr)}
                          </a>
                        ) : (
                          shortenAddress(addr)
                        )}
                      </p>
                    ))}
                  </div>

                  {cluster.evidence.length ? (
                    <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                      <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Why This Link Is Likely</p>
                      <div className="mt-2 space-y-2">
                        {cluster.evidence.map((item) => (
                          <div key={`${cluster.label}_${item.code}`} className="rounded border border-[var(--line)] bg-white p-2">
                            <p className="text-xs text-[var(--ink)]">
                              <span className="font-semibold">Finding:</span> {evidenceHeadline(item)}
                            </p>
                            <p className="mt-1 text-[11px] text-[var(--muted)]">
                              Strength weight {item.weight}; supporting count {item.value}
                            </p>
                            {item.proofs && item.proofs.length > 0 ? (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Evidence You Can Verify</p>
                                {item.proofs.slice(0, 6).map((proof, proofIndex) => (
                                  <p key={`${cluster.label}_${item.code}_${proofIndex}`} className="text-[11px] text-[var(--ink)]">
                                    <span className="font-semibold">[{proofSourceLabel(proof.source)}]</span> {proofHref(proof) ? (
                                      <a
                                        href={proofHref(proof)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="onchain-link"
                                      >
                                        {proof.txHash ? compactHash(proof.txHash) : proof.label}
                                      </a>
                                    ) : (
                                      <span>{proof.txHash ? compactHash(proof.txHash) : proof.label}</span>
                                    )}
                                    {proof.graphRef ? <span className="text-[var(--muted)]"> ({proof.graphRef})</span> : null}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {result.clusters && result.clusters.length === 0 ? (
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-sm text-[var(--muted)]">
                No wallet groups met the selected confidence filter and evidence window.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
