import { getUserFromSession } from "@/lib/auth";
import {
  arkhamAddressEnriched,
  deSearchMentions,
  arkhamTransactionByHash,
  arkhamTransfersForTransaction,
  arkhamSwapsForAddress,
  getCachedEnrichment,
  setCachedEnrichment,
} from "@/lib/datasources";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  chain: z.enum(["ethereum", "bsc", "base", "arbitrum", "hyperliquid"]),
  txHash: z.string().min(10),
  from: z.string().min(3),
  to: z.string().min(3),
  caseId: z.string().optional(),
});

type AddressEnrichment = {
  address: string;
  label: string;
  entity: string;
  entityType: string;
  tags: string[];
  clusterIds: string[];
  isContract: boolean;
};

type TransferEnrichment = {
  transferType: "external" | "internal" | "token";
  from: string;
  to: string;
  value: string;
  usd: number | null;
  tokenSymbol: string;
  tokenName: string;
  tokenAddress: string;
};

type SwapEnrichment = {
  protocol: string;
  dex: string;
  amountIn: string;
  amountOut: string;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  usd: number | null;
  timestamp: string;
};

type SocialEnrichment = {
  author: string;
  handle: string;
  text: string;
  url: string;
  timestamp: string;
  engagementScore: number | null;
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

const collectStringArray = (value: unknown, candidateKeys: string[]): string[] => {
  if (!Array.isArray(value)) return [];

  const values: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.length > 0) {
      values.push(item);
      continue;
    }

    const row = asRecord(item);
    if (!row) continue;

    const found = pickString(row, candidateKeys);
    if (found) values.push(found);
  }

  return Array.from(new Set(values));
};

const normalizeAddressEnrichment = (address: string, data: Record<string, unknown> | null): AddressEnrichment => {
  if (!data) {
    return {
      address,
      label: "",
      entity: "",
      entityType: "",
      tags: [],
      clusterIds: [],
      isContract: false,
    };
  }

  const entityRecord = asRecord(data.arkhamEntity);
  const predictionRecord = Array.isArray(data.entityPredictions)
    ? asRecord((data.entityPredictions as unknown[])[0])
    : null;

  const tags = collectStringArray(data.populatedTags ?? data.tags, ["id", "name", "label", "tag"]);
  const clusterIds = collectStringArray(data.clusters, ["id", "clusterId", "name"]);

  return {
    address,
    label: pickString(data, ["arkhamLabel", "label", "name"]),
    entity:
      pickString(entityRecord || data, ["id", "entity", "name"]) ||
      pickString(predictionRecord || data, ["entity", "name", "id"]),
    entityType:
      pickString(entityRecord || data, ["type", "entityType", "category"]) ||
      pickString(predictionRecord || data, ["type", "entityType", "category"]),
    tags,
    clusterIds,
    isContract: Boolean(data.isContract || (entityRecord && entityRecord.contract)),
  };
};

const normalizeTransferRows = (
  transferType: "external" | "internal" | "token",
  rows: Array<Record<string, unknown>>
): TransferEnrichment[] => {
  return rows.slice(0, 40).map((row) => {
    const token = asRecord(row.token) || asRecord(row.asset) || asRecord(row.currency);

    const from = pickString(row, ["from", "fromAddress", "sender", "src"]);
    const to = pickString(row, ["to", "toAddress", "recipient", "dst"]);
    const value = pickString(row, ["value", "amount", "valueHex", "amountHex"]);

    const tokenSymbol =
      pickString(row, ["tokenSymbol", "symbol", "assetSymbol"]) ||
      (token ? pickString(token, ["symbol", "tokenSymbol", "ticker"]) : "");
    const tokenName =
      pickString(row, ["tokenName", "name", "assetName"]) ||
      (token ? pickString(token, ["name", "tokenName"]) : "");
    const tokenAddress =
      pickString(row, ["tokenAddress", "assetAddress", "contractAddress"]) ||
      (token ? pickString(token, ["address", "contract", "tokenAddress"]) : "");

    return {
      transferType,
      from,
      to,
      value: value || "n/a",
      usd: pickNumber(row, ["usd", "usdValue", "valueUsd", "amountUsd"]),
      tokenSymbol,
      tokenName,
      tokenAddress,
    };
  });
};

