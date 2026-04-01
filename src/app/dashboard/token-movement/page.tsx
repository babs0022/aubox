"use client";

import { getActiveCaseId } from "@/lib/case-client";
import { useActiveCaseId } from "@/lib/use-active-case";
import { shortenAddress } from "@/lib/onchain-format";
import { useMemo, useState } from "react";

type TokenMovementIntel = {
  chain: string;
  tokenAddress: string;
  sampledFromBlock: string;
  sampledToBlock: string;
  transferEventCount: number;
  estimatedHolderCount: number;
  uniqueSenders: number;
  uniqueReceivers: number;
  totalTransferredRaw: string;
  market: {
    liquidityUsd: number | null;
    volume24hUsd: number | null;
    riskLevel: "unknown" | "low" | "medium" | "high" | "critical";
    riskScore: number | null;
  };
  walletRelation?: {
    wallet: string;
    inboundTransfers: number;
    outboundTransfers: number;
    netDirection: "inflow" | "outflow" | "neutral";
    inboundRaw: string;
    outboundRaw: string;
    netRaw: string;
  };
  topCounterparties: Array<{
    address: string;
    interactions: number;
  }>;
};

type TokenMovementResponse = {
  success?: boolean;
  message?: string;
  intel?: TokenMovementIntel;
};

const formatUsd = (value: number | null): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
};

const humanizeHex = (value: string): string => {
  if (!value || !/^0x[0-9a-fA-F]+$/.test(value)) return "N/A";
  return Number.parseInt(value, 16).toLocaleString();
};

