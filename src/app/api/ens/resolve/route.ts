import { getUserFromSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, isAddress, type Address } from "viem";
import { arbitrum, base, bsc, mainnet } from "viem/chains";
import { z } from "zod";

type SupportedChain = "ethereum" | "bsc" | "base" | "arbitrum" | "hyperliquid";

const requestSchema = z.object({
  chain: z.enum(["ethereum", "bsc", "base", "arbitrum", "hyperliquid"]),
  addresses: z.array(z.string()).max(200),
});

const ENS_TIMEOUT_MS = 7000;

const isAlchemyGetLogsTierLimitError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || "");
  return /eth_getLogs/i.test(message) && /Free tier plan/i.test(message);
};

const CHAIN_RPC_ENV: Record<SupportedChain, string | null> = {
  ethereum: "ETHEREUM_RPC_URL",
  bsc: "BSC_RPC_URL",
  base: "BASE_RPC_URL",
  arbitrum: "ARBITRUM_RPC_URL",
  hyperliquid: "HYPERLIQUID_RPC_URL",
};

const getChainRpcUrl = (chain: SupportedChain): string | null => {
  const envKey = CHAIN_RPC_ENV[chain];
  if (!envKey) return null;
  const value = process.env[envKey];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const getViemChain = (chain: SupportedChain) => {
  switch (chain) {
    case "ethereum":
      return mainnet;
    case "base":
      return base;
    case "arbitrum":
      return arbitrum;
    case "bsc":
      return bsc;
    default:
      return null;
  }
};

const getAlchemyRpcUrl = (): string | null => {
  const directCandidates = [
    process.env.ALCHEMY_MAINNET_RPC_URL,
    process.env.ALCHEMY_RPC_URL,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  const keyCandidates = [
    process.env.ALCHEMY_API_KEY,
    process.env.ALCHEMY_KEY,
  ];

  for (const key of keyCandidates) {
    if (typeof key === "string" && key.length > 0) {
      return `https://eth-mainnet.g.alchemy.com/v2/${key}`;
    }
  }

  const fallbackRpcCandidates = [
    process.env.ETHEREUM_RPC_URL,
    process.env.QUICKNODE_RPC_URL,
  ];

  for (const candidate of fallbackRpcCandidates) {
    if (typeof candidate === "string" && candidate.length > 0 && /alchemy\.com/i.test(candidate)) {
      return candidate;
    }
  }

  return null;
};

const getFallbackRpcUrl = (): string | null => {
  const candidates = [
    process.env.ETHEREUM_RPC_URL,
    process.env.QUICKNODE_RPC_URL,
    process.env.ALCHEMY_MAINNET_RPC_URL,
    "https://cloudflare-eth.com",
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
};

const resolveEnsViaAlchemy = async (
  addresses: string[]
): Promise<Record<string, string | null>> => {
  const alchemyRpcUrl = getAlchemyRpcUrl();
  if (!alchemyRpcUrl) {
    console.info("[ens-resolve] Alchemy not configured; skipping Alchemy resolver");
    return {};
  }

  const unique = Array.from(new Set(addresses.map((address) => address.toLowerCase())));
  const validAddresses = unique.filter((address) => isAddress(address));
  if (validAddresses.length === 0) {
    return {};
  }

  console.info(`[ens-resolve] Querying Alchemy first for ${validAddresses.length} address(es)`);

  const client = createPublicClient({
    chain: mainnet,
    transport: http(alchemyRpcUrl, { timeout: ENS_TIMEOUT_MS }),
  });

  const resolved: Record<string, string | null> = {};

  await Promise.all(
    validAddresses.map(async (address) => {
      try {
        const ensName = await client.getEnsName({ address: address as Address });
        resolved[address] = ensName || null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        console.warn(`[ens-resolve] Alchemy ENS lookup failed for ${address}: ${message}`);
        resolved[address] = null;
      }
    })
  );

  const resolvedCount = Object.values(resolved).filter((value) => typeof value === "string" && value.length > 0).length;
  console.info(`[ens-resolve] Alchemy resolved ${resolvedCount}/${validAddresses.length} address(es)`);

  return resolved;
};

const resolveEnsViaViem = async (addresses: string[]): Promise<Record<string, string | null>> => {
  const result: Record<string, string | null> = {};
  const rpcUrl = getFallbackRpcUrl();

  if (!rpcUrl) {
    console.info("[ens-resolve] No fallback RPC URL configured for viem ENS resolution");
    return result;
  }

  const unique = Array.from(new Set(addresses.map((address) => address.toLowerCase())));
  const validAddresses = unique.filter((address) => isAddress(address));

  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { timeout: ENS_TIMEOUT_MS }),
  });

  await Promise.all(
    validAddresses.map(async (address) => {
      try {
        const ensName = await client.getEnsName({
          address: address as Address,
        });
        result[address] = ensName || null;
      } catch {
        result[address] = null;
      }
    })
  );

  return result;
};

