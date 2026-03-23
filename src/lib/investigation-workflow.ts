import { arkhamAddressCounterparties, arkhamAddressTransfers, arkhamClusterLookup } from "@/lib/datasources";

const MAX_HOPS = 700;

type Direction = "inbound" | "outbound" | "both";

type TraceRecord = {
  action: {
    from: string;
    to: string;
    value: string;
  };
  transactionHash: string;
  blockNumber: string;
  timestamp?: string;
  fromLabel?: string;
  toLabel?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenAddress?: string;
  contractAddress?: string;
  method?: string;
  functionSignature?: string;
  protocol?: string;
  dex?: string;
  exchange?: string;
  usdValue?: number;
};

const normalizeAddress = (value: string): string => value.trim().toLowerCase();

const pickAddress = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";

  const row = value as Record<string, unknown>;
  const direct = row.address;
  if (typeof direct === "string") return direct;

  const wallet = row.wallet;
  if (typeof wallet === "string") return wallet;

  const id = row.id;
  if (typeof id === "string" && id.startsWith("0x")) return id;

  const raw = row.raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rawAddress = (raw as Record<string, unknown>).address;
    if (typeof rawAddress === "string") return rawAddress;
  }

  return "";
};

const pickTxHash = (row: Record<string, unknown>): string => {
  const direct = row.transactionHash ?? row.txHash ?? row.hash;
  if (typeof direct === "string" && direct) return direct;
  const tx = row.tx;
  if (tx && typeof tx === "object" && !Array.isArray(tx)) {
    const txObj = tx as Record<string, unknown>;
    const nested = txObj.hash;
    if (typeof nested === "string" && nested) return nested;
  }
  return "";
};

const pickNumericLike = (value: unknown): unknown => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const row = value as Record<string, unknown>;
  return row.value ?? row.amount ?? row.raw ?? 0;
};

const pickString = (row: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
};

const pickNumber = (row: Record<string, unknown>, keys: string[]): number | null => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const normalizeArkhamTransfers = (rows: Array<Record<string, unknown>>): TraceRecord[] => {
  const traces: TraceRecord[] = [];

  const pushTransfer = (txHash: string, from: string, to: string, value: unknown, row: Record<string, unknown>) => {
    const normalizedFrom = normalizeAddress(from);
    const normalizedTo = normalizeAddress(to);
    if (!normalizedFrom.startsWith("0x") || !normalizedTo.startsWith("0x")) {
      return;
    }

    let valueHex = "0x0";
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      valueHex = `0x${Math.floor(value).toString(16)}`;
    } else if (typeof value === "string" && value.startsWith("0x")) {
      valueHex = value;
    }

    const action = row.action && typeof row.action === "object" && !Array.isArray(row.action)
      ? (row.action as Record<string, unknown>)
      : null;
    const token = row.token && typeof row.token === "object" && !Array.isArray(row.token)
      ? (row.token as Record<string, unknown>)
      : null;
    const decodedCall = row.decodedCall && typeof row.decodedCall === "object" && !Array.isArray(row.decodedCall)
      ? (row.decodedCall as Record<string, unknown>)
      : null;

    traces.push({
      action: {
        from: normalizedFrom,
        to: normalizedTo,
        value: valueHex,
      },
      transactionHash: txHash,
      blockNumber: pickString(row, ["blockNumber", "block"]) || "0x0",
      timestamp: pickString(row, ["timestamp", "time", "blockTime", "blockTimestamp"]),
      fromLabel: pickString(row, ["fromEntity", "fromLabel", "fromName", "senderName", "sourceName"]),
      toLabel: pickString(row, ["toEntity", "toLabel", "toName", "receiverName", "destinationName"]),
      tokenSymbol:
        pickString(row, ["tokenSymbol", "symbol", "assetSymbol", "currencySymbol"]) ||
        (token ? pickString(token, ["symbol", "tokenSymbol", "ticker"]) : ""),
      tokenName:
        pickString(row, ["tokenName", "assetName", "currencyName", "name"]) ||
        (token ? pickString(token, ["name", "tokenName"]) : ""),
      tokenAddress:
        pickString(row, ["tokenAddress", "assetAddress", "tokenContract"]) ||
        (action ? pickString(action, ["tokenAddress", "assetAddress"]) : "") ||
        (token ? pickString(token, ["address", "contract", "tokenAddress"]) : ""),
      contractAddress:
        pickString(row, ["contractAddress", "interactionContract", "toContract"]) ||
        (action ? pickString(action, ["contractAddress", "toContract"]) : ""),
      method:
        pickString(row, ["method", "function", "functionName", "methodName"]) ||
        (decodedCall ? pickString(decodedCall, ["name", "method", "functionName"]) : ""),
      functionSignature:
        pickString(row, ["functionSignature", "methodSignature", "signature", "methodId"]) ||
        (decodedCall ? pickString(decodedCall, ["signature", "methodSignature", "selector"]) : ""),
      protocol: pickString(row, ["protocol", "protocolName", "platform"]),
      dex: pickString(row, ["dex", "dexName", "pool", "market"]),
      exchange: pickString(row, ["exchange", "exchangeName", "venue", "cex", "counterpartyEntity"]),
      usdValue:
        pickNumber(row, ["usd", "usdValue", "valueUsd", "amountUsd", "volumeUsd"]) ||
        (action ? pickNumber(action, ["usd", "usdValue", "valueUsd", "amountUsd", "volumeUsd"]) : null) ||
        undefined,
    });
  };

  for (const row of rows) {
    const txHash = pickTxHash(row);

    const from =
      (typeof row.fromAddress === "string" && row.fromAddress) ||
      pickAddress(row.fromAddress) ||
      (typeof row.from === "string" && row.from) ||
      pickAddress(row.from);

    const to =
      (typeof row.toAddress === "string" && row.toAddress) ||
      pickAddress(row.toAddress) ||
      (typeof row.to === "string" && row.to) ||
      pickAddress(row.to);

    const value = pickNumericLike(row.value ?? row.amount);

    if (!txHash || !from || !to) continue;
    pushTransfer(txHash, from, to, value, row);

    if (traces.length >= MAX_HOPS) break;
  }

  return traces.slice(0, MAX_HOPS);
};

