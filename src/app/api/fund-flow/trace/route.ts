import { getUserFromSession } from "@/lib/auth";
import { duneFundFlowForAddress } from "@/lib/datasources";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const fundFlowTraceSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chain: z.enum(["all", "ethereum", "bsc", "base", "arbitrum", "hyperliquid"]).optional().default("all"),
  startTimestamp: z.number().int().positive(),
  stolenAmount: z.number().positive().optional(),
  txHash: z.string().optional(),
  debug: z.boolean().optional(),
});

export type FundFlowNode = {
  id: string; // address or protocol identifier
  label: string; // display name
  nodeType: "wallet" | "bridge" | "exchange" | "dex" | "staking" | "contract" | "unknown";
  chain: string;
  address?: string;
  protocolName?: string;
  totalUsd: number;
  txCount: number;
};

export type FundFlowEdge = {
  source: string; // from address
  target: string; // to address
  amount: number; // in USD
  txCount: number;
  txHashes: string[];
  firstActivity: string; // timestamp
  lastActivity: string; // timestamp
  direction: "outgoing" | "incoming";
  hopLevel: number;
};

export type FundFlowTransactionDetail = {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  amountUsd: number;
  blockchain: string;
  timestamp: string;
  protocolName?: string;
  protocolType?: string;
};

export type FundFlowSummary = {
  walletAddress: string;
  chain: string;
  startTimestamp: number;
  stolenAmount?: number;
  totalFlowUsd: number;
  nodeCount: number;
  edgeCount: number;
  topDestinations: Array<{
    address: string;
    name: string;
    type: string;
    usd: number;
  }>;
  activeChains: string[];
  distributionByType: Record<string, number>; // protocol type -> USD amount
};