const normalizeSwapRows = (rows: Array<Record<string, unknown>>): SwapEnrichment[] => {
  return rows.slice(0, 10).map((row) => {
    const protocol = pickString(row, ["protocol", "protocolName", "dex", "platform"]);
    const dex = pickString(row, ["dex", "dexName", "exchange", "venue"]);
    const amountIn = pickString(row, ["amountIn", "amount_in", "inputAmount", "input"]);
    const amountOut = pickString(row, ["amountOut", "amount_out", "outputAmount", "output"]);
    const tokenInSymbol =
      pickString(row, ["tokenInSymbol", "token_in_symbol", "tokenSymbolIn", "assetInSymbol"]);
    const tokenOutSymbol =
      pickString(row, ["tokenOutSymbol", "token_out_symbol", "tokenSymbolOut", "assetOutSymbol"]);
    const usd = pickNumber(row, ["usd", "usdValue", "valueUsd", "amountUsd", "volume"]);
    const timestamp = pickString(row, ["timestamp", "time", "blockTimestamp", "date"]);

    return {
      protocol,
      dex,
      amountIn,
      amountOut,
      tokenInSymbol,
      tokenOutSymbol,
      usd,
      timestamp,
    };
  });
};

const normalizeSocialRows = (rows: Array<Record<string, unknown>>): SocialEnrichment[] => {
  return rows.slice(0, 8).map((row) => {
    const author = pickString(row, ["author", "authorName", "name", "username"]);
    const handle = pickString(row, ["handle", "screenName", "username", "user"]);
    const text = pickString(row, ["text", "content", "body", "message"]);
    const url = pickString(row, ["url", "link", "permalink"]);
    const timestamp = pickString(row, ["timestamp", "time", "createdAt", "publishedAt"]);
    const engagementScore = pickNumber(row, ["engagement", "engagementScore", "score", "likes"]);

    return {
      author,
      handle,
      text,
      url,
      timestamp,
      engagementScore,
    };
  });
};

const generateRiskNarrative = (
  from: AddressEnrichment,
  to: AddressEnrichment,
  valueUsd: number | null,
  tokenSymbol: string,
  swaps: SwapEnrichment[],
  social: SocialEnrichment[]
): string => {
  const fromLabel = from.label || from.entity || "Unknown wallet";
  const toLabel = to.label || to.entity || "Unknown wallet";
  const valueStr = valueUsd ? `~$${Math.round(valueUsd).toLocaleString()}` : "unknown amount";
  const token = tokenSymbol || "asset";

  let narrative = `${fromLabel} sent ${valueStr} ${token} to ${toLabel}`;

  // Add swap context if available
  if (swaps.length > 0) {
    const swap = swaps[0];
    if (swap.tokenInSymbol && swap.tokenOutSymbol) {
      narrative += ` [${swap.tokenInSymbol} → ${swap.tokenOutSymbol} via ${swap.dex || swap.protocol}]`;
    }
  }

  // Add entity type context for alerts
  if (from.entity && from.entityType) {
    narrative += ` (${from.entityType.toLowerCase()})`;
  }

  if (social.length > 0) {
    const topSocial = social[0];
    const socialActor = topSocial.handle || topSocial.author || "related social account";
    narrative += ` | Social signal: ${socialActor} posted related chatter`;
  }

  return narrative;
};