export const executeTraceWorkflow = async (
  sourceAddress: string,
  chain: string,
  depth: number,
  direction: Direction
): Promise<{
  success: true;
  trace: { traces: TraceRecord[]; summary: Record<string, unknown> } | null;
  fallback?: { txCountHex?: string | null };
  message: string;
}> => {
  const flow = direction === "both" ? "all" : direction === "inbound" ? "in" : "out";
  const timeLast = depth <= 1 ? "7d" : depth === 2 ? "30d" : depth === 3 ? "90d" : depth === 4 ? "180d" : "365d";

  const rows: Array<Record<string, unknown>> = [];
  let offset = 0;
  const limit = 100;
  const maxPages = 5;

  for (let page = 0; page < maxPages; page += 1) {
    const chunk = await arkhamAddressTransfers(sourceAddress, chain, flow, timeLast, limit, offset);
    if (!chunk.length) break;
    rows.push(...(chunk as Array<Record<string, unknown>>));
    if (chunk.length < limit) break;
    offset += limit;
  }

  const traces = normalizeArkhamTransfers(rows);
  if (!traces.length) {
    return {
      success: true,
      trace: null,
      message: "No Arkham transfers found for this address within the selected time window.",
    };
  }

  const counterpartySet = new Set(
    traces.flatMap((item) => [item.action.from, item.action.to]).filter((addr) => addr !== normalizeAddress(sourceAddress))
  );

  const summary = {
    seedAddress: normalizeAddress(sourceAddress),
    chain,
    direction,
    depth,
    edgeCount: traces.length,
    counterpartyCount: counterpartySet.size,
    source: "arkham",
    timeLast,
  };

  return {
    success: true,
    trace: { traces, summary },
    message: "Trace completed using Arkham transfers endpoint.",
  };
};

const overlapScore = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const value of a.values()) {
    if (b.has(value)) shared += 1;
  }
  return shared;
};

type ClusterStrictness = "conservative" | "balanced" | "aggressive";
type ClusterTimeWindow = "7d" | "30d" | "90d" | "180d" | "365d";

type ClusterEvidence = {
  code: string;
  label: string;
  weight: number;
  value: number;
  detail: string;
};

type ClusterEdge = {
  a: string;
  b: string;
  confidence: number;
  evidence: ClusterEvidence[];
};

type ClusterCard = {
  label: string;
  addresses: string[];
  confidence: number;
  confidenceBand: "low" | "medium" | "high";
  evidence: ClusterEvidence[];
  sources: string[];
};