export type FundFlowTraceResponse = {
  success?: boolean;
  queryId?: string | null;
  summary?: FundFlowSummary;
  nodes?: FundFlowNode[];
  edges?: FundFlowEdge[];
  transactions?: FundFlowTransactionDetail[];
  debug?: {
    requestId?: string;
    elapsedMs?: number;
    mode?: string;
    rowCountRaw?: number;
    duneConfigured?: boolean;
  };
  error?: string;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toStringValue = (value: unknown): string => {
  return typeof value === "string" ? value : "";
};

const normalizeRawRow = (
  row: Record<string, unknown>
): {
  blockchain: string;
  fromAddress: string;
  toAddress: string;
  protocolName: string;
  protocolType: string;
  amount: number;
  amountUsd: number;
  txCount: number;
  outgoingTxs: number;
  incomingTxs: number;
  firstActivity: string;
  lastActivity: string;
  txHashes: string[];
  hopLevel: number;
  flowDirection: string;
} => {
  const txHashesRaw = toStringValue(row.tx_hashes);
  const txHashes = txHashesRaw ? txHashesRaw.split(",").filter((h) => h.length > 0) : [];

  return {
    blockchain: toStringValue(row.blockchain),
    fromAddress: toStringValue(row.from_address),
    toAddress: toStringValue(row.to_address),
    protocolName: toStringValue(row.protocol_name) || "Unknown",
    protocolType: toStringValue(row.protocol_type) || "unknown",
    amount: toNumber(row.amount),
    amountUsd: toNumber(row.amount_usd || row.total_usd),
    txCount: toNumber(row.tx_count),
    outgoingTxs: toNumber(row.outgoing_txs),
    incomingTxs: toNumber(row.incoming_txs),
    firstActivity: toStringValue(row.first_activity),
    lastActivity: toStringValue(row.last_activity),
    txHashes,
    hopLevel: toNumber(row.hop_level) || 1,
    flowDirection: toStringValue(row.flow_direction) || "outgoing",
  };
};

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = `fundflow_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { address, chain, startTimestamp, stolenAmount, txHash, debug } = fundFlowTraceSchema.parse(body);
    const debugEnabled = Boolean(debug) || process.env.FUND_FLOW_DEBUG === "true";
    const duneChainFilter = chain === "all" ? "" : chain;

    console.info(
      `[fund-flow] request=${requestId} start chain=${chain} address=${address.toLowerCase()} startTs=${startTimestamp}`
    );

    const flowData = await duneFundFlowForAddress(address, duneChainFilter, startTimestamp, txHash);
    if (!flowData || flowData.rows.length === 0) {
      const elapsedMs = Date.now() - startedAt;
      console.info(
        `[fund-flow] request=${requestId} done rows=0 elapsedMs=${elapsedMs}`
      );

      return NextResponse.json({
        success: true,
        queryId: flowData?.queryId || null,
        summary: {
          walletAddress: address.toLowerCase(),
          chain,
          startTimestamp,
          stolenAmount,
          totalFlowUsd: 0,
          nodeCount: 0,
          edgeCount: 0,
          topDestinations: [],
          activeChains: [],
          distributionByType: {},
        },
        nodes: [],
        edges: [],
        transactions: [],
        debug: debugEnabled
          ? {
              requestId,
              elapsedMs,
              mode: process.env.FUND_FLOW_DEBUG === "true" ? "env" : "request",
              rowCountRaw: 0,
              duneConfigured: Boolean(process.env.DUNE_API_KEY && process.env.DUNE_FUND_FLOW_QUERY_ID),
            }
          : undefined,
      });
    }

    // Normalize rows
    const normalizedRows = flowData.rows.map(normalizeRawRow);

    // Build graph nodes and edges
    const nodes: Map<string, FundFlowNode> = new Map();
    const edges: FundFlowEdge[] = [];
    const transactionDetails: FundFlowTransactionDetail[] = [];
    let totalFlowUsd = 0;
    const distributionByType: Record<string, number> = {};
    const topDestinations: Array<{ address: string; name: string; type: string; usd: number }> = [];

    // Track starting wallet as node
    const startNodeId = address.toLowerCase();
    nodes.set(startNodeId, {
      id: startNodeId,
      label: "Hacked Wallet",
      nodeType: "wallet",
      chain,
      address: address.toLowerCase(),
      totalUsd: 0,
      txCount: 0,
    });

    // Process each transfer
    normalizedRows.forEach((row) => {
      const fromId = row.fromAddress.toLowerCase();
      const toId = row.toAddress.toLowerCase();
      const protocolType = (row.protocolType as FundFlowNode["nodeType"]) || "unknown";

      // Ensure from node exists
      if (!nodes.has(fromId)) {
        nodes.set(fromId, {
          id: fromId,
          label: row.protocolName || fromId.slice(0, 6),
          nodeType: protocolType,
          chain: row.blockchain,
          address: fromId,
          protocolName: row.protocolName,
          totalUsd: 0,
          txCount: 0,
        });
      }

      // Ensure to node exists
      if (!nodes.has(toId)) {
        nodes.set(toId, {
          id: toId,
          label: row.protocolName || toId.slice(0, 6),
          nodeType: protocolType,
          chain: row.blockchain,
          address: toId,
          protocolName: row.protocolName,
          totalUsd: 0,
          txCount: 0,
        });
      }

      // Update to node with flow data
      const toNode = nodes.get(toId)!;
      toNode.totalUsd += row.amountUsd;
      toNode.txCount += row.txCount;

      // Create edge
      edges.push({
        source: fromId,
        target: toId,
        amount: row.amountUsd,
        txCount: row.txCount,
        txHashes: row.txHashes,
        firstActivity: row.firstActivity,
        lastActivity: row.lastActivity,
        direction: (row.flowDirection as "outgoing" | "incoming") || "outgoing",
        hopLevel: row.hopLevel,
      });

      totalFlowUsd += row.amountUsd;
      distributionByType[protocolType] = (distributionByType[protocolType] || 0) + row.amountUsd;

      // Track top destinations
      if (toNode.address && row.amountUsd > 0) {
        const existingDest = topDestinations.find((d) => d.address === toId);
        if (existingDest) {
          existingDest.usd += row.amountUsd;
        } else {
          topDestinations.push({
            address: toId,
            name: row.protocolName || toId.slice(0, 10),
            type: protocolType,
            usd: row.amountUsd,
          });
        }
      }
    });

    // Sort top destinations by USD
    topDestinations.sort((a, b) => b.usd - a.usd);
    topDestinations.splice(5); // Keep top 5

    // Get active chains
    const activeChains = Array.from(new Set(normalizedRows.map((r) => r.blockchain).filter((v) => v.length > 0)));

    const summary: FundFlowSummary = {
      walletAddress: address.toLowerCase(),
      chain,
      startTimestamp,
      stolenAmount,
      totalFlowUsd,
      nodeCount: nodes.size,
      edgeCount: edges.length,
      topDestinations,
      activeChains,
      distributionByType,
    };

    const elapsedMs = Date.now() - startedAt;
    console.info(
      `[fund-flow] request=${requestId} done queryId=${flowData.queryId} nodes=${nodes.size} edges=${edges.length} volumeUsd=${totalFlowUsd.toFixed(2)} elapsedMs=${elapsedMs}`
    );

    if (debugEnabled) {
      console.info(
        `[fund-flow][debug] request=${requestId} chains=${activeChains.join(",") || "none"} types=${Object.keys(distributionByType).join(",")}  || "none"`
      );
    }

    return NextResponse.json({
      success: true,
      queryId: flowData.queryId,
      summary,
      nodes: Array.from(nodes.values()),
      edges,
      transactions: transactionDetails,
      debug: debugEnabled
        ? {
            requestId,
            elapsedMs,
            mode: process.env.FUND_FLOW_DEBUG === "true" ? "env" : "request",
            rowCountRaw: flowData.rows.length,
            duneConfigured: Boolean(process.env.DUNE_API_KEY && process.env.DUNE_FUND_FLOW_QUERY_ID),
          }
        : undefined,
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    
    if (error instanceof z.ZodError) {
      const issueText = error.issues.map((issue) => issue.message).join("; ");
      console.error(`[fund-flow] request=${requestId} validation error`, issueText);
      return NextResponse.json({ error: issueText || "Invalid fund flow trace request" }, { status: 400 });
    }

    console.error(`[fund-flow] request=${requestId} failed after ${elapsedMs}ms`, error);
    return NextResponse.json({ error: "Failed to trace fund flow" }, { status: 500 });
  }
}
