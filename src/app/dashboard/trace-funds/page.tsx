"use client";

import { getActiveCaseId } from "@/lib/case-client";
import { useActiveCaseId } from "@/lib/use-active-case";
import { formatHexInteger, formatOnchainValue, shortenAddress } from "@/lib/onchain-format";
import MermaidDiagram from "@/components/dashboard/MermaidDiagram";
import { useEffect, useMemo, useState } from "react";

type TraceApiResponse = {
  success?: boolean;
  jobId?: string;
  message?: string;
  estimatedTime?: string;
  trace?: unknown;
  fallback?: {
    txCountHex?: string | null;
  } | null;
};

type BridgeSignalSummary = {
  txHash: string;
  from: string;
  to: string;
  sourceChain: string;
  inferredDestinationChain: string | null;
  bridgeProtocol: string | null;
  confidence: number;
  tokenSymbol: string;
  valueUsd: number | null;
  riskLevel: "low" | "medium" | "high" | "critical" | "unknown";
  riskScore: number | null;
};

type CrossChainSummary = {
  bridgeSignalsCount: number;
  highConfidenceSignals: number;
  inferredDestinationChains: string[];
  bridgeSignals: BridgeSignalSummary[];
  providerCoverage?: {
    defillamaMatched?: number;
    dexscreenerRiskResolved?: number;
    coingeckoPriceResolved?: number;
    duneRowsMatched?: number;
  };
};

type TraceHop = {
  from: string;
  to: string;
  valueText: string;
  txHash: string;
  fromLabel: string;
  toLabel: string;
  tokenSymbol: string;
  tokenName: string;
  tokenAddress: string;
  contractAddress: string;
  method: string;
  functionSignature: string;
  protocol: string;
  dex: string;
  exchangeHint: string;
  blockNumber: string;
  timestamp: string;
  amountUsd: number | null;
};

type TokenRiskInfo = {
  address: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  score: number;
};

type JobPollResponse = {
  success?: boolean;
  job?: {
    status: "queued" | "running" | "completed" | "failed";
    result?: TraceApiResponse | null;
    error?: string | null;
  };
};

type HopAddressDetails = {
  address: string;
  label: string;
  entity: string;
  entityType: string;
  tags: string[];
  clusterIds: string[];
  isContract: boolean;
};