type ClusterWorkflowOptions = {
  requestId?: string;
  enableDebugLogs?: boolean;
};

type ClusterSeedDiagnostics = {
  seed: string;
  arkhamMembers: number;
  counterparties: number;
  transferNeighbors: number;
  counterpartiesPages: number;
  transferPages: number;
  counterpartiesRowsTotal: number;
  transferRowsTotal: number;
  usedTransferFallback: boolean;
  durationMs: number;
  notes: string[];
  parseStats: {
    counterpartiesRowsWithCandidate: number;
    counterpartiesRowsMissingCandidate: number;
    transferRowsWithParsedEndpoint: number;
    transferRowsMissingEndpoint: number;
  };
};

const makeRunId = (): string => `cluster_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

const clusterLog = (
  requestId: string,
  level: "log" | "warn" | "error",
  event: string,
  payload: Record<string, unknown>
) => {
  console[level]("[cluster]", {
    requestId,
    event,
    ...payload,
  });
};

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const confidenceBand = (value: number): "low" | "medium" | "high" => {
  if (value >= 70) return "high";
  if (value >= 45) return "medium";
  return "low";
};

const strictnessThreshold = (strictness: ClusterStrictness): number => {
  if (strictness === "conservative") return 70;
  if (strictness === "aggressive") return 40;
  return 55;
};

const pagesByTimeWindow = (timeWindow: ClusterTimeWindow): number => {
  if (timeWindow === "7d") return 2;
  if (timeWindow === "30d") return 3;
  return 5;
};

const aggregateEvidence = (edges: ClusterEdge[]): ClusterEvidence[] => {
  const byCode = new Map<string, ClusterEvidence>();

  for (const edge of edges) {
    for (const item of edge.evidence) {
      const existing = byCode.get(item.code);
      if (!existing) {
        byCode.set(item.code, { ...item });
        continue;
      }

      existing.weight += item.weight;
      existing.value += item.value;
      existing.detail = `${existing.detail}; ${item.detail}`;
    }
  }

  return Array.from(byCode.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);
};

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values)).sort();

const edgeBetween = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

const scoreEdge = (
  a: string,
  b: string,
  neighborhoods: Map<string, Set<string>>,
  transferNeighbors: Map<string, Set<string>>,
  arkhamMembersBySeed: Map<string, Set<string>>
): ClusterEdge => {
  const evidence: ClusterEvidence[] = [];

  const aCluster = arkhamMembersBySeed.get(a) || new Set<string>();
  const bCluster = arkhamMembersBySeed.get(b) || new Set<string>();
  const inSameArkhamCluster = aCluster.has(b) || bCluster.has(a);
  if (inSameArkhamCluster) {
    evidence.push({
      code: "arkhamCluster",
      label: "Arkham entity overlap",
      weight: 55,
      value: 1,
      detail: `${shortenAddressLike(a)} and ${shortenAddressLike(b)} co-appear in Arkham cluster context`,
    });
  }

  const cpA = neighborhoods.get(a) || new Set<string>();
  const cpB = neighborhoods.get(b) || new Set<string>();
  const sharedCounterparties = overlapScore(cpA, cpB);
  if (sharedCounterparties > 0) {
    const weight = Math.min(30, sharedCounterparties * 6);
    evidence.push({
      code: "counterpartyOverlap",
      label: "Shared counterparties",
      weight,
      value: sharedCounterparties,
      detail: `${sharedCounterparties} overlapping counterparties`,
    });
  }

  const txA = transferNeighbors.get(a) || new Set<string>();
  const txB = transferNeighbors.get(b) || new Set<string>();
  const sharedTransferNeighbors = overlapScore(txA, txB);
  if (sharedTransferNeighbors > 0) {
    const weight = Math.min(20, sharedTransferNeighbors * 4);
    evidence.push({
      code: "syncBehavior",
      label: "Shared transfer neighborhood",
      weight,
      value: sharedTransferNeighbors,
      detail: `${sharedTransferNeighbors} shared transfer neighbors`,
    });
  }

  const directTransfers = txA.has(b) || txB.has(a);
  if (directTransfers) {
    evidence.push({
      code: "directTransfers",
      label: "Direct seed-to-seed transfers",
      weight: 20,
      value: 1,
      detail: "Observed direct transfer adjacency between seeds",
    });
  }

  const confidence = clampScore(evidence.reduce((sum, item) => sum + item.weight, 0));
  return { a, b, confidence, evidence };
};

const shortenAddressLike = (address: string): string => `${address.slice(0, 6)}...${address.slice(-4)}`;

export const executeClusterWorkflow = async (
  seedAddresses: string[],
  chain: string,
  strictness: ClusterStrictness,
  timeWindow: ClusterTimeWindow,
  options?: ClusterWorkflowOptions
): Promise<{
  success: true;
  clusters: ClusterCard[];
  message: string;
  strictness: ClusterStrictness;
  timeWindow: ClusterTimeWindow;
  thresholds: { minEdgeConfidence: number };
  requestId: string;
}> => {
  const requestId = options?.requestId || makeRunId();
  const enableDebugLogs = options?.enableDebugLogs ?? true;
  const workflowStart = Date.now();

  const normalizedSeeds = Array.from(new Set(seedAddresses.map(normalizeAddress)));
  const perSeedCounterparties = new Map<string, Set<string>>();
  const perSeedTransferNeighbors = new Map<string, Set<string>>();
  const arkhamMembersBySeed = new Map<string, Set<string>>();
  const seedDiagnostics: ClusterSeedDiagnostics[] = [];
  const pageLimit = 100;
  const maxPages = pagesByTimeWindow(timeWindow);

  if (enableDebugLogs) {
    clusterLog(requestId, "log", "workflow_started", {
      seedCount: normalizedSeeds.length,
      chain,
      strictness,
      timeWindow,
      pageLimit,
      maxPages,
      seeds: normalizedSeeds,
    });
  }

  for (const seed of normalizedSeeds) {
    const seedStart = Date.now();
    const counterparties = new Set<string>();
    const transferNeighbors = new Set<string>();
    const arkhamMembersSet = new Set<string>();
    let counterpartiesPages = 0;
    let transferPages = 0;
    let counterpartiesRowsTotal = 0;
    let transferRowsTotal = 0;
    let usedTransferFallback = false;
    const notes: string[] = [];
    let counterpartiesRowsWithCandidate = 0;
    let counterpartiesRowsMissingCandidate = 0;
    let transferRowsWithParsedEndpoint = 0;
    let transferRowsMissingEndpoint = 0;
    let loggedCounterpartyRowShape = false;
    let loggedTransferRowShape = false;

    if (enableDebugLogs) {
      clusterLog(requestId, "log", "seed_started", {
        seed,
      });
    }

    let arkhamMembers: string[] = [];
    try {
      arkhamMembers = await arkhamClusterLookup(seed, chain);
    } catch (error) {
      notes.push("arkham_cluster_lookup_failed");
      clusterLog(requestId, "error", "seed_arkham_cluster_lookup_exception", {
        seed,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    for (const member of arkhamMembers) {
      const normalized = normalizeAddress(member);
      if (normalized && normalized !== seed) {
        arkhamMembersSet.add(normalized);
        counterparties.add(normalized);
      }
    }

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * pageLimit;
      let cpRows: Array<Record<string, unknown>> = [];
      try {
        const fetched = await arkhamAddressCounterparties(seed, chain, "all", timeWindow, pageLimit, offset);
        cpRows = fetched as Array<Record<string, unknown>>;
      } catch (error) {
        notes.push(`counterparties_page_${page}_failed`);
        clusterLog(requestId, "error", "seed_counterparties_exception", {
          seed,
          page,
          offset,
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }

      counterpartiesPages += 1;
      counterpartiesRowsTotal += cpRows.length;

      if (enableDebugLogs) {
        clusterLog(requestId, "log", "seed_counterparties_page", {
          seed,
          page,
          offset,
          rows: cpRows.length,
        });
      }

      for (const row of cpRows) {
        const candidate =
          (typeof row.address === "string" && row.address) ||
          pickAddress(row.address) ||
          (typeof row.counterparty === "string" && row.counterparty) ||
          pickAddress(row.counterparty) ||
          (typeof row.id === "string" && row.id.startsWith("0x") ? row.id : "");

        if (!candidate) {
          counterpartiesRowsMissingCandidate += 1;
          if (!loggedCounterpartyRowShape && enableDebugLogs) {
            loggedCounterpartyRowShape = true;
            clusterLog(requestId, "warn", "seed_counterparty_row_missing_candidate", {
              seed,
              page,
              sampleKeys: Object.keys(row || {}).slice(0, 20),
            });
          }
          continue;
        }

        counterpartiesRowsWithCandidate += 1;
        const normalized = normalizeAddress(candidate);
        if (normalized && normalized !== seed) {
          counterparties.add(normalized);
        }
      }

      if (cpRows.length < pageLimit) {
        break;
      }
    }

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * pageLimit;
      let transferRows: Array<Record<string, unknown>> = [];
      try {
        const fetched = await arkhamAddressTransfers(seed, chain, "all", timeWindow, pageLimit, offset);
        transferRows = fetched as Array<Record<string, unknown>>;
      } catch (error) {
        notes.push(`transfers_page_${page}_failed`);
        clusterLog(requestId, "error", "seed_transfers_exception", {
          seed,
          page,
          offset,
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }

      transferPages += 1;
      transferRowsTotal += transferRows.length;

      if (enableDebugLogs) {
        clusterLog(requestId, "log", "seed_transfers_page", {
          seed,
          page,
          offset,
          rows: transferRows.length,
        });
      }

      for (const row of transferRows) {
        const from =
          (typeof row.fromAddress === "string" && row.fromAddress) ||
          pickAddress(row.fromAddress) ||
          (typeof row.from === "string" && row.from) ||
          pickAddress(row.from) ||
          "";
        const to =
          (typeof row.toAddress === "string" && row.toAddress) ||
          pickAddress(row.toAddress) ||
          (typeof row.to === "string" && row.to) ||
          pickAddress(row.to) ||
          "";

        if (!from && !to) {
          transferRowsMissingEndpoint += 1;
          if (!loggedTransferRowShape && enableDebugLogs) {
            loggedTransferRowShape = true;
            clusterLog(requestId, "warn", "seed_transfer_row_missing_endpoints", {
              seed,
              page,
              sampleKeys: Object.keys(row || {}).slice(0, 20),
            });
          }
          continue;
        }

        transferRowsWithParsedEndpoint += 1;

        if (from) {
          const normalizedFrom = normalizeAddress(from);
          if (normalizedFrom && normalizedFrom !== seed) {
            transferNeighbors.add(normalizedFrom);
          }
        }

        if (to) {
          const normalizedTo = normalizeAddress(to);
          if (normalizedTo && normalizedTo !== seed) {
            transferNeighbors.add(normalizedTo);
          }
        }
      }

      if (transferRows.length < pageLimit) {
        break;
      }
    }

    // If cluster + counterparties provide nothing, infer neighborhood from raw transfer edges.
    if (counterparties.size === 0) {
      usedTransferFallback = true;
      for (const item of transferNeighbors) {
        counterparties.add(item);
      }
      notes.push("used_transfer_fallback_for_counterparties");
    }

    if (transferRowsTotal > 0 && transferNeighbors.size === 0) {
      notes.push("transfer_rows_present_but_no_neighbors_extracted");
      clusterLog(requestId, "warn", "seed_transfer_parse_gap", {
        seed,
        transferRowsTotal,
        transferRowsWithParsedEndpoint,
        transferRowsMissingEndpoint,
      });
    }

    if (counterpartiesRowsTotal > 0 && counterpartiesRowsWithCandidate === 0) {
      notes.push("counterparty_rows_present_but_no_candidates_extracted");
      clusterLog(requestId, "warn", "seed_counterparty_parse_gap", {
        seed,
        counterpartiesRowsTotal,
        counterpartiesRowsWithCandidate,
        counterpartiesRowsMissingCandidate,
      });
    }

    if (counterpartiesRowsTotal === 0 && transferRowsTotal > 0) {
      notes.push("counterparties_endpoint_unavailable_or_empty");
      clusterLog(requestId, "warn", "seed_counterparties_unavailable_using_transfer_fallback", {
        seed,
        counterpartiesRowsTotal,
        transferRowsTotal,
      });
    }

    perSeedCounterparties.set(seed, counterparties);
    perSeedTransferNeighbors.set(seed, transferNeighbors);
    arkhamMembersBySeed.set(seed, arkhamMembersSet);

    const seedDiag: ClusterSeedDiagnostics = {
      seed,
      arkhamMembers: arkhamMembersSet.size,
      counterparties: counterparties.size,
      transferNeighbors: transferNeighbors.size,
      counterpartiesPages,
      transferPages,
      counterpartiesRowsTotal,
      transferRowsTotal,
      usedTransferFallback,
      durationMs: Date.now() - seedStart,
      notes,
      parseStats: {
        counterpartiesRowsWithCandidate,
        counterpartiesRowsMissingCandidate,
        transferRowsWithParsedEndpoint,
        transferRowsMissingEndpoint,
      },
    };
    seedDiagnostics.push(seedDiag);

    if (enableDebugLogs) {
      const level = seedDiag.counterparties === 0 && seedDiag.transferNeighbors === 0 ? "warn" : "log";
      clusterLog(requestId, level, "seed_completed", seedDiag as unknown as Record<string, unknown>);
    }
  }

  const minEdgeConfidence = strictnessThreshold(strictness);
  const adjacency = new Map<string, Set<string>>();
  const retainedEdges = new Map<string, ClusterEdge>();

  const possiblePairs = (normalizedSeeds.length * (normalizedSeeds.length - 1)) / 2;

  for (const seed of normalizedSeeds) {
    adjacency.set(seed, new Set<string>());
  }

  for (let i = 0; i < normalizedSeeds.length; i += 1) {
    for (let j = i + 1; j < normalizedSeeds.length; j += 1) {
      const a = normalizedSeeds[i];
      const b = normalizedSeeds[j];
      const edge = scoreEdge(a, b, perSeedCounterparties, perSeedTransferNeighbors, arkhamMembersBySeed);
      if (edge.confidence < minEdgeConfidence) continue;

      adjacency.get(a)?.add(b);
      adjacency.get(b)?.add(a);
      retainedEdges.set(edgeBetween(a, b), edge);
    }
  }

  const visited = new Set<string>();
  const clusters: ClusterCard[] = [];
  for (const seed of normalizedSeeds) {
    if (visited.has(seed)) continue;

    const queue = [seed];
    const group: string[] = [];
    visited.add(seed);

    while (queue.length) {
      const current = queue.shift() as string;
      group.push(current);

      for (const next of adjacency.get(current) || []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    if (group.length <= 1) {
      continue;
    }

    const groupEdges: ClusterEdge[] = [];
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const edgeKey = edgeBetween(group[i], group[j]);
        const edge = retainedEdges.get(edgeKey);
        if (edge) {
          groupEdges.push(edge);
        }
      }
    }

    const edgeMean =
      groupEdges.length > 0
        ? groupEdges.reduce((sum, item) => sum + item.confidence, 0) / groupEdges.length
        : minEdgeConfidence;

    const confidence = clampScore(edgeMean);
    clusters.push({
      label: `likely_entity_${clusters.length + 1}`,
      addresses: uniqueSorted(group),
      confidence,
      confidenceBand: confidenceBand(confidence),
      evidence: aggregateEvidence(groupEdges),
      sources: ["arkhamCluster", "counterparties", "transfers"],
    });
  }

  clusters.sort((a, b) => b.confidence - a.confidence || b.addresses.length - a.addresses.length);

  if (enableDebugLogs) {
    clusterLog(requestId, "log", "edge_scoring_completed", {
      possiblePairs,
      retainedEdges: retainedEdges.size,
      minEdgeConfidence,
    });
  }

  if (!clusters.length) {
    clusterLog(requestId, "warn", "workflow_completed_no_clusters", {
      durationMs: Date.now() - workflowStart,
      seedDiagnostics,
      strictness,
      timeWindow,
      chain,
    });

    return {
      success: true,
      clusters: [],
      strictness,
      timeWindow,
      thresholds: { minEdgeConfidence },
      requestId,
      message: "No linked entities identified for the selected strictness and time window.",
    };
  }

  if (enableDebugLogs) {
    clusterLog(requestId, "log", "workflow_completed", {
      durationMs: Date.now() - workflowStart,
      clusterCount: clusters.length,
      topClusters: clusters.slice(0, 3).map((item) => ({
        label: item.label,
        size: item.addresses.length,
        confidence: item.confidence,
      })),
      seedDiagnostics,
    });
  }

  return {
    success: true,
    clusters,
    strictness,
    timeWindow,
    thresholds: { minEdgeConfidence },
    requestId,
    message: "Entity clustering completed with confidence-scored evidence.",
  };
};