export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { chain, txHash, from, to, caseId } = requestSchema.parse(body);

    // Check cache first if case ID provided
    let fromIntel: Record<string, unknown> | null = null;
    let toIntel: Record<string, unknown> | null = null;

    if (caseId) {
      const cachedFromIntel = getCachedEnrichment(caseId, from);
      const cachedToIntel = getCachedEnrichment(caseId, to);
      if (cachedFromIntel) fromIntel = cachedFromIntel;
      if (cachedToIntel) toIntel = cachedToIntel;
    }

    // Fetch any missing enrichments in parallel
    const promises = [
      fromIntel ? Promise.resolve(fromIntel) : arkhamAddressEnriched(from, chain),
      toIntel ? Promise.resolve(toIntel) : arkhamAddressEnriched(to, chain),
      arkhamTransactionByHash(txHash),
      arkhamTransfersForTransaction(txHash, chain, "token"),
      arkhamTransfersForTransaction(txHash, chain, "internal"),
      arkhamTransfersForTransaction(txHash, chain, "external"),
      arkhamSwapsForAddress(from, chain),
      arkhamSwapsForAddress(to, chain),
    ] as const;

    const [
      finalFromIntel,
      finalToIntel,
      tx,
      tokenTransfers,
      internalTransfers,
      externalTransfers,
      fromSwaps,
      toSwaps,
    ] = await Promise.all(promises);

    // Cache newly fetched enrichments
    if (caseId) {
      if (!fromIntel && finalFromIntel && typeof finalFromIntel === "object" && !Array.isArray(finalFromIntel)) {
        setCachedEnrichment(caseId, from, finalFromIntel as Record<string, unknown>);
      }
      if (!toIntel && finalToIntel && typeof finalToIntel === "object" && !Array.isArray(finalToIntel)) {
        setCachedEnrichment(caseId, to, finalToIntel as Record<string, unknown>);
      }
    }

    const txRecord = tx || {};
    const txSummary = {
      from: pickString(txRecord, ["from", "fromAddress", "sender"]),
      to: pickString(txRecord, ["to", "toAddress", "recipient"]),
      method:
        pickString(txRecord, ["method", "function", "functionName"]) ||
        pickString(asRecord(txRecord.decodedCall) || txRecord, ["name", "method", "functionName"]),
      functionSignature:
        pickString(txRecord, ["functionSignature", "signature", "methodSignature"]) ||
        pickString(asRecord(txRecord.decodedCall) || txRecord, ["signature", "selector"]),
      value: pickString(txRecord, ["value", "valueHex", "amount"]),
      usd: pickNumber(txRecord, ["usd", "usdValue", "valueUsd", "amountUsd"]),
      gasUsed: pickString(txRecord, ["gasUsed", "gas", "gasSpent"]),
      timestamp: pickString(txRecord, ["timestamp", "time", "blockTimestamp"]),
      blockNumber: pickString(txRecord, ["blockNumber", "block"]),
    };

    const transfers = [
      ...normalizeTransferRows("token", tokenTransfers),
      ...normalizeTransferRows("internal", internalTransfers),
      ...normalizeTransferRows("external", externalTransfers),
    ];

    const fromAddressEnrichment = normalizeAddressEnrichment(
      from,
      finalFromIntel as Record<string, unknown> | null
    );
    const toAddressEnrichment = normalizeAddressEnrichment(to, finalToIntel as Record<string, unknown> | null);

    const swaps = [...normalizeSwapRows(fromSwaps), ...normalizeSwapRows(toSwaps)];
    const socialQuery = [
      fromAddressEnrichment.label || fromAddressEnrichment.entity,
      toAddressEnrichment.label || toAddressEnrichment.entity,
      transfers[0]?.tokenSymbol || "",
      txHash,
    ]
      .filter((part) => part && part.trim().length > 0)
      .join(" ");

    const socialRows = await deSearchMentions(socialQuery, 8);
    const social = normalizeSocialRows(socialRows);

    const narrative = generateRiskNarrative(
      fromAddressEnrichment,
      toAddressEnrichment,
      txSummary.usd,
      transfers[0]?.tokenSymbol || "",
      swaps,
      social
    );

    return NextResponse.json(
      {
        success: true,
        details: {
          txHash,
          chain,
          from: fromAddressEnrichment,
          to: toAddressEnrichment,
          tx: txSummary,
          transfers,
          swaps,
          social,
          narrative,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issueText = error.issues.map((issue) => issue.message).join("; ");
      return NextResponse.json({ error: issueText || "Invalid request" }, { status: 400 });
    }

    console.error("Trace hop details API error:", error);
    return NextResponse.json({ error: "Failed to enrich trace hop" }, { status: 500 });
  }
}