type HopTxSummary = {
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

type HopTransferDetails = {
  transferType: "external" | "internal" | "token";
  from: string;
  to: string;
  value: string;
  usd: number | null;
  tokenSymbol: string;
  tokenName: string;
  tokenAddress: string;
};

type HopSwapDetails = {
  protocol: string;
  dex: string;
  amountIn: string;
  amountOut: string;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  usd: number | null;
  timestamp: string;
};

type HopSocialDetails = {
  author: string;
  handle: string;
  text: string;
  url: string;
  timestamp: string;
  engagementScore: number | null;
};

type HopDetailsPayload = {
  txHash: string;
  chain: string;
  from: HopAddressDetails;
  to: HopAddressDetails;
  tx: HopTxSummary;
  transfers: HopTransferDetails[];
  swaps?: HopSwapDetails[];
  social?: HopSocialDetails[];
  narrative?: string;
};

type CaseArtifact = {
  id: string;
  tag: string;
  value: string;
  kind: "address" | "entity" | "hashtag" | "ticker" | "username" | "query" | "note";
  sourceFeature: "trace" | "cluster" | "social" | "profile" | "timeline" | "report" | "manual";
  aliases?: string[];
};

const EXPLORER_BASE_URLS: Record<string, string> = {
  ethereum: "https://etherscan.io",
  bsc: "https://bscscan.com",
  base: "https://basescan.org",
  arbitrum: "https://arbiscan.io",
  hyperliquid: "https://hypurrscan.io",
};

const getAddressExplorerUrl = (chain: string, address: string): string | null => {
  const baseUrl = EXPLORER_BASE_URLS[chain];
  if (!baseUrl || !address) return null;
  return `${baseUrl}/address/${encodeURIComponent(address)}`;
};

const getTxExplorerUrl = (chain: string, txHash: string): string | null => {
  const baseUrl = EXPLORER_BASE_URLS[chain];
  if (!baseUrl || !txHash) return null;
  return `${baseUrl}/tx/${encodeURIComponent(txHash)}`;
};

const toTxCount = (value?: string | null): number | null => {
  if (!value || typeof value !== "string") return null;
  try {
    return Number.parseInt(value, 16);
  } catch {
    return null;
  }
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const pickString = (obj: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
};

const pickNumber = (obj: Record<string, unknown>, keys: string[]): number | null => {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const compactUsd = (amountUsd: number | null | undefined): string => {
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(amountUsd);
};

const formatUsd = (amountUsd: number | null | undefined): string => {
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amountUsd);
};

const trimLabel = (value: string, maxLength = 28): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}~`;
};

const buildHopKey = (hop: TraceHop, index: number): string => `${hop.txHash}_${hop.from}_${hop.to}_${index}`;

const isEvmAddress = (value: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(value);

const toTraceHops = (trace: unknown): TraceHop[] => {
  const candidateArrays: unknown[] = [];
  if (Array.isArray(trace)) {
    candidateArrays.push(trace);
  }
  const root = asRecord(trace);
  if (root) {
    if (Array.isArray(root.result)) candidateArrays.push(root.result);
    if (Array.isArray(root.traces)) candidateArrays.push(root.traces);
    if (Array.isArray(root.data)) candidateArrays.push(root.data);
  }

  const list = candidateArrays.find(Array.isArray) as unknown[] | undefined;
  if (!list) return [];

  return list
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;

      const action = asRecord(row.action);
      const tokenInfo = asRecord(row.token) || asRecord(row.asset) || asRecord(row.currency);
      const decodedCall = asRecord(row.decodedCall) || asRecord(row.decoded) || asRecord(row.call);

      const from = pickString(action || row, ["from", "fromAddress"]);
      const to = pickString(action || row, ["to", "toAddress"]);
      const valueText = pickString(action || row, ["value", "valueHex", "amount", "amountHex"]);
      const txHash = pickString(row, ["transactionHash", "txHash", "hash"]);

      const fromLabel = pickString(row, ["fromEntity", "fromLabel", "fromName", "senderName", "sourceName"]);
      const toLabel = pickString(row, ["toEntity", "toLabel", "toName", "receiverName", "destinationName"]);
      const tokenSymbol =
        pickString(row, ["tokenSymbol", "symbol", "assetSymbol", "currencySymbol"]) ||
        pickString(action || row, ["tokenSymbol", "symbol"]) ||
        (tokenInfo ? pickString(tokenInfo, ["symbol", "tokenSymbol", "ticker"]) : "");
      const tokenName =
        pickString(row, ["tokenName", "assetName", "currencyName", "name"]) ||
        (tokenInfo ? pickString(tokenInfo, ["name", "tokenName"]) : "");
      const tokenAddress =
        pickString(row, ["tokenAddress", "assetAddress", "tokenContract"]) ||
        pickString(action || row, ["tokenAddress", "assetAddress"]) ||
        (tokenInfo ? pickString(tokenInfo, ["address", "contract", "tokenAddress"]) : "");
      const contractAddress =
        pickString(row, ["contractAddress", "interactionContract", "toContract"]) ||
        pickString(action || row, ["contractAddress", "toContract"]);
      const method =
        pickString(row, ["method", "function", "functionName", "methodName"]) ||
        (decodedCall ? pickString(decodedCall, ["name", "method", "functionName"]) : "");
      const functionSignature =
        pickString(row, ["functionSignature", "methodSignature", "signature", "methodId"]) ||
        (decodedCall ? pickString(decodedCall, ["signature", "methodSignature", "selector"]) : "");
      const protocol = pickString(row, ["protocol", "protocolName", "platform"]);
      const dex = pickString(row, ["dex", "dexName", "pool", "market"]);
      const exchangeHint = pickString(row, ["exchange", "exchangeName", "venue", "cex", "counterpartyEntity"]);
      const blockNumber = pickString(row, ["blockNumber", "block"]);
      const timestamp = pickString(row, ["timestamp", "time", "blockTime", "blockTimestamp"]);
      const amountUsd =
        pickNumber(row, ["usd", "usdValue", "valueUsd", "amountUsd", "volumeUsd"]) ||
        (action ? pickNumber(action, ["usd", "usdValue", "valueUsd", "amountUsd", "volumeUsd"]) : null);

      if (!from && !to) return null;
      return {
        from: from || "unknown_from",
        to: to || "unknown_to",
        valueText: valueText || "n/a",
        txHash: txHash || "n/a",
        fromLabel,
        toLabel,
        tokenSymbol,
        tokenName,
        tokenAddress,
        contractAddress,
        method,
        functionSignature,
        protocol,
        dex,
        exchangeHint,
        blockNumber,
        timestamp,
        amountUsd,
      } as TraceHop;
    })
    .filter((hop): hop is TraceHop => Boolean(hop));
};

export default function TraceFundsPage() {
  const activeCaseIdHook = useActiveCaseId();
  const [sourceAddress, setSourceAddress] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [direction, setDirection] = useState("outbound");
  const [depth, setDepth] = useState(2);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState<TraceApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [expandedHopKey, setExpandedHopKey] = useState<string | null>(null);
  const [hopDetailsByKey, setHopDetailsByKey] = useState<Record<string, HopDetailsPayload>>({});
  const [hopDetailsLoadingByKey, setHopDetailsLoadingByKey] = useState<Record<string, boolean>>({});
  const [hopDetailsErrorByKey, setHopDetailsErrorByKey] = useState<Record<string, string>>({});
  const [socialSavedByHopKey, setSocialSavedByHopKey] = useState<Record<string, boolean>>({});
  const [artifactSuggestions, setArtifactSuggestions] = useState<CaseArtifact[]>([]);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [tokenRisks, setTokenRisks] = useState<Record<string, TokenRiskInfo>>({});
  const traceHops = toTraceHops(result?.trace);
  const traceSummary = useMemo(() => {
    if (!result?.trace || typeof result.trace !== "object" || Array.isArray(result.trace)) {
      return null;
    }
    const root = result.trace as Record<string, unknown>;
    const summary = root.summary;
    if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
      return null;
    }
    return summary as Record<string, unknown>;
  }, [result?.trace]);

  const crossChainSummary = useMemo(() => {
    if (!traceSummary) {
      return null;
    }
    const candidate = traceSummary.crossChain;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return null;
    }
    return candidate as CrossChainSummary;
  }, [traceSummary]);

  const uniqueCounterparties = new Set(
    traceHops.flatMap((hop) => [hop.from.toLowerCase(), hop.to.toLowerCase()])
  ).size;
  const socialSignalsCount = useMemo(
    () => Object.values(hopDetailsByKey).reduce((sum, details) => sum + (details.social?.length || 0), 0),
    [hopDetailsByKey]
  );
  const hopsWithSocialCount = useMemo(
    () => Object.values(hopDetailsByKey).filter((details) => (details.social?.length || 0) > 0).length,
    [hopDetailsByKey]
  );

  const traceFlowChart = useMemo(() => {
    if (traceHops.length === 0) {
      return "";
    }

    const safeText = (value: string) =>
      value
        .replace(/[\r\n\t]+/g, " ")
        .replace(/[\[\]{}()<>|#;`]/g, " ")
        .replace(/\"/g, "'")
        .replace(/\s+/g, " ")
        .trim();

    const lines: string[] = [
      "flowchart LR",
      "classDef wallet fill:#f5faf9,stroke:#2f8577,color:#0f2e2a,stroke-width:1px",
      "classDef source fill:#0a6e5d,stroke:#07584b,color:#ffffff,stroke-width:1px",
    ];

    const nodeMap = new Map<string, string>();
    const nodeLabels = new Map<string, string>();
    let index = 0;

    for (const hop of traceHops.slice(0, 20)) {
      if (hop.fromLabel) {
        nodeLabels.set(hop.from.toLowerCase(), trimLabel(hop.fromLabel));
      }
      if (hop.toLabel) {
        nodeLabels.set(hop.to.toLowerCase(), trimLabel(hop.toLabel));
      }
    }

    const resolveNodeId = (address: string) => {
      const key = address.toLowerCase();
      const existing = nodeMap.get(key);
      if (existing) {
        return existing;
      }

      const nodeId = `n${index++}`;
      nodeMap.set(key, nodeId);
      const label = nodeLabels.get(key);
      const nodeText = label ? `${shortenAddress(address)} | ${label}` : shortenAddress(address);
      lines.push(`${nodeId}[\"${safeText(nodeText)}\"];`);
      return nodeId;
    };

    for (const hop of traceHops.slice(0, 8)) {
      const fromId = resolveNodeId(hop.from);
      const toId = resolveNodeId(hop.to);
      const edgeParts = [
        formatOnchainValue(hop.valueText),
        hop.tokenSymbol,
        compactUsd(hop.amountUsd),
        trimLabel(hop.method || hop.functionSignature, 18),
      ].filter((part) => part && part.length > 0);
      const edgeLabel = safeText(edgeParts.join(" | ")) || "value";
      lines.push(`${fromId} -->|${edgeLabel}| ${toId};`);
    }

    const sourceKey = sourceAddress.trim().toLowerCase();
    const sourceNodeId = nodeMap.get(sourceKey);
    if (sourceNodeId) {
      lines.push(`class ${sourceNodeId} source;`);
    }

    for (const nodeId of nodeMap.values()) {
      if (nodeId !== sourceNodeId) {
        lines.push(`class ${nodeId} wallet;`);
      }
    }

    return lines.join("\n");
  }, [traceHops, sourceAddress]);

  const chains = ["ethereum", "bsc", "base", "arbitrum", "hyperliquid"];

  const activeCaseId = activeCaseIdHook || getActiveCaseId();

  const resolveArtifactToken = async (token: string): Promise<CaseArtifact | null> => {
    if (!activeCaseId || !token.startsWith("@") || token.length < 2) {
      return null;
    }

    const query = token.slice(1);
    const response = await fetch(`/api/cases/${activeCaseId}/artifacts?q=${encodeURIComponent(query)}&limit=30`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as { artifacts?: CaseArtifact[] };
    const artifacts = body.artifacts || [];
    const exact = artifacts.find((item) => item.tag.toLowerCase() === query.toLowerCase());
    return exact || artifacts[0] || null;
  };

  const saveAddressArtifact = async (address: string) => {
    if (!activeCaseId || !isEvmAddress(address)) {
      return;
    }

    await fetch(`/api/cases/${activeCaseId}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: address,
        kind: "address",
        sourceFeature: "trace",
        aliases: [shortenAddress(address)],
        metadata: {
          chain,
          direction,
          depth,
        },
      }),
    }).catch(() => {
      // Non-blocking persistence.
    });
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      setTimeout(() => setCopiedValue((current) => (current === value ? null : current)), 1500);
    } catch {
      // Ignore clipboard errors.
    }
  };

  const fetchTokenRisks = async (hops: TraceHop[]) => {
    // Get unique "to" addresses (destination tokens)
    const uniqueAddresses = Array.from(new Set(hops.map((hop) => hop.to)));
    const risks: Record<string, TokenRiskInfo> = {};

    // Fetch risk for each token address
    for (const address of uniqueAddresses) {
      try {
        const response = await fetch("/api/token-risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokenAddress: address, chain }),
        });

        if (response.ok) {
          const data = await response.json();
          risks[address.toLowerCase()] = {
            address,
            riskLevel: data.riskLevel || "medium",
            score: data.score || 0,
          };
        }
      } catch (err) {
        console.error(`Failed to fetch risk for ${address}:`, err);
      }
    }

    setTokenRisks(risks);
  };

  const fetchHopDetails = async (hopKey: string, hop: TraceHop) => {
    if (hopDetailsByKey[hopKey] || hopDetailsLoadingByKey[hopKey]) {
      return;
    }

    setHopDetailsLoadingByKey((current) => ({ ...current, [hopKey]: true }));
    setHopDetailsErrorByKey((current) => {
      const next = { ...current };
      delete next[hopKey];
      return next;
    });

    try {
      const activeCaseId = activeCaseIdHook || getActiveCaseId();
      const body: Record<string, unknown> = {
        chain,
        txHash: hop.txHash,
        from: hop.from,
        to: hop.to,
      };
      if (activeCaseId) {
        body.caseId = activeCaseId;
      }

      const response = await fetch("/api/trace/hop-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errorText = typeof body.error === "string" ? body.error : `Failed to fetch hop details (${response.status})`;
        throw new Error(errorText);
      }

      const data = (await response.json()) as { details?: HopDetailsPayload };
      if (!data.details) {
        throw new Error("Hop detail payload is empty");
      }

      const saveSocialSignalEvent = async (details: HopDetailsPayload) => {
        const activeCaseId = activeCaseIdHook || getActiveCaseId();
        if (!activeCaseId || !details.social || details.social.length === 0) {
          return;
        }

        let shouldPersist = false;
        setSocialSavedByHopKey((current) => {
          if (current[hopKey]) {
            return current;
          }
          shouldPersist = true;
          return {
            ...current,
            [hopKey]: true,
          };
        });

        if (!shouldPersist) {
          return;
        }

        const topSignals = details.social.slice(0, 3);
        const mentionCount = details.social.length;
        const maxEngagement = topSignals.reduce((max, item) => {
          if (typeof item.engagementScore === "number" && Number.isFinite(item.engagementScore)) {
            return Math.max(max, item.engagementScore);
          }
          return max;
        }, 0);

        const socialNodes = topSignals.map((item, index) => {
          const handle = item.handle || item.author || `social-${index + 1}`;
          const nodeId = `social:${handle.toLowerCase().replace(/\s+/g, "_")}`;
          return {
            id: nodeId,
            label: handle,
            type: "social",
          };
        });

        const addressNodes = [hop.from, hop.to]
          .filter((address, index, arr) => arr.indexOf(address) === index)
          .map((address) => ({
            id: address,
            label: address,
            type: isEvmAddress(address) ? "address" : "entity",
          }));

        const edges = socialNodes.flatMap((node) => {
          return addressNodes.map((addressNode) => ({
            source: node.id,
            target: addressNode.id,
            label: "mentions flow",
          }));
        });

        const narrativeParts = [
          details.narrative || "Social chatter detected around traced movement.",
          ...topSignals.map((item) => item.text).filter((text) => typeof text === "string" && text.length > 0).slice(0, 2),
        ];
        const narrative = narrativeParts.join(" ").slice(0, 5800);

        await fetch(`/api/cases/${activeCaseId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feature: "social",
            title: `Social signals near ${shortenAddress(hop.from)} -> ${shortenAddress(hop.to)}`,
            narrative,
            metrics: {
              mentionCount,
              maxEngagement,
              txHash: hop.txHash,
              chain,
              hopFrom: hop.from,
              hopTo: hop.to,
            },
            nodes: [...addressNodes, ...socialNodes],
            edges,
          }),
        }).catch(() => {
          // Non-blocking persistence.
        });
      };

      setHopDetailsByKey((current) => ({
        ...current,
        [hopKey]: data.details as HopDetailsPayload,
      }));
      await saveSocialSignalEvent(data.details);
    } catch (err) {
      setHopDetailsErrorByKey((current) => ({
        ...current,
        [hopKey]: err instanceof Error ? err.message : "Failed to enrich hop",
      }));
    } finally {
      setHopDetailsLoadingByKey((current) => ({ ...current, [hopKey]: false }));
    }
  };

  const saveCaseEvent = async (data: TraceApiResponse) => {
    const activeCaseId = activeCaseIdHook || getActiveCaseId();
    if (!activeCaseId) {
      return;
    }

    const nodes = [
      { id: sourceAddress, label: sourceAddress, type: "address" },
      { id: `${chain}_${direction}`, label: `${chain} ${direction}`, type: "flow" },
    ];

    const edges = [
      {
        source: sourceAddress,
        target: `${chain}_${direction}`,
        label: `depth ${depth}`,
      },
    ];

    const summaryRecord =
      data.trace && typeof data.trace === "object" && !Array.isArray(data.trace)
        ? (data.trace as Record<string, unknown>).summary
        : null;
    const crossChainRecord =
      summaryRecord && typeof summaryRecord === "object" && !Array.isArray(summaryRecord)
        ? (summaryRecord as Record<string, unknown>).crossChain
        : null;
    const bridgeSignalCount =
      crossChainRecord && typeof crossChainRecord === "object" && !Array.isArray(crossChainRecord)
        ? Number((crossChainRecord as Record<string, unknown>).bridgeSignalsCount || 0)
        : 0;
    const destinationChains =
      crossChainRecord && typeof crossChainRecord === "object" && !Array.isArray(crossChainRecord)
        ? ((crossChainRecord as Record<string, unknown>).inferredDestinationChains as string[] | undefined) || []
        : [];

    await fetch(`/api/cases/${activeCaseId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature: "trace",
        title: `Traced ${sourceAddress.slice(0, 10)}... (${direction})`,
        narrative: data.message || `Trace run executed on ${chain} with depth ${depth}.`,
        metrics: {
          depth,
          hasJob: data.jobId ? 1 : 0,
          txCountFallback: toTxCount(data.fallback?.txCountHex) ?? -1,
          bridgeSignalCount,
          destinationChainCount: destinationChains.length,
        },
        nodes,
        edges,
      }),
    }).catch(() => {
      // Non-blocking persistence.
    });
  };

  const run = async () => {
    let resolvedSourceAddress = sourceAddress.trim();
    if (resolvedSourceAddress.startsWith("@")) {
      const artifact = await resolveArtifactToken(resolvedSourceAddress);
      if (!artifact) {
        setError(`No artifact found for ${resolvedSourceAddress}`);
        return;
      }
      resolvedSourceAddress = artifact.value;
      setSourceAddress(artifact.value);
    }

    if (!isEvmAddress(resolvedSourceAddress)) {
      setError("Enter a valid EVM address (0x...). You can also use @artifact-tag.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      await saveAddressArtifact(resolvedSourceAddress);

      const response = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceAddress: resolvedSourceAddress, chain, depth, direction }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errorText =
          typeof body.error === "string"
            ? body.error
            : Array.isArray(body.error)
              ? body.error.map((item: unknown) => (typeof item === "string" ? item : JSON.stringify(item))).join("; ")
              : `Trace failed (${response.status})`;
        throw new Error(errorText);
      }

      const data = (await response.json()) as TraceApiResponse;
      setResult(data);
      if (!data.jobId) {
        await saveCaseEvent(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trace failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (traceHops.length > 0) {
      void fetchTokenRisks(traceHops);
    }
  }, [traceHops.length, chain]);

  useEffect(() => {
    const token = sourceAddress.trim();
    if (!activeCaseId || !token.startsWith("@") || token.length < 2) {
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
  }, [sourceAddress, activeCaseId]);

  useEffect(() => {
    setExpandedHopKey(null);
    setHopDetailsByKey({});
    setHopDetailsLoadingByKey({});
    setHopDetailsErrorByKey({});
    setSocialSavedByHopKey({});
  }, [result?.trace]);

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

        const data = (await response.json()) as JobPollResponse;
        const status = data.job?.status;

        if (!status || status === "queued" || status === "running") {
          setTimeout(poll, 2500);
          return;
        }

        if (status === "failed") {
          setPolling(false);
          setError(data.job?.error || "Trace job failed");
          return;
        }

        const completed = {
          ...result,
          ...(data.job?.result || {}),
          jobId: result.jobId,
        } as TraceApiResponse;

        setResult(completed);
        setPolling(false);
        await saveCaseEvent(completed);
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
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Feature 02</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Trace Funds</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Trace inflow/outflow paths and collect evidence for the target wallet.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="relative sm:col-span-2">
          <input
            value={sourceAddress}
            onChange={(e) => setSourceAddress(e.target.value)}
            placeholder="0x... or @artifact-tag"
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-mono text-sm"
          />
          {sourceAddress.trim().startsWith("@") ? (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[var(--line)] bg-white shadow-sm">
              {artifactLoading ? <p className="px-3 py-2 text-xs text-[var(--muted)]">Loading artifacts...</p> : null}
              {!artifactLoading && artifactSuggestions.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[var(--muted)]">No case artifact matches</p>
              ) : null}
              {artifactSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSourceAddress(item.value);
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
              ))}
            </div>
          ) : null}
        </div>

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

        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2"
        >
          <option value="outbound">outbound</option>
          <option value="inbound">inbound</option>
          <option value="both">both</option>
        </select>

        <input
          type="number"
          min={1}
          max={5}
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2"
        />

        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
        >
          {loading ? "Tracing..." : "Run Trace"}
        </button>
      </div>

      {error ? <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {result ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Trace Summary</p>
            <p className="mt-2 text-sm text-[var(--ink)]">
              Trace configured for {sourceAddress || "target address"} on {chain}, direction {direction}, depth {depth}.
              {" "}
              {result.message || "Trace request processed."}
            </p>
          </div>

          {result.jobId ? (
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Async Job Status</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-[var(--muted)]">Job ID</p>
                  <p className="mt-1 break-all font-mono text-xs text-[var(--ink)]">{result.jobId}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Estimated Processing</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ink)]">
                    {polling ? (result.estimatedTime || "Pending") : "Completed"}
                  </p>
                </div>
              </div>
              <div className="mt-4 h-2 rounded-full bg-[var(--line)]">
                <div className={`h-2 rounded-full bg-[var(--accent)] ${polling ? "w-1/3 animate-pulse" : "w-full"}`} />
              </div>
            </div>
          ) : null}

          {result.fallback && (!result.jobId || !polling) ? (
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Fallback Intelligence</p>
              <p className="mt-2 text-sm text-[var(--ink)]">
                Full trace API is unavailable on this RPC endpoint. Returned account-level evidence to preserve
                investigative momentum.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                  <p className="text-xs text-[var(--muted)]">Transaction Count (decoded)</p>
                  <p className="mt-1 text-xl font-bold text-[var(--ink)]">
                    {toTxCount(result.fallback.txCountHex) === null
                      ? "N/A"
                      : toTxCount(result.fallback.txCountHex)!.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                  <p className="text-xs text-[var(--muted)]">Raw Counter Value</p>
                  <p className="mt-1 font-mono text-xs text-[var(--ink)]">{formatHexInteger(result.fallback.txCountHex)}</p>
                </div>
              </div>
            </div>
          ) : null}

          {result.trace && (!result.jobId || !polling) ? (
            <>
              <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Flow Interpretation</p>
                <p className="mt-2 text-sm text-[var(--ink)]">
                  Trace data returned successfully. Prioritize large-value paths and repeatedly connected counterparties
                  to identify laundering pathways faster.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                    <p className="text-xs text-[var(--muted)]">Direction</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{direction}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                    <p className="text-xs text-[var(--muted)]">Depth</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{depth} hops</p>
                  </div>
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                    <p className="text-xs text-[var(--muted)]">Chain</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{chain}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                    <p className="text-xs text-[var(--muted)]">Trace Edges</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{traceHops.length}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                    <p className="text-xs text-[var(--muted)]">Unique Nodes</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{uniqueCounterparties}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                    <p className="text-xs text-[var(--muted)]">Social Signals Captured</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{socialSignalsCount}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                    <p className="text-xs text-[var(--muted)]">Hops With Social Context</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{hopsWithSocialCount}</p>
                  </div>
                </div>
              </div>

              {crossChainSummary && crossChainSummary.bridgeSignalsCount > 0 ? (
                <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Cross-Chain Signals</p>
                  <p className="mt-2 text-sm text-[var(--ink)]">
                    Detected {crossChainSummary.bridgeSignalsCount} potential bridge movement signal(s), including {crossChainSummary.highConfidenceSignals} high-confidence signal(s).
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                      <p className="text-xs text-[var(--muted)]">Bridge Signals</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{crossChainSummary.bridgeSignalsCount}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                      <p className="text-xs text-[var(--muted)]">High Confidence</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{crossChainSummary.highConfidenceSignals}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                      <p className="text-xs text-[var(--muted)]">Destination Chains</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--ink)]">
                        {crossChainSummary.inferredDestinationChains.length > 0
                          ? crossChainSummary.inferredDestinationChains.join(", ")
                          : "not inferred"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                      <p className="text-xs text-[var(--muted)]">Dune Matches</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{crossChainSummary.providerCoverage?.duneRowsMatched || 0}</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {crossChainSummary.bridgeSignals.slice(0, 5).map((signal, index) => (
                      <div key={`${signal.txHash}_${index}`} className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                        <p className="text-sm font-semibold text-[var(--ink)]">
                          {signal.bridgeProtocol || "Bridge pattern"} • confidence {signal.confidence}%
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {shortenAddress(signal.from)} to {shortenAddress(signal.to)}
                          {signal.inferredDestinationChain ? ` -> ${signal.inferredDestinationChain}` : ""}
                          {signal.tokenSymbol ? ` • ${signal.tokenSymbol}` : ""}
                          {typeof signal.valueUsd === "number" && Number.isFinite(signal.valueUsd)
                            ? ` • ${formatUsd(signal.valueUsd)}`
                            : ""}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">{shortenAddress(signal.txHash, 10, 8)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {traceHops.length > 0 ? (
                <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Flow Diagram</p>
                  <div className="mt-4">
                    <MermaidDiagram chart={traceFlowChart} />
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Showing up to 8 strongest edges with available token, USD, and method context from trace payload.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]">
                  Trace payload returned but no renderable hop entries were found in the provider response shape.
                </div>
              )}

              {traceHops.length > 0 ? (
                <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Top Hops</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Click any row to expand entities, token metadata, venue, and call context.</p>
                  <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-[var(--line)]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--paper)] text-[var(--muted)]">
                        <tr>
                          <th className="px-3 py-2">From</th>
                          <th className="px-3 py-2">To</th>
                          <th className="px-3 py-2">Value</th>
                          <th className="px-3 py-2">Token Risk</th>
                          <th className="px-3 py-2">Tx Hash</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traceHops.slice(0, 12).map((hop, index) => {
                          const risk = tokenRisks[hop.to.toLowerCase()];
                          const fromExplorerUrl = getAddressExplorerUrl(chain, hop.from);
                          const toExplorerUrl = getAddressExplorerUrl(chain, hop.to);
                          const txExplorerUrl = getTxExplorerUrl(chain, hop.txHash);
                          const hopKey = buildHopKey(hop, index);
                          const isExpanded = expandedHopKey === hopKey;
                          const hopDetails = hopDetailsByKey[hopKey];
                          const hopDetailsLoading = hopDetailsLoadingByKey[hopKey] === true;
                          const hopDetailsError = hopDetailsErrorByKey[hopKey];
                          const tokenDescriptor = [hop.tokenSymbol, hop.tokenName].filter(Boolean).join(" - ");
                          const venueDescriptor = [hop.exchangeHint, hop.dex, hop.protocol].filter(Boolean).join(" - ");
                          const callDescriptor = [hop.method, hop.functionSignature].filter(Boolean).join(" - ");

                          return [
                            <tr
                              key={`${hopKey}_row`}
                                className="cursor-pointer border-t border-[var(--line)] hover:bg-[var(--paper)]"
                                onClick={() => {
                                  setExpandedHopKey((current) => {
                                    const willExpand = current !== hopKey;
                                    if (willExpand) {
                                      void fetchHopDetails(hopKey, hop);
                                    }
                                    return willExpand ? hopKey : null;
                                  });
                                }}
                              >
                                <td className="px-3 py-2 font-mono">
                                  <div className="flex items-center gap-2">
                                    {fromExplorerUrl ? (
                                      <a
                                        href={fromExplorerUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(event) => event.stopPropagation()}
                                        className="underline decoration-dotted hover:text-[var(--accent)]"
                                        title={hop.from}
                                      >
                                        {shortenAddress(hop.from)}
                                      </a>
                                    ) : (
                                      <span title={hop.from}>{shortenAddress(hop.from)}</span>
                                    )}
                                    {hop.fromLabel ? <span className="text-[10px] text-[var(--muted)]">{trimLabel(hop.fromLabel, 18)}</span> : null}
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void copyText(hop.from);
                                      }}
                                      className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-semibold hover:border-[var(--accent)]"
                                      title="Copy full address"
                                    >
                                      {copiedValue === hop.from ? "Done" : "Copy"}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2 font-mono">
                                  <div className="flex items-center gap-2">
                                    {toExplorerUrl ? (
                                      <a
                                        href={toExplorerUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(event) => event.stopPropagation()}
                                        className="underline decoration-dotted hover:text-[var(--accent)]"
                                        title={hop.to}
                                      >
                                        {shortenAddress(hop.to)}
                                      </a>
                                    ) : (
                                      <span title={hop.to}>{shortenAddress(hop.to)}</span>
                                    )}
                                    {hop.toLabel ? <span className="text-[10px] text-[var(--muted)]">{trimLabel(hop.toLabel, 18)}</span> : null}
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void copyText(hop.to);
                                      }}
                                      className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-semibold hover:border-[var(--accent)]"
                                      title="Copy full address"
                                    >
                                      {copiedValue === hop.to ? "Done" : "Copy"}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <p className="font-semibold text-[var(--ink)]">{formatOnchainValue(hop.valueText)}</p>
                                  <p className="text-[10px] text-[var(--muted)]">
                                    {[tokenDescriptor, compactUsd(hop.amountUsd)].filter(Boolean).join(" | ") || "Token metadata unavailable"}
                                  </p>
                                </td>
                                <td className="px-3 py-2">
                                  {risk ? (
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                        risk.riskLevel === "critical"
                                          ? "bg-red-100 text-red-700"
                                          : risk.riskLevel === "high"
                                            ? "bg-orange-100 text-orange-700"
                                            : risk.riskLevel === "medium"
                                              ? "bg-yellow-100 text-yellow-700"
                                              : "bg-green-100 text-green-700"
                                      }`}
                                    >
                                      {risk.riskLevel} ({risk.score})
                                    </span>
                                  ) : (
                                    <span className="text-[var(--muted)]">—</span>
                                  )}
                                  <p className="mt-1 text-[10px] text-[var(--muted)]">{trimLabel(venueDescriptor || "No venue tag", 24)}</p>
                                </td>
                                <td className="px-3 py-2 font-mono">
                                  <div className="flex items-center gap-2">
                                    {txExplorerUrl ? (
                                      <a
                                        href={txExplorerUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(event) => event.stopPropagation()}
                                        className="underline decoration-dotted hover:text-[var(--accent)]"
                                        title={hop.txHash}
                                      >
                                        {shortenAddress(hop.txHash, 10, 8)}
                                      </a>
                                    ) : (
                                      <span title={hop.txHash}>{shortenAddress(hop.txHash, 10, 8)}</span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void copyText(hop.txHash);
                                      }}
                                      className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-semibold hover:border-[var(--accent)]"
                                      title="Copy full transaction hash"
                                    >
                                      {copiedValue === hop.txHash ? "Done" : "Copy"}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              ,
                              isExpanded ? (
                                <tr key={`${hopKey}_expanded`} className="border-t border-[var(--line)] bg-[var(--paper)]">
                                  <td colSpan={5} className="px-3 py-3">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                      <div className="rounded border border-[var(--line)] bg-white p-2">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Entity Context</p>
                                        <p className="mt-1 text-xs text-[var(--ink)]">From: {hop.fromLabel || "Unknown entity"}</p>
                                        <p className="mt-1 text-xs text-[var(--ink)]">To: {hop.toLabel || "Unknown entity"}</p>
                                      </div>
                                      <div className="rounded border border-[var(--line)] bg-white p-2">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Token Context</p>
                                        <p className="mt-1 text-xs text-[var(--ink)]">{tokenDescriptor || "Token metadata unavailable"}</p>
                                        <p className="mt-1 break-all font-mono text-[10px] text-[var(--muted)]">{hop.tokenAddress || "No token contract"}</p>
                                        <p className="mt-1 text-xs text-[var(--ink)]">USD: {compactUsd(hop.amountUsd) || "N/A"}</p>
                                      </div>
                                      <div className="rounded border border-[var(--line)] bg-white p-2">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Venue + Contract</p>
                                        <p className="mt-1 text-xs text-[var(--ink)]">{venueDescriptor || "No venue tags"}</p>
                                        <p className="mt-1 text-xs text-[var(--ink)]">{callDescriptor || "No decoded method"}</p>
                                        <p className="mt-1 break-all font-mono text-[10px] text-[var(--muted)]">{hop.contractAddress || "No contract context"}</p>
                                      </div>
                                      <div className="rounded border border-[var(--line)] bg-white p-2">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Block + Time</p>
                                        <p className="mt-1 text-xs text-[var(--ink)]">Block: {hop.blockNumber || "Unknown"}</p>
                                        <p className="mt-1 text-xs text-[var(--ink)]">Time: {hop.timestamp || "Unknown"}</p>
                                      </div>
                                      <div className="rounded border border-[var(--line)] bg-white p-2 sm:col-span-2 lg:col-span-2">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Investigator Notes</p>
                                        <p className="mt-1 text-xs text-[var(--ink)]">
                                          {hop.exchangeHint || hop.fromLabel || hop.toLabel
                                            ? "Potential exchange/entity signal present. Verify account type and tag confidence in explorer."
                                            : "No direct entity tag in provider payload. Use tx explorer and profile tools for attribution."}
                                        </p>
                                      </div>

                                      <div className="rounded border border-[var(--line)] bg-white p-2 sm:col-span-2 lg:col-span-3">
                                        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Arkham Enrichment</p>
                                        {hopDetailsLoading ? (
                                          <p className="mt-2 text-xs text-[var(--muted)]">Loading address intelligence, tx details, and tx-level transfers...</p>
                                        ) : null}
                                        {hopDetailsError ? (
                                          <p className="mt-2 text-xs text-red-700">{hopDetailsError}</p>
                                        ) : null}
                                        {hopDetails ? (
                                          <div className="mt-2 space-y-3">
                                            {hopDetails.narrative ? (
                                              <div className="rounded border border-yellow-200 bg-yellow-50 p-2">
                                                <p className="text-[10px] uppercase tracking-[0.08em] text-yellow-700">Risk Narrative</p>
                                                <p className="mt-1 text-xs text-yellow-900">{hopDetails.narrative}</p>
                                              </div>
                                            ) : null}
                                            <div className="grid gap-2 sm:grid-cols-2">
                                              <div className="rounded border border-[var(--line)] p-2">
                                                <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">From Intelligence</p>
                                                <p className="mt-1 text-xs text-[var(--ink)]">Entity: {hopDetails.from.entity || "Unknown"}</p>
                                                <p className="mt-1 text-xs text-[var(--ink)]">Type: {hopDetails.from.entityType || "Unknown"}</p>
                                                <p className="mt-1 text-xs text-[var(--ink)]">Label: {hopDetails.from.label || "Unknown"}</p>
                                                <p className="mt-1 text-xs text-[var(--ink)]">Tags: {hopDetails.from.tags.slice(0, 4).join(", ") || "None"}</p>
                                              </div>
                                              <div className="rounded border border-[var(--line)] p-2">
                                                <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">To Intelligence</p>
                                                <p className="mt-1 text-xs text-[var(--ink)]">Entity: {hopDetails.to.entity || "Unknown"}</p>
                                                <p className="mt-1 text-xs text-[var(--ink)]">Type: {hopDetails.to.entityType || "Unknown"}</p>
                                                <p className="mt-1 text-xs text-[var(--ink)]">Label: {hopDetails.to.label || "Unknown"}</p>
                                                <p className="mt-1 text-xs text-[var(--ink)]">Tags: {hopDetails.to.tags.slice(0, 4).join(", ") || "None"}</p>
                                              </div>
                                              <div className="rounded border border-[var(--line)] p-2 sm:col-span-2">
                                                <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Transaction Details</p>
                                                <div className="mt-1 grid gap-1 sm:grid-cols-2">
                                                  <p className="text-xs text-[var(--ink)]">Method: {hopDetails.tx.method || "Unknown"}</p>
                                                  <p className="text-xs text-[var(--ink)]">Signature: {hopDetails.tx.functionSignature || "Unknown"}</p>
                                                  <p className="text-xs text-[var(--ink)]">USD: {formatUsd(hopDetails.tx.usd)}</p>
                                                  <p className="text-xs text-[var(--ink)]">Gas Used: {hopDetails.tx.gasUsed || "Unknown"}</p>
                                                  <p className="text-xs text-[var(--ink)]">Block: {hopDetails.tx.blockNumber || "Unknown"}</p>
                                                  <p className="text-xs text-[var(--ink)]">Time: {hopDetails.tx.timestamp || "Unknown"}</p>
                                                </div>
                                              </div>
                                              <div className="rounded border border-[var(--line)] p-2 sm:col-span-2">
                                                <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Transfers In Transaction</p>
                                                {hopDetails.transfers.length > 0 ? (
                                                  <div className="mt-1 max-h-32 overflow-auto">
                                                    {hopDetails.transfers.slice(0, 6).map((txTransfer, txIndex) => (
                                                      <p key={`${hopKey}_tx_${txIndex}`} className="text-xs text-[var(--ink)]">
                                                        {txTransfer.transferType}: {shortenAddress(txTransfer.from)} to {shortenAddress(txTransfer.to)} | {txTransfer.tokenSymbol || "token"} | {formatUsd(txTransfer.usd)}
                                                      </p>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <p className="mt-1 text-xs text-[var(--muted)]">No tx-level transfer breakdown returned.</p>
                                                )}
                                              </div>
                                              {hopDetails.swaps && hopDetails.swaps.length > 0 ? (
                                                <div className="rounded border border-[var(--line)] p-2 sm:col-span-2">
                                                  <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Protocol & Swap Context</p>
                                                  <div className="mt-1 max-h-32 overflow-auto space-y-1">
                                                    {hopDetails.swaps.slice(0, 4).map((swap, swapIndex) => (
                                                      <p key={`${hopKey}_swap_${swapIndex}`} className="text-xs text-[var(--ink)]">
                                                        {swap.protocol || swap.dex || "Unknown"}: {swap.tokenInSymbol} → {swap.tokenOutSymbol} | {formatUsd(swap.usd)}
                                                      </p>
                                                    ))}
                                                  </div>
                                                </div>
                                              ) : null}
                                              {hopDetails.social && hopDetails.social.length > 0 ? (
                                                <div className="rounded border border-[var(--line)] p-2 sm:col-span-2">
                                                  <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Social Context (deSearch/X)</p>
                                                  <div className="mt-1 max-h-36 space-y-2 overflow-auto">
                                                    {hopDetails.social.slice(0, 3).map((socialItem, socialIndex) => (
                                                      <div key={`${hopKey}_social_${socialIndex}`} className="rounded border border-[var(--line)] p-2">
                                                        <p className="text-[11px] font-semibold text-[var(--ink)]">
                                                          {socialItem.handle || socialItem.author || "Unknown account"}
                                                          {socialItem.engagementScore !== null ? ` (engagement ${socialItem.engagementScore})` : ""}
                                                        </p>
                                                        <p className="mt-1 text-xs text-[var(--ink)]">{socialItem.text || "No content"}</p>
                                                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[var(--muted)]">
                                                          {socialItem.timestamp ? <span>{socialItem.timestamp}</span> : null}
                                                          {socialItem.url ? (
                                                            <a
                                                              href={socialItem.url}
                                                              target="_blank"
                                                              rel="noreferrer"
                                                              onClick={(event) => event.stopPropagation()}
                                                              className="underline decoration-dotted hover:text-[var(--accent)]"
                                                            >
                                                              Open post
                                                            </a>
                                                          ) : null}
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              ) : null}
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null,
                          ];
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
