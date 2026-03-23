"use client";

import { getActiveCaseId } from "@/lib/case-client";
import { useActiveCaseId } from "@/lib/use-active-case";
import { formatHexTokenAmount, shortenAddress } from "@/lib/onchain-format";
import { useEffect, useState } from "react";

type WalletProfile = {
  address: string;
  chain: string;
  arkhamLabels: string[];
  arkhamRisk: number | null;
  txCount: number;
  balanceHex: string | null;
  sources: {
    arkham: boolean;
    rpc: boolean;
  };
};

type ProfileApiResponse = {
  success?: boolean;
  message?: string;
  profile?: WalletProfile;
};

type CaseArtifact = {
  id: string;
  tag: string;
  value: string;
  kind: "address" | "entity" | "hashtag" | "ticker" | "username" | "query" | "note";
};

const formatRiskLevel = (risk: number | null): string => {
  if (risk === null) return "unknown";
  if (risk >= 75) return "high";
  if (risk >= 40) return "medium";
  return "low";
};

export default function ProfileAddressPage() {
  const activeCaseIdHook = useActiveCaseId();
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProfileApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [artifactSuggestions, setArtifactSuggestions] = useState<CaseArtifact[]>([]);
  const [artifactLoading, setArtifactLoading] = useState(false);

  const chains = ["ethereum", "bsc", "base", "arbitrum", "hyperliquid"];

  const parseArtifactTokenFromInput = (input: string): string | null => {
    const candidate = input.match(/(?:^|[\s,])(@[a-zA-Z0-9_-]+)$/);
    return candidate ? candidate[1] : null;
  };

  const replaceArtifactToken = (input: string, token: string, replacement: string): string => {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return input.replace(new RegExp(`${escapedToken}$`), replacement);
  };

  const saveProfileArtifact = async (artifactValue: string, artifactChain: string) => {
    const activeCaseId = activeCaseIdHook || getActiveCaseId();
    if (!activeCaseId || !artifactValue.trim()) {
      return;
    }

    await fetch(`/api/cases/${activeCaseId}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: artifactValue,
        kind: "address",
        sourceFeature: "profile",
        aliases: [shortenAddress(artifactValue)],
        metadata: {
          chain: artifactChain,
        },
      }),
    }).catch(() => {
      // Non-blocking persistence.
    });
  };

  useEffect(() => {
    const activeCaseId = activeCaseIdHook || getActiveCaseId();
    const token = parseArtifactTokenFromInput(address.trim());
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
          setArtifactSuggestions(Array.isArray(body.artifacts) ? body.artifacts : []);
        }
      } finally {
        if (!cancelled) {
          setArtifactLoading(false);
        }
      }
    };

    runLookup().catch(() => {
      if (!cancelled) {
        setArtifactSuggestions([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [address, activeCaseIdHook]);

  const saveCaseEvent = async (data: ProfileApiResponse) => {
    const activeCaseId = activeCaseIdHook || getActiveCaseId();
    if (!activeCaseId || !data.profile) {
      return;
    }

    const labelNodes = data.profile.arkhamLabels.map((label) => ({
      id: `label_${label}`,
      label,
      type: "label",
    }));

    const nodes = [
      { id: data.profile.address, label: data.profile.address, type: "address" },
      ...labelNodes,
    ];

    const edges = labelNodes.map((labelNode) => ({
      source: data.profile!.address,
      target: labelNode.id,
      label: "attributed",
    }));

    await fetch(`/api/cases/${activeCaseId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature: "profile",
        title: `Profiled ${data.profile.address.slice(0, 10)}... on ${data.profile.chain}`,
        narrative: `Risk ${formatRiskLevel(data.profile.arkhamRisk)} with ${data.profile.arkhamLabels.length} labels and ${data.profile.txCount} observed transactions.`,
        metrics: {
          riskScore: data.profile.arkhamRisk ?? -1,
          labelCount: data.profile.arkhamLabels.length,
          txCount: data.profile.txCount,
        },
        nodes,
        edges,
      }),
    }).catch(() => {
      // Non-blocking persistence.
    });
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const activeCaseId = activeCaseIdHook || getActiveCaseId();
      let resolvedAddress = address.trim();
      if (activeCaseId && resolvedAddress.startsWith("@")) {
        const lookupResponse = await fetch(
          `/api/cases/${activeCaseId}/artifacts?q=${encodeURIComponent(resolvedAddress.slice(1))}&limit=1`,
          { cache: "no-store" }
        );
        if (lookupResponse.ok) {
          const lookupBody = (await lookupResponse.json()) as { artifacts?: CaseArtifact[] };
          const first = lookupBody.artifacts && lookupBody.artifacts.length > 0 ? lookupBody.artifacts[0] : null;
          if (first?.value) {
            resolvedAddress = first.value;
          }
        }
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: resolvedAddress, chain }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Profile failed (${response.status})`);
      }

      const data = (await response.json()) as ProfileApiResponse;
      setResult(data);
      await saveCaseEvent(data);
      if (data.profile) {
        await saveProfileArtifact(data.profile.address, data.profile.chain);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profile failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Feature 01</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Profile Address</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Build a wallet dossier with labels, risk signals, and onchain activity.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x... or @artifact"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-mono text-sm"
        />
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value)}
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2"
        >
          {chains.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
        >
          {loading ? "Profiling..." : "Run Profile"}
        </button>
      </div>

      {artifactSuggestions.length > 0 ? (
        <div className="mt-2 rounded-lg border border-[var(--line)] bg-white p-2">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">Case Artifact Suggestions</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {artifactSuggestions.map((artifact) => (
              <button
                key={artifact.id}
                onClick={() => {
                  const token = parseArtifactTokenFromInput(address.trim()) || "";
                  if (!token) return;
                  setAddress(replaceArtifactToken(address.trim(), token, artifact.value));
                  setArtifactSuggestions([]);
                }}
                className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-1 text-xs hover:border-[var(--accent)]"
              >
                @{artifact.tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {artifactLoading ? <p className="mt-1 text-xs text-[var(--muted)]">Loading artifact suggestions...</p> : null}

      {error ? <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {result?.profile ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Analyst Summary</p>
            <p className="mt-2 text-sm text-[var(--ink)]">
              Address {shortenAddress(result.profile.address)} on {result.profile.chain} shows {result.profile.txCount.toLocaleString()} observed
              transactions with a {formatRiskLevel(result.profile.arkhamRisk)} risk posture and
              {" "}
              {result.profile.arkhamLabels.length} attributed labels.
            </p>
            {result.message ? <p className="mt-2 text-xs text-[var(--muted)]">{result.message}</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Risk Score</p>
              <p className="mt-2 text-2xl font-bold text-[var(--ink)]">
                {result.profile.arkhamRisk === null ? "N/A" : result.profile.arkhamRisk}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Label Count</p>
              <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{result.profile.arkhamLabels.length}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Transactions</p>
              <p className="mt-2 text-2xl font-bold text-[var(--ink)]">{result.profile.txCount.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Data Coverage</p>
              <p className="mt-2 text-2xl font-bold text-[var(--ink)]">
                {(result.profile.sources.arkham ? 1 : 0) + (result.profile.sources.rpc ? 1 : 0)}/2
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Onchain Balance</p>
            <p className="mt-2 text-lg font-semibold text-[var(--ink)]">
              {formatHexTokenAmount(result.profile.balanceHex, 18, result.profile.chain === "ethereum" ? "ETH" : "native")}
            </p>
            <p className="mt-1 font-mono text-xs text-[var(--muted)]">Raw: {result.profile.balanceHex || "N/A"}</p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Source Breakdown</p>
            <div className="mt-3 space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span>Arkham Enrichment</span>
                  <span>{result.profile.sources.arkham ? "available" : "missing"}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--line)]">
                  <div
                    className="h-2 rounded-full bg-[var(--accent)]"
                    style={{ width: result.profile.sources.arkham ? "100%" : "0%" }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span>Chain RPC Data</span>
                  <span>{result.profile.sources.rpc ? "available" : "missing"}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--line)]">
                  <div
                    className="h-2 rounded-full bg-[var(--accent)]"
                    style={{ width: result.profile.sources.rpc ? "100%" : "0%" }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Attributed Labels</p>
            {result.profile.arkhamLabels.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {result.profile.arkhamLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-1 text-xs font-semibold"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">No labels returned for this address.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