const resolveEnsViaPreferredChain = async (
  addresses: string[],
  preferredChain: SupportedChain
): Promise<Record<string, string | null>> => {
  const chainConfig = getViemChain(preferredChain);
  const rpcUrl = getChainRpcUrl(preferredChain);

  if (!chainConfig || !rpcUrl) {
    if (preferredChain === "hyperliquid") {
      console.info("[ens-resolve] Hyperliquid does not currently support ENS reverse resolution");
    } else {
      console.info(`[ens-resolve] No chain RPC configured for ${preferredChain}; skipping preferred-chain resolver`);
    }
    return {};
  }

  const unique = Array.from(new Set(addresses.map((address) => address.toLowerCase())));
  const validAddresses = unique.filter((address) => isAddress(address));
  if (validAddresses.length === 0) {
    return {};
  }

  console.info(`[ens-resolve] Querying ${preferredChain} resolver for ${validAddresses.length} address(es)`);

  const client = createPublicClient({
    chain: chainConfig,
    transport: http(rpcUrl, { timeout: ENS_TIMEOUT_MS }),
  });

  const resolved: Record<string, string | null> = {};

  let skippedDueToTierLimit = false;
  for (const [index, address] of validAddresses.entries()) {
    try {
      const ensName = await client.getEnsName({ address: address as Address });
      resolved[address] = ensName || null;
    } catch (error) {
      if (isAlchemyGetLogsTierLimitError(error)) {
        console.warn(
          `[ens-resolve] ${preferredChain} resolver hit Alchemy free-tier eth_getLogs range limit; skipping remaining preferred-chain lookups`
        );
        skippedDueToTierLimit = true;
        resolved[address] = null;

        for (let i = index + 1; i < validAddresses.length; i += 1) {
          resolved[validAddresses[i]] = null;
        }
        break;
      }

      const message = error instanceof Error ? error.message : "unknown error";
      console.warn(`[ens-resolve] ${preferredChain} resolver failed for ${address}: ${message}`);
      resolved[address] = null;
    }
  }

  if (skippedDueToTierLimit) {
    console.info(`[ens-resolve] ${preferredChain} preferred-chain resolution was partially skipped due to provider limits`);
  }

  const resolvedCount = Object.values(resolved).filter((value) => typeof value === "string" && value.length > 0).length;
  console.info(`[ens-resolve] ${preferredChain} resolver resolved ${resolvedCount}/${validAddresses.length} address(es)`);

  return resolved;
};

const resolveEnsBatch = async (
  addresses: string[],
  preferredChain: SupportedChain
): Promise<Record<string, string | null>> => {
  const merged: Record<string, string | null> = {};
  const unique = Array.from(new Set(addresses.map((address) => address.toLowerCase())));
  const validAddresses = unique.filter((address) => isAddress(address));

  const alchemyResolved = await resolveEnsViaAlchemy(validAddresses);
  Object.assign(merged, alchemyResolved);

  const unresolvedAfterAlchemy = validAddresses.filter((address) => !(address in merged) || merged[address] === null);

  if (unresolvedAfterAlchemy.length > 0 && preferredChain !== "ethereum") {
    const preferredResolved = await resolveEnsViaPreferredChain(unresolvedAfterAlchemy, preferredChain);
    for (const [address, ensName] of Object.entries(preferredResolved)) {
      if (ensName) {
        merged[address] = ensName;
      } else if (!(address in merged)) {
        merged[address] = null;
      }
    }
  }

  const unresolvedAfterPreferred = validAddresses.filter((address) => !(address in merged) || merged[address] === null);

  if (unresolvedAfterPreferred.length > 0) {
    console.info(
      `[ens-resolve] Falling back to viem ENS lookup for ${unresolvedAfterPreferred.length} unresolved address(es)`
    );
    const fallbackResolved = await resolveEnsViaViem(unresolvedAfterPreferred);
    for (const [address, ensName] of Object.entries(fallbackResolved)) {
      if (ensName) {
        merged[address] = ensName;
      } else if (!(address in merged)) {
        merged[address] = null;
      }
    }
  }

  for (const address of validAddresses) {
    if (!(address in merged)) {
      merged[address] = null;
    }
  }

  const totalResolved = Object.values(merged).filter((value) => typeof value === "string" && value.length > 0).length;
  console.info(`[ens-resolve] Final ENS resolution: ${totalResolved}/${validAddresses.length} address(es)`);

  return merged;
};

export async function POST(request: NextRequest) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { chain, addresses } = requestSchema.parse(body);

    const normalized = addresses
      .map((address) => address.trim())
      .filter((address) => address.length > 0);

    if (normalized.length === 0) {
      return NextResponse.json({ resolved: {} });
    }

    const resolved = await resolveEnsBatch(normalized, chain);
    return NextResponse.json({ resolved });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to resolve ENS names" }, { status: 500 });
  }
}
