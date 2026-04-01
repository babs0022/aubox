import { getUserFromSession } from "@/lib/auth";
import { duneBridgeRowsForAddress } from "@/lib/datasources";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bridgeAnalyzeSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chain: z.enum(["all", "ethereum", "bsc", "base", "arbitrum", "hyperliquid"]).optional().default("all"),
  debug: z.boolean().optional(),
});

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

const normalizeRow = (row: Record<string, unknown>): BridgeRow => {
  return {
    blockchain: toStringValue(row.blockchain),
    address: toStringValue(row.address),
    bridge_name: toStringValue(row.bridge_name) || "unknown_bridge",
    bridge_address: toStringValue(row.bridge_address),
    tx_count: toNumber(row.tx_count),
    inflow_txs: toNumber(row.inflow_txs),
    outflow_txs: toNumber(row.outflow_txs),
    total_amount_usd: toNumber(row.total_amount_usd),
    avg_amount_usd: toNumber(row.avg_amount_usd),
    first_seen: toStringValue(row.first_seen),
    last_seen: toStringValue(row.last_seen),
    activity_span_days: toNumber(row.activity_span_days),
  };
};

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = `bridge_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { address, chain, debug } = bridgeAnalyzeSchema.parse(body);
    const debugEnabled = Boolean(debug) || process.env.BRIDGE_EXPOSURE_DEBUG === "true";
    const duneChainFilter = chain === "all" ? "" : chain;

    console.info(
      `[bridge-exposure] request=${requestId} start chain=${chain} address=${address.toLowerCase()}`
    );

    const bridgeData = await duneBridgeRowsForAddress(address, duneChainFilter);
    if (!bridgeData) {
      const elapsedMs = Date.now() - startedAt;
      console.info(`[bridge-exposure] request=${requestId} done rows=0 elapsedMs=${elapsedMs}`);

      return NextResponse.json({
        success: true,
        queryId: null,
        summary: {
          walletAddress: address.toLowerCase(),
          chain,
          matchedRows: 0,
          bridgeCount: 0,
          totalTxs: 0,
          totalVolumeUsd: 0,
          inflowTxs: 0,
          outflowTxs: 0,
          topBridge: null,
          activeChains: [],
        },
        rows: [],
        debug: debugEnabled
          ? {
              requestId,
              elapsedMs,
              duneConfigured: Boolean(process.env.DUNE_API_KEY && process.env.DUNE_BRIDGE_QUERY_ID),
              mode: process.env.BRIDGE_EXPOSURE_DEBUG === "true" ? "env" : "request",
              rowCountRaw: 0,
            }
          : undefined,
      });
    }

    const rows = bridgeData.rows.map(normalizeRow);

    const summary = {
      walletAddress: address.toLowerCase(),
      chain,
      matchedRows: rows.length,
      bridgeCount: rows.length,
      totalTxs: rows.reduce((sum, row) => sum + row.tx_count, 0),
      totalVolumeUsd: rows.reduce((sum, row) => sum + row.total_amount_usd, 0),
      inflowTxs: rows.reduce((sum, row) => sum + row.inflow_txs, 0),
      outflowTxs: rows.reduce((sum, row) => sum + row.outflow_txs, 0),
      topBridge: rows[0]?.bridge_name || null,
      activeChains: Array.from(new Set(rows.map((row) => row.blockchain).filter((value) => value.length > 0))),
    };

    const elapsedMs = Date.now() - startedAt;
    console.info(
      `[bridge-exposure] request=${requestId} done queryId=${bridgeData.queryId} rows=${rows.length} volumeUsd=${summary.totalVolumeUsd.toFixed(2)} elapsedMs=${elapsedMs}`
    );

    if (debugEnabled) {
      console.info(
        `[bridge-exposure][debug] request=${requestId} topBridge=${summary.topBridge || "none"} chains=${summary.activeChains.join(",") || "none"}`
      );
    }

    return NextResponse.json({
      success: true,
      queryId: bridgeData.queryId,
      summary,
      rows,
      debug: debugEnabled
        ? {
            requestId,
            elapsedMs,
            mode: process.env.BRIDGE_EXPOSURE_DEBUG === "true" ? "env" : "request",
            rowCountRaw: bridgeData.rows.length,
            rowCountNormalized: rows.length,
            topBridgeAddress: rows[0]?.bridge_address || null,
            chainsSeen: summary.activeChains,
          }
        : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issueText = error.issues.map((issue) => issue.message).join("; ");
      return NextResponse.json({ error: issueText || "Invalid bridge analysis request" }, { status: 400 });
    }

    console.error(`[bridge-exposure] request=${requestId} failed`, error);
    return NextResponse.json({ error: "Failed to analyze bridge activity" }, { status: 500 });
  }
}