const isEvmAddress = (value: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(value);

const EXPLORER_BASE_BY_CHAIN: Record<string, string> = {
  ethereum: "https://etherscan.io",
  bsc: "https://bscscan.com",
  base: "https://basescan.org",
  arbitrum: "https://arbiscan.io",
};

const getAddressExplorerUrl = (chain: string, address: string): string | null => {
  const base = EXPLORER_BASE_BY_CHAIN[chain.toLowerCase()];
  if (!base || !isEvmAddress(address)) {
    return null;
  }
  return `${base}/address/${address}`;
};

export default function TokenMovementPage() {
  const activeCaseIdHook = useActiveCaseId();
  const activeCaseId = activeCaseIdHook || getActiveCaseId();

  const [tokenAddress, setTokenAddress] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [lookbackBlocks, setLookbackBlocks] = useState(4000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TokenMovementResponse | null>(null);

  const chains = ["ethereum", "bsc", "base", "arbitrum", "hyperliquid"];

  const hasWalletContext = walletAddress.trim().length > 0;

  const riskColorClass = useMemo(() => {
    const level = result?.intel?.market.riskLevel;
    if (level === "critical") return "bg-red-100 text-red-700";
    if (level === "high") return "bg-orange-100 text-orange-700";
    if (level === "medium") return "bg-yellow-100 text-yellow-700";
    if (level === "low") return "bg-green-100 text-green-700";
    return "bg-slate-100 text-slate-700";
  }, [result?.intel?.market.riskLevel]);

  const saveCaseEvent = async (intel: TokenMovementIntel) => {
    if (!activeCaseId) {
      return;
    }

    const nodes = [
      { id: intel.tokenAddress, label: intel.tokenAddress, type: "token" },
      ...(intel.walletRelation ? [{ id: intel.walletRelation.wallet, label: intel.walletRelation.wallet, type: "address" }] : []),
    ];

    const edges = intel.walletRelation
      ? [
          {
            source: intel.walletRelation.wallet,
            target: intel.tokenAddress,
            label: intel.walletRelation.netDirection,
          },
        ]
      : [];

    await fetch(`/api/cases/${activeCaseId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature: "token",
        title: `Token movement scan ${shortenAddress(intel.tokenAddress)}`,
        narrative: `Observed ${intel.transferEventCount} transfer events and ~${intel.estimatedHolderCount} holders in sampled range on ${intel.chain}.`,
        metrics: {
          transferEventCount: intel.transferEventCount,
          estimatedHolderCount: intel.estimatedHolderCount,
          uniqueSenders: intel.uniqueSenders,
          uniqueReceivers: intel.uniqueReceivers,
          lookbackBlocks,
          walletNetDirection: intel.walletRelation?.netDirection || "none",
        },
        nodes,
        edges,
      }),
    }).catch(() => {
      // non-blocking persistence
    });

    await fetch(`/api/cases/${activeCaseId}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: intel.tokenAddress,
        kind: "address",
        sourceFeature: "token",
        metadata: {
          chain: intel.chain,
          holders: intel.estimatedHolderCount,
          volume24hUsd: intel.market.volume24hUsd || 0,
        },
      }),
    }).catch(() => {
      // non-blocking persistence
    });
  };

  const run = async () => {
    const normalizedToken = tokenAddress.trim();
    const normalizedWallet = walletAddress.trim();

    if (!isEvmAddress(normalizedToken)) {
      setError("Enter a valid token contract address.");
      return;
    }

    if (normalizedWallet && !isEvmAddress(normalizedWallet)) {
      setError("Wallet address must be a valid EVM address.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/token/movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: normalizedToken,
          walletAddress: normalizedWallet || undefined,
          chain,
          lookbackBlocks,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Token movement failed (${response.status})`);
      }

      const data = (await response.json()) as TokenMovementResponse;
      setResult(data);
      if (data.intel) {
        await saveCaseEvent(data.intel);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze token movement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Feature 09</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Token Movement</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Track token holder activity, transfer volume, and wallet-specific movement in relation to a token contract.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <input
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          placeholder="Token contract address (0x...)"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-mono text-sm sm:col-span-2"
        />
        <input
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          placeholder="Wallet address (optional)"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-mono text-sm sm:col-span-2"
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
        <input
          type="number"
          min={500}
          max={20000}
          value={lookbackBlocks}
          onChange={(e) => setLookbackBlocks(Math.max(500, Math.min(20000, Number(e.target.value) || 4000)))}
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2"
        />
      </div>

      <button
        onClick={run}
        disabled={loading}
        className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
      >
        {loading ? "Analyzing..." : "Analyze Token Movement"}
      </button>

      {error ? <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {result?.intel ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Token Summary</p>
            <p className="mt-1 text-sm text-[var(--ink)]">
              {(() => {
                const tokenUrl = getAddressExplorerUrl(result.intel.chain, result.intel.tokenAddress);
                return tokenUrl ? (
                  <>
                    <a href={tokenUrl} target="_blank" rel="noreferrer" className="onchain-link" title={result.intel.tokenAddress}>
                      {shortenAddress(result.intel.tokenAddress)}
                    </a>{" "}
                    on {result.intel.chain} sampled from block {humanizeHex(result.intel.sampledFromBlock)} to {humanizeHex(result.intel.sampledToBlock)}.
                  </>
                ) : (
                  <>
                    {shortenAddress(result.intel.tokenAddress)} on {result.intel.chain} sampled from block {humanizeHex(result.intel.sampledFromBlock)} to {humanizeHex(result.intel.sampledToBlock)}.
                  </>
                );
              })()}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Transfer Events</p>
              <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{result.intel.transferEventCount.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Estimated Holders</p>
              <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{result.intel.estimatedHolderCount.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Unique Senders</p>
              <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{result.intel.uniqueSenders.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Unique Receivers</p>
              <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{result.intel.uniqueReceivers.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">24h Volume (USD)</p>
              <p className="mt-1 text-xl font-bold text-[var(--ink)]">{formatUsd(result.intel.market.volume24hUsd)}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Liquidity (USD)</p>
              <p className="mt-1 text-xl font-bold text-[var(--ink)]">{formatUsd(result.intel.market.liquidityUsd)}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">Token Risk</p>
              <p className="mt-1">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${riskColorClass}`}>
                  {result.intel.market.riskLevel} {typeof result.intel.market.riskScore === "number" ? `(${result.intel.market.riskScore})` : ""}
                </span>
              </p>
            </div>
          </div>

          {hasWalletContext && result.intel.walletRelation ? (
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Wallet Relation To Token</p>
              <p className="mt-1 text-sm text-[var(--ink)]">
                {(() => {
                  const walletUrl = getAddressExplorerUrl(result.intel.chain, result.intel.walletRelation.wallet);
                  return walletUrl ? (
                    <a href={walletUrl} target="_blank" rel="noreferrer" className="onchain-link" title={result.intel.walletRelation?.wallet}>
                      {shortenAddress(result.intel.walletRelation.wallet)}
                    </a>
                  ) : (
                    shortenAddress(result.intel.walletRelation.wallet)
                  );
                })()}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                  <p className="text-xs text-[var(--muted)]">Inbound Transfers</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{result.intel.walletRelation.inboundTransfers}</p>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                  <p className="text-xs text-[var(--muted)]">Outbound Transfers</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{result.intel.walletRelation.outboundTransfers}</p>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                  <p className="text-xs text-[var(--muted)]">Net Direction</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{result.intel.walletRelation.netDirection}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Top Counterparties</p>
            <div className="mt-2 space-y-2">
              {result.intel.topCounterparties.length > 0 ? (
                result.intel.topCounterparties.map((row) => (
                  <div key={row.address} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--paper)] p-2">
                    <p className="font-mono text-xs text-[var(--ink)]">
                      {(() => {
                        const counterpartyUrl = getAddressExplorerUrl(result.intel?.chain || chain, row.address);
                        return counterpartyUrl ? (
                          <a href={counterpartyUrl} target="_blank" rel="noreferrer" className="onchain-link" title={row.address}>
                            {shortenAddress(row.address)}
                          </a>
                        ) : (
                          shortenAddress(row.address)
                        );
                      })()}
                    </p>
                    <p className="text-xs font-semibold text-[var(--muted)]">{row.interactions} interaction(s)</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">No counterparties found in sampled window.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
