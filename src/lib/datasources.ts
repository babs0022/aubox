import axios from "axios";

interface BlockchainData {
  address: string;
  chain: string;
  balance?: string;
  txCount?: number;
  firstSeen?: string;
  lastSeen?: string;
  labels?: string[];
  counterparties?: string[];
  contracts?: string[];
}

interface ArkhamLookupResult {
  labels: string[];
  riskScore: number | null;
  raw: unknown;
}

type WalletRiskComputation = {
  score: number;
  factors: string[];
};

const CHAIN_RPC_ENV: Record<string, string> = {
  ethereum: "ETHEREUM_RPC_URL",
  bsc: "BSC_RPC_URL",
  base: "BASE_RPC_URL",
  arbitrum: "ARBITRUM_RPC_URL",
  hyperliquid: "HYPERLIQUID_RPC_URL",
};

const getRpcUrl = (chain: string): string | null => {
  const envKey = CHAIN_RPC_ENV[chain];
  if (!envKey) {
    return null;
  }

  const value = process.env[envKey];
  return value && value.length > 0 ? value : null;
};

const ARKHAM_BASE_URL = process.env.ARKHAM_API_URL || "https://api.arkm.com";
const NANSEN_BASE_URL = process.env.NANSEN_API_URL || "https://api.nansen.ai/api/v1";
const DESEARCH_BASE_URL = process.env.DESEARCH_API_URL || "https://api.desearch.ai";
const DEFILLAMA_BASE_URL = process.env.DEFILLAMA_API_URL || "https://api.llama.fi";
const DUNE_BASE_URL = process.env.DUNE_API_URL || "https://api.dune.com/api/v1";
const PROVIDER_TIMEOUT_MS = 6000;
const DESEARCH_SEARCH_PATH = process.env.DESEARCH_SEARCH_PATH || "/twitter";
const DESEARCH_SEARCH_FALLBACK_PATHS = (
  process.env.DESEARCH_SEARCH_FALLBACK_PATHS || "/twitter,/desearch/ai/search/links/twitter"
)
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);
const ARKHAM_MIN_INTERVAL_MS = 1100;
let lastArkhamRequestAt = 0;
let resolvedDeSearchRoute: { method: "GET" | "POST"; path: string } | null = null;
let deSearchDisabledUntil = 0;
let warnedDeSearchNoKey = false;
const DESEARCH_DISABLE_COOLDOWN_MS = 5 * 60 * 1000;
const DESEARCH_ROUTE_FAIL_COOLDOWN_MS = 30 * 60 * 1000;
const DESEARCH_DEBUG = process.env.DESEARCH_DEBUG === "true";
const deSearchRouteFailUntil = new Map<string, number>();

type DeSearchMethod = "GET" | "POST";

export type DeSearchRequestAttempt = {
  method: DeSearchMethod;
  path: string;
  status: number | null;
};

export type DeSearchDiagnostics = {
  strategy: string;
  selectedRoute: { method: DeSearchMethod; path: string } | null;
  attempts: DeSearchRequestAttempt[];
};

type DeSearchAttemptRecorder = (attempt: DeSearchRequestAttempt) => void;
type DeSearchSortPreference = "Top" | "Latest";

type ArkhamTransferDirection = "in" | "out" | "all";

type ArkhamTransferRow = {
  from?: string;
  fromAddress?: string;
  to?: string;
  toAddress?: string;
  txHash?: string;
  hash?: string;
  transactionHash?: string;
  value?: string | number;
  amount?: string | number;
  blockNumber?: string | number;
};

type ArkhamCounterpartyRow = {
  address?: string;
  counterparty?: string;
  entity?: string;
  id?: string;
};

type ArkhamTransferType = "external" | "internal" | "token";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const arkhamGet = async <T>(path: string, params?: Record<string, unknown>): Promise<T | null> => {
  const apiKey = process.env.ARKHAM_API_KEY;
  if (!apiKey) {
    console.warn("ARKHAM_API_KEY is not set");
    return null;
  }

  const now = Date.now();
  const wait = Math.max(0, ARKHAM_MIN_INTERVAL_MS - (now - lastArkhamRequestAt));
  if (wait > 0) {
    await sleep(wait);
  }
  lastArkhamRequestAt = Date.now();

  try {
    const response = await axios.get(`${ARKHAM_BASE_URL}${path}`, {
      params,
      headers: {
        "Content-Type": "application/json",
        "API-Key": apiKey,
      },
      timeout: 15000,
    });

    return response.data as T;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.warn(`Arkham GET ${path} failed`, {
        status: error.response?.status,
        message: error.message,
        params,
        responseData:
          error.response?.data && typeof error.response.data === "object"
            ? JSON.stringify(error.response.data).slice(0, 500)
            : String(error.response?.data || ""),
      });
    }
    return null;
  }
};

type NansenTokenTransfer = {
  token_symbol?: string;
  token_amount?: number;
  token_address?: string;
  from_address?: string;
  to_address?: string;
  value_usd?: number;
};

type NansenAddressTransaction = {
  chain?: string;
  transaction_hash?: string;
  block_timestamp?: string;
  tokens_sent?: NansenTokenTransfer[];
  tokens_received?: NansenTokenTransfer[];
  volume_usd?: number;
  source_type?: string;
};

type NansenRelatedWallet = {
  address?: string;
  address_label?: string;
  relation?: string;
  transaction_hash?: string;
  block_timestamp?: string;
  order?: number;
  chain?: string;
};

const nansenPost = async (path: string, body: Record<string, unknown>) => {
  const apiKey = process.env.NANSEN_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await axios.post(`${NANSEN_BASE_URL}${path}`, body, {
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
    });

    return response.data as { data?: unknown[]; pagination?: { is_last_page?: boolean; page?: number } };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) {
        console.warn(`Nansen ${path} hit rate limit (429).`);
      } else if (status === 401 || status === 403 || status === 402) {
        console.warn(`Nansen ${path} auth/plan issue (${status}).`);
      } else {
        console.warn(`Nansen ${path} failed with status ${status ?? "unknown"}.`);
      }
    }
    return null;
  }
};

export const nansenAddressTransactions = async (
  address: string,
  chain: string,
  fromIso: string,
  toIso: string,
  perPage: number = 100
): Promise<NansenAddressTransaction[]> => {
  const rows: NansenAddressTransaction[] = [];
  let page = 1;
  let keepPaging = true;

  while (keepPaging && page <= 4) {
    const response = await nansenPost("/profiler/address/transactions", {
      address,
      chain,
      date: {
        from: fromIso,
        to: toIso,
      },
      hide_spam_token: true,
      pagination: {
        page,
        per_page: Math.max(10, Math.min(100, perPage)),
      },
      order_by: [{ field: "block_timestamp", direction: "ASC" }],
    });

    if (!response || !Array.isArray(response.data) || response.data.length === 0) {
      break;
    }

    rows.push(...(response.data as NansenAddressTransaction[]));
    const lastPage = Boolean(response.pagination?.is_last_page);
    if (lastPage) {
      keepPaging = false;
    } else {
      page += 1;
    }
  }

  return rows;
};

export const nansenRelatedWallets = async (
  address: string,
  chain: string,
  perPage: number = 100
): Promise<NansenRelatedWallet[]> => {
  const response = await nansenPost("/profiler/address/related-wallets", {
    address,
    chain,
    pagination: {
      page: 1,
      per_page: Math.max(10, Math.min(100, perPage)),
    },
    order_by: [{ field: "order", direction: "ASC" }],
  });

  if (!response || !Array.isArray(response.data)) {
    return [];
  }

  return response.data as NansenRelatedWallet[];
};

// Generic RPC wrapper for any supported chain URL
export const rpcCall = async (chain: string, method: string, params: unknown[]) => {
  const rpcUrl = getRpcUrl(chain);
  if (!rpcUrl) {
    console.warn(`No RPC URL configured for ${chain}`);
    return null;
  }

  try {
    const response = await axios.post(
      rpcUrl,
      {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: PROVIDER_TIMEOUT_MS,
      }
    );

    return response.data.result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 413) {
        console.warn(`RPC ${method} for ${chain} returned 413 (payload too large); caller should reduce query range.`);
      } else {
        console.error(`RPC ${method} failed for ${chain} with status ${status ?? "unknown"}: ${error.message}`);
      }
    } else {
      console.error(`RPC ${method} failed for ${chain}:`, error);
    }
    return null;
  }
};

// Arkham API wrapper for labels and entity intel
export const arkhamLookup = async (address: string, chain?: string): Promise<ArkhamLookupResult | null> => {
  try {
    const apiKey = process.env.ARKHAM_API_KEY;
    if (!apiKey) {
      console.warn("ARKHAM_API_KEY is not set");
      return null;
    }

    const params: Record<string, string> = {
      includeTags: "true",
      includeEntityPredictions: "true",
      includeClusters: "true",
    };

    if (chain) {
      params.chain = chain;
    }

    const response = await axios.get(`${ARKHAM_BASE_URL}/intelligence/address_enriched/${address}`, {
      params,
      headers: {
        "Content-Type": "application/json",
        "API-Key": apiKey,
      },
      timeout: PROVIDER_TIMEOUT_MS,
    });

    const data = response.data as Record<string, unknown>;
    console.log(`[Arkham] Response for ${address}:`, {
      status: response.status,
      hasLabels: "labels" in data,
      hasArkhamLabel: "arkhamLabel" in data,
      hasTags: "tags" in data,
      hasPopulatedTags: "populatedTags" in data,
      hasRiskScore: "riskScore" in data,
      hasArkhamEntity: "arkhamEntity" in data,
      keys: Object.keys(data),
    });

    // Parse arkhamLabel (can be string, array, or null)
    const arkhamLabels: string[] = [];
    if (typeof data.arkhamLabel === "string" && data.arkhamLabel) {
      arkhamLabels.push(data.arkhamLabel);
    } else if (Array.isArray(data.arkhamLabel)) {
      arkhamLabels.push(
        ...data.arkhamLabel.filter((val): val is string => typeof val === "string")
      );
    }

    // Parse populatedTags (array of objects/strings)
    const tagLabels: string[] = [];
    if (Array.isArray(data.populatedTags)) {
      tagLabels.push(
        ...data.populatedTags
          .map((tag) => {
            if (typeof tag === "string") return tag;
            if (tag && typeof tag === "object" && "id" in tag && typeof tag.id === "string") return tag.id;
            if (tag && typeof tag === "object" && "name" in tag && typeof tag.name === "string") return tag.name;
            return null;
          })
          .filter((value): value is string => Boolean(value))
      );
    }

    // Fallback to old structure for compatibility
    const directLabels = Array.isArray(data.labels)
      ? data.labels.filter((value): value is string => typeof value === "string")
      : [];
    const legacyTagLabels = Array.isArray(data.tags)
      ? data.tags
          .map((tag) => {
            if (typeof tag === "string") return tag;
            if (tag && typeof tag === "object" && "id" in tag && typeof tag.id === "string") return tag.id;
            if (tag && typeof tag === "object" && "name" in tag && typeof tag.name === "string") return tag.name;
            return null;
          })
          .filter((value): value is string => Boolean(value))
      : [];

    const labels = Array.from(new Set([...arkhamLabels, ...tagLabels, ...directLabels, ...legacyTagLabels]));

    // Extract risk score from arkhamEntity if present
    let riskScore: number | null = null;
    if (typeof data.riskScore === "number") {
      riskScore = data.riskScore;
    } else if (data.arkhamEntity && typeof data.arkhamEntity === "object") {
      const entity = data.arkhamEntity as Record<string, unknown>;
      // Try common risk score field names
      if (typeof entity.riskScore === "number") {
        riskScore = entity.riskScore;
      } else if (typeof entity.risk === "number") {
        riskScore = entity.risk;
      } else if (typeof entity.riskLevel === "number") {
        riskScore = entity.riskLevel;
      }
    }

    console.log(`[Arkham] Parsed result for ${address}:`, { 
      labelCount: labels.length, 
      labels, 
      riskScore,
      arkhamEntityKeys: data.arkhamEntity && typeof data.arkhamEntity === "object" 
        ? Object.keys(data.arkhamEntity as Record<string, unknown>) 
        : [],
    });

    return {
      labels,
      riskScore,
      raw: data,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Arkham lookup failed for ${address}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        data: error.response?.data,
      });
    } else {
      console.error(`Arkham lookup failed for ${address}:`, error);
    }
    return null;
  }
};

export const arkhamClusterLookup = async (address: string, chain?: string): Promise<string[]> => {
  try {
    const apiKey = process.env.ARKHAM_API_KEY;
    if (!apiKey) {
      console.warn("ARKHAM_API_KEY not set, skipping Arkham cluster lookup");
      return [];
    }

    // Call Arkham address_enriched endpoint which includes cluster info
    const params: Record<string, string> = {
      includeTags: "true",
      includeEntityPredictions: "true",
      includeClusters: "true",
    };

    if (chain) {
      params.chain = chain;
    }

    const response = await axios.get(`${ARKHAM_BASE_URL}/intelligence/address_enriched/${address}`, {
      params,
      headers: {
        "Content-Type": "application/json",
        "API-Key": apiKey,
      },
    });

    const data = response.data as Record<string, unknown>;
    const clusterMembers: string[] = [];

    // Check multiple possible field names for cluster/entity data
    const possibleClusterFields = ["clusters", "entityCluster", "clusterMembers", "entityMembers", "linkedEntities"];
    
    for (const fieldName of possibleClusterFields) {
      const field = data[fieldName];
      
      // Handle array of clusters
      if (Array.isArray(field)) {
        for (const item of field) {
          if (!item || typeof item !== "object") continue;
          const itemData = item as Record<string, unknown>;

          // Extract addresses from various possible field names within cluster
          const addressFields = ["address", "id", "member", "entity", "wallet"];
          for (const addrField of addressFields) {
            const addr = itemData[addrField];
            if (typeof addr === "string" && addr.startsWith("0x")) {
              clusterMembers.push(addr.toLowerCase());
            }
          }

          // Check for nested members array
          if (Array.isArray(itemData.members)) {
            for (const member of itemData.members) {
              if (typeof member === "string" && member.startsWith("0x")) {
                clusterMembers.push(member.toLowerCase());
              } else if (member && typeof member === "object") {
                const memberObj = member as Record<string, unknown>;
                for (const addrField of ["address", "id", "wallet"]) {
                  if (typeof memberObj[addrField] === "string") {
                    clusterMembers.push((memberObj[addrField] as string).toLowerCase());
                  }
                }
              }
            }
          }
        }
      }

      // Handle direct object with entity data
      if (!Array.isArray(field) && field && typeof field === "object") {
        const fieldObj = field as Record<string, unknown>;
        
        if (Array.isArray(fieldObj.members)) {
          for (const member of fieldObj.members) {
            if (typeof member === "string" && member.startsWith("0x")) {
              clusterMembers.push(member.toLowerCase());
            }
          }
        }
        
        if (Array.isArray(fieldObj.addresses)) {
          for (const addr of fieldObj.addresses) {
            if (typeof addr === "string" && addr.startsWith("0x")) {
              clusterMembers.push(addr.toLowerCase());
            }
          }
        }
      }
    }

    // Check for relatedAddresses field (common in Arkham API)
    if (Array.isArray(data.relatedAddresses)) {
      for (const item of data.relatedAddresses) {
        if (typeof item === "string" && item.startsWith("0x")) {
          clusterMembers.push(item.toLowerCase());
        } else if (item && typeof item === "object") {
          const relAddr = (item as Record<string, unknown>).address;
          if (typeof relAddr === "string" && relAddr.startsWith("0x")) {
            clusterMembers.push(relAddr.toLowerCase());
          }
        }
      }
    }

    // Common response shape: arkhamEntity.addresses[] contains linked wallets.
    if (data.arkhamEntity && typeof data.arkhamEntity === "object") {
      const entity = data.arkhamEntity as Record<string, unknown>;
      if (Array.isArray(entity.addresses)) {
        for (const item of entity.addresses) {
          if (typeof item === "string" && item.startsWith("0x")) {
            clusterMembers.push(item.toLowerCase());
            continue;
          }
          if (!item || typeof item !== "object") continue;
          const row = item as Record<string, unknown>;
          const entityAddress = row.address;
          if (typeof entityAddress === "string" && entityAddress.startsWith("0x")) {
            clusterMembers.push(entityAddress.toLowerCase());
          }
        }
      }
    }

    const uniqueMembers = Array.from(new Set(clusterMembers)).filter((member) => member !== address.toLowerCase());
    
    if (uniqueMembers.length > 0) {
      console.log(`Arkham cluster lookup for ${address}: found ${uniqueMembers.length} related addresses`);
    } else {
      console.log(`Arkham cluster lookup for ${address}: no cluster data found in response`);
    }

    return uniqueMembers;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) {
        console.warn("Arkham cluster lookup hit rate limit");
      } else if (status === 401 || status === 403) {
        console.warn("Arkham cluster lookup auth failed - check API key");
      } else {
        console.error(`Arkham cluster lookup failed with status ${status}`);
      }
    } else {
      console.error("Arkham cluster lookup failed:", error);
    }
    return [];
  }
};

export const arkhamAddressTransfers = async (
  address: string,
  chain: string,
  direction: ArkhamTransferDirection,
  timeLast: string = "7d",
  limit: number = 100,
  offset: number = 0
): Promise<ArkhamTransferRow[]> => {
  const data = await arkhamGet<unknown>("/transfers", {
    base: address,
    chains: chain,
    flow: direction,
    timeLast,
    sortKey: "time",
    sortDir: "desc",
    limit,
    offset,
  });

  if (!data) return [];

  if (Array.isArray(data)) {
    return data.filter((item): item is ArkhamTransferRow => Boolean(item && typeof item === "object"));
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidateArrays = [obj.results, obj.data, obj.items, obj.transfers];
    for (const candidate of candidateArrays) {
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is ArkhamTransferRow => Boolean(item && typeof item === "object"));
      }
    }
  }

  return [];
};

export const arkhamAddressCounterparties = async (
  address: string,
  chain: string,
  flow: ArkhamTransferDirection = "all",
  timeLast: string = "30d",
  limit: number = 100,
  offset: number = 0
): Promise<ArkhamCounterpartyRow[]> => {
  const extractRows = (data: unknown): ArkhamCounterpartyRow[] => {
    if (!data) return [];

    if (Array.isArray(data)) {
      return data.filter((item): item is ArkhamCounterpartyRow => Boolean(item && typeof item === "object"));
    }

    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      const candidateArrays = [obj.results, obj.data, obj.items, obj.counterparties];
      for (const candidate of candidateArrays) {
        if (Array.isArray(candidate)) {
          return candidate.filter((item): item is ArkhamCounterpartyRow => Boolean(item && typeof item === "object"));
        }
      }
    }

    return [];
  };

  const attempts: Array<Record<string, unknown>> = [
    {
      chains: [chain],
      flow,
      timeLast,
      sortKey: "usd",
      sortDir: "desc",
      limit,
      offset,
    },
    {
      chains: chain,
      flow,
      timeLast,
      sortKey: "usd",
      sortDir: "desc",
      limit,
      offset,
    },
    {
      chains: chain,
      flow,
      last: timeLast,
      sortKey: "usd",
      sortDir: "desc",
      limit,
      offset,
    },
    {
      flow,
      timeLast,
      limit,
      offset,
    },
    {
      flow,
      limit,
      offset,
    },
  ];

  for (const params of attempts) {
    const payload = await arkhamGet<unknown>(`/counterparties/address/${address}`, params);
    if (payload === null) {
      // Endpoint frequently returns 500 for some chains/addresses; fallback logic uses transfers.
      console.warn("Arkham counterparties unavailable; skipping remaining param-shape attempts", {
        address,
        chain,
        flow,
        timeLast,
      });
      return [];
    }

    const rows = extractRows(payload);
    if (rows.length > 0) {
      return rows;
    }
  }

  return [];
};

export const arkhamAddressEnriched = async (
  address: string,
  chain?: string
): Promise<Record<string, unknown> | null> => {
  const params: Record<string, unknown> = {
    includeTags: true,
    includeEntityPredictions: true,
    includeClusters: true,
  };

  if (chain) {
    params.chain = chain;
  }

  const data = await arkhamGet<unknown>(`/intelligence/address_enriched/${address}`, params);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  return data as Record<string, unknown>;
};

export const arkhamTransactionByHash = async (
  hash: string
): Promise<Record<string, unknown> | null> => {
  const data = await arkhamGet<unknown>(`/tx/${hash}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  return data as Record<string, unknown>;
};

export const arkhamTransfersForTransaction = async (
  hash: string,
  chain: string,
  transferType: ArkhamTransferType
): Promise<Array<Record<string, unknown>>> => {
  const data = await arkhamGet<unknown>(`/transfers/tx/${hash}`, {
    chain,
    transferType,
  });

  if (!data) return [];

  if (Array.isArray(data)) {
    return data.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidateArrays = [obj.results, obj.data, obj.items, obj.transfers];
    for (const candidate of candidateArrays) {
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
      }
    }
  }

  return [];
};

export const arkhamSwapsForAddress = async (
  address: string,
  chain: string
): Promise<Array<Record<string, unknown>>> => {
  const data = await arkhamGet<unknown>(`/swaps`, {
    address,
    chain,
    limit: 50,
    sortBy: "value",
    sortDirection: "desc",
  });

  if (!data) return [];

  if (Array.isArray(data)) {
    return data.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidateArrays = [obj.results, obj.data, obj.items, obj.swaps];
    for (const candidate of candidateArrays) {
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
      }
    }
  }

  return [];
};

// Enrichment cache: keyed by caseId:address for per-case validation isolation
const enrichmentCache = new Map<string, { data: Record<string, unknown>; timestamp: number }>();
const ENRICHMENT_CACHE_TTL_MS = 3600000; // 1 hour

export const getEnrichmentCacheKey = (caseId: string, address: string): string => {
  return `${caseId}:${address.toLowerCase()}`;
};

export const getCachedEnrichment = (caseId: string, address: string): Record<string, unknown> | null => {
  const key = getEnrichmentCacheKey(caseId, address);
  const cached = enrichmentCache.get(key);
  if (!cached) return null;

  const ageMs = Date.now() - cached.timestamp;
  if (ageMs > ENRICHMENT_CACHE_TTL_MS) {
    enrichmentCache.delete(key);
    return null;
  }

  return cached.data;
};

export const setCachedEnrichment = (caseId: string, address: string, data: Record<string, unknown>): void => {
  const key = getEnrichmentCacheKey(caseId, address);
  enrichmentCache.set(key, { data, timestamp: Date.now() });
};

const normalizeApiPath = (value: string): string => {
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
};

const uniqueSearchPaths = (): string[] => {
  const preferred = ["/twitter", "/desearch/ai/search/links/twitter"];
  const seen = new Set<string>();
  const paths = [...preferred, DESEARCH_SEARCH_PATH, ...DESEARCH_SEARCH_FALLBACK_PATHS]
    .map(normalizeApiPath)
    .filter((path) => {
      if (seen.has(path)) {
        return false;
      }
      seen.add(path);
      return true;
    });
  return paths;
};

const deSearchGet = async <T>(
  path: string,
  params?: Record<string, unknown>,
  onAttempt?: DeSearchAttemptRecorder
): Promise<{ data: T | null; status?: number }> => {
  const apiKey = process.env.DESEARCH_API_KEY;
  if (!apiKey) {
    if (!warnedDeSearchNoKey) {
      warnedDeSearchNoKey = true;
      console.warn("DESEARCH_API_KEY is not set; skipping deSearch requests");
    }
    return { data: null };
  }

  if (DESEARCH_DEBUG) {
    console.log("deSearch GET request", { path, params });
  }

  try {
    const response = await axios.get(`${DESEARCH_BASE_URL}${path}`, {
      params,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        Authorization: apiKey,
      },
      timeout: 15000,
    });

    onAttempt?.({ method: "GET", path, status: response.status });

    return { data: response.data as T, status: response.status };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      onAttempt?.({ method: "GET", path, status: error.response?.status ?? null });
      if (DESEARCH_DEBUG) {
        console.warn("deSearch GET failed", {
          path,
          status: error.response?.status,
          data:
            error.response?.data && typeof error.response.data === "object"
              ? JSON.stringify(error.response.data).slice(0, 400)
              : String(error.response?.data || ""),
        });
      }
      return { data: null, status: error.response?.status };
    }
    return { data: null };
  }
};

const deSearchPost = async <T>(
  path: string,
  body?: Record<string, unknown>,
  onAttempt?: DeSearchAttemptRecorder
): Promise<{ data: T | null; status?: number }> => {
  const apiKey = process.env.DESEARCH_API_KEY;
  if (!apiKey) {
    if (!warnedDeSearchNoKey) {
      warnedDeSearchNoKey = true;
      console.warn("DESEARCH_API_KEY is not set; skipping deSearch requests");
    }
    return { data: null };
  }

  if (DESEARCH_DEBUG) {
    console.log("deSearch POST request", { path, body });
  }

  try {
    const response = await axios.post(`${DESEARCH_BASE_URL}${path}`, body, {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        Authorization: apiKey,
      },
      timeout: 15000,
    });

    onAttempt?.({ method: "POST", path, status: response.status });

    return { data: response.data as T, status: response.status };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      onAttempt?.({ method: "POST", path, status: error.response?.status ?? null });
      if (DESEARCH_DEBUG) {
        console.warn("deSearch POST failed", {
          path,
          status: error.response?.status,
          data:
            error.response?.data && typeof error.response.data === "object"
              ? JSON.stringify(error.response.data).slice(0, 400)
              : String(error.response?.data || ""),
        });
      }
      return { data: null, status: error.response?.status };
    }
    return { data: null };
  }
};

const extractDeSearchRows = (data: unknown): Array<Record<string, unknown>> => {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidateArrays = [obj.results, obj.data, obj.items, obj.posts, obj.hits, obj.tweets, obj.miner_tweets];
    for (const candidate of candidateArrays) {
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
      }
    }

    // Some deSearch endpoints return { user, tweets: [...] } or nested payloads.
    if (obj.tweets && Array.isArray(obj.tweets)) {
      return obj.tweets.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    }
  }

  return [];
};

const uniqueRows = (rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> => {
  const seen = new Set<string>();
  const out: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const id =
      (typeof row.id === "string" && row.id) ||
      (typeof row.id_str === "string" && row.id_str) ||
      (typeof row.url === "string" && row.url) ||
      JSON.stringify(row).slice(0, 180);

    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(row);
  }

  return out;
};

const deSearchMentionsByUsernames = async (
  usernames: string[],
  query: string,
  limit: number,
  onAttempt?: DeSearchAttemptRecorder
): Promise<Array<Record<string, unknown>>> => {
  const cleanedUsers = Array.from(
    new Set(
      usernames
        .map((value) => value.trim().replace(/^@+/, ""))
        .filter((value) => value.length > 0)
    )
  );

  if (cleanedUsers.length === 0) {
    return [];
  }

  const perUserLimit = Math.max(1, Math.min(100, limit));
  const userResults: Array<Record<string, unknown>> = [];
  const queryWithoutSelfUsernames = query
    .replace(/@[a-zA-Z0-9_]{1,15}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const username of cleanedUsers.slice(0, 5)) {
    const primaryParams: Record<string, unknown> = {
      user: username,
      count: perUserLimit,
    };
    if (queryWithoutSelfUsernames.length > 0) {
      primaryParams.query = queryWithoutSelfUsernames;
    }

    const primary = await deSearchGet<unknown>("/twitter/post/user", primaryParams, onAttempt);
    const primaryRows = extractDeSearchRows(primary.data);
    if (primaryRows.length > 0) {
      userResults.push(...primaryRows);
      continue;
    }

    // Fallback endpoint for account timeline retrieval.
    const fallback = await deSearchGet<unknown>("/twitter/user/posts", {
      username,
    }, onAttempt);
    const fallbackRows = extractDeSearchRows(fallback.data);
    userResults.push(...fallbackRows);
  }

  return uniqueRows(userResults).slice(0, limit);
};

const deSearchMentionsViaTwitterUserFilter = async (
  usernames: string[],
  query: string,
  limit: number,
  preferredSort: DeSearchSortPreference,
  onAttempt?: DeSearchAttemptRecorder
): Promise<Array<Record<string, unknown>>> => {
  const cleanedUsers = Array.from(
    new Set(
      usernames
        .map((value) => value.trim().replace(/^@+/, ""))
        .filter((value) => value.length > 0)
    )
  );

  if (cleanedUsers.length === 0) {
    return [];
  }

  const perUserLimit = Math.max(1, Math.min(100, limit));
  const rows: Array<Record<string, unknown>> = [];

  const sortOrder: DeSearchSortPreference[] = preferredSort === "Latest" ? ["Latest", "Top"] : ["Top", "Latest"];

  for (const username of cleanedUsers.slice(0, 5)) {
    let extracted: Array<Record<string, unknown>> = [];

    for (const sort of sortOrder) {
      const response = await deSearchGet<unknown>("/twitter", {
        query,
        user: username,
        sort,
        count: perUserLimit,
      }, onAttempt);
      extracted = extractDeSearchRows(response.data);
      if (extracted.length > 0) {
        break;
      }
    }

    if (extracted.length > 0) {
      rows.push(...extracted);
    }
  }

  return uniqueRows(rows).slice(0, limit);
};

const deSearchSearchWithMeta = async (
  query: string,
  limit: number,
  preferredSort: DeSearchSortPreference,
  onAttempt?: DeSearchAttemptRecorder
): Promise<{ rows: Array<Record<string, unknown>>; selectedRoute: { method: DeSearchMethod; path: string } | null }> => {
  if (Date.now() < deSearchDisabledUntil) {
    if (DESEARCH_DEBUG) {
      console.log("deSearch temporarily disabled", {
        disabledUntil: new Date(deSearchDisabledUntil).toISOString(),
      });
    }
    return { rows: [], selectedRoute: null };
  }

  const inferMethod = (path: string): DeSearchMethod => {
    return path.startsWith("/desearch/") ? "POST" : "GET";
  };

  const tryRoute = async (
    method: DeSearchMethod,
    path: string
  ): Promise<{ rows: Array<Record<string, unknown>>; status?: number }> => {
    if (method === "POST") {
      const postResult = await deSearchPost<unknown>(path, {
        prompt: query,
        count: Math.max(10, Math.min(200, limit)),
      }, onAttempt);
      return { rows: extractDeSearchRows(postResult.data), status: postResult.status };
    }

    const baseParams = {
      query,
      count: Math.max(1, Math.min(100, limit)),
    };

    const sortOrder: DeSearchSortPreference[] = preferredSort === "Latest" ? ["Latest", "Top"] : ["Top", "Latest"];

    for (const sort of sortOrder) {
      const result = await deSearchGet<unknown>(path, {
        ...baseParams,
        sort,
      }, onAttempt);
      const rows = extractDeSearchRows(result.data);
      if (rows.length > 0) {
        return { rows, status: result.status };
      }
      if (result.status && result.status !== 200) {
        return { rows, status: result.status };
      }
    }

    return { rows: [], status: 200 };
  };

  const isRouteOnCooldown = (method: DeSearchMethod, path: string): boolean => {
    const key = `${method}:${path}`;
    const until = deSearchRouteFailUntil.get(key) || 0;
    return until > Date.now();
  };

  const markRouteFailure = (method: DeSearchMethod, path: string, status?: number): void => {
    if (status !== 404) {
      return;
    }
    const key = `${method}:${path}`;
    deSearchRouteFailUntil.set(key, Date.now() + DESEARCH_ROUTE_FAIL_COOLDOWN_MS);
    if (DESEARCH_DEBUG) {
      console.log("deSearch route cooldown applied", {
        method,
        path,
        cooldownSeconds: Math.round(DESEARCH_ROUTE_FAIL_COOLDOWN_MS / 1000),
      });
    }
  };

  if (resolvedDeSearchRoute) {
    if (isRouteOnCooldown(resolvedDeSearchRoute.method, resolvedDeSearchRoute.path)) {
      resolvedDeSearchRoute = null;
    }
  }

  if (resolvedDeSearchRoute) {
    const resolved = await tryRoute(resolvedDeSearchRoute.method, resolvedDeSearchRoute.path);
    if (resolved.rows.length > 0 || resolved.status === 200) {
      return { rows: resolved.rows, selectedRoute: resolvedDeSearchRoute };
    }

    markRouteFailure(resolvedDeSearchRoute.method, resolvedDeSearchRoute.path, resolved.status);
  }

  const paths = uniqueSearchPaths();
  for (const path of paths) {
    const method = inferMethod(path);

    if (isRouteOnCooldown(method, path)) {
      if (DESEARCH_DEBUG) {
        console.log("deSearch skipping route on cooldown", { method, path });
      }
      continue;
    }

    const result = await tryRoute(method, path);
    if (result.rows.length > 0 || result.status === 200) {
      resolvedDeSearchRoute = { method, path };
      return { rows: result.rows, selectedRoute: resolvedDeSearchRoute };
    }

    markRouteFailure(method, path, result.status);

    if (result.status && result.status !== 404) {
      // Non-404 means endpoint likely exists but query produced no data or temporary failure.
      resolvedDeSearchRoute = { method, path };
      return { rows: result.rows, selectedRoute: resolvedDeSearchRoute };
    }
  }

  deSearchDisabledUntil = Date.now() + DESEARCH_DISABLE_COOLDOWN_MS;
  console.warn("deSearch search endpoint not found. Checked paths:", paths);
  console.warn("deSearch temporarily disabled", {
    retryAfterSeconds: Math.round(DESEARCH_DISABLE_COOLDOWN_MS / 1000),
  });
  return { rows: [], selectedRoute: null };
};

const deSearchSearch = async (
  query: string,
  limit: number,
  preferredSort: DeSearchSortPreference,
  onAttempt?: DeSearchAttemptRecorder
): Promise<Array<Record<string, unknown>>> => {
  const result = await deSearchSearchWithMeta(query, limit, preferredSort, onAttempt);
  return result.rows;
};

export const deSearchMentions = async (
  query: string,
  limit: number = 8,
  preferredSort: DeSearchSortPreference = "Top",
  onAttempt?: DeSearchAttemptRecorder
): Promise<Array<Record<string, unknown>>> => {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const rows = await deSearchSearch(query, limit, preferredSort, onAttempt);
  if (rows.length > 0) {
    return rows;
  }

  // If free-text query includes explicit usernames, try user-specific endpoints.
  const usernameHints = Array.from(new Set((query.match(/@[a-zA-Z0-9_]{1,15}/g) || []).map((token) => token.slice(1))));
  if (usernameHints.length === 0) {
    return [];
  }

  return deSearchMentionsByUsernames(usernameHints, query, limit, onAttempt);
};

const deSearchMentionsWithMeta = async (
  query: string,
  limit: number,
  preferredSort: DeSearchSortPreference,
  onAttempt?: DeSearchAttemptRecorder
): Promise<{ rows: Array<Record<string, unknown>>; selectedRoute: { method: DeSearchMethod; path: string } | null; usedUsernameHint: boolean }> => {
  const search = await deSearchSearchWithMeta(query, limit, preferredSort, onAttempt);
  if (search.rows.length > 0) {
    return { rows: search.rows, selectedRoute: search.selectedRoute, usedUsernameHint: false };
  }

  const usernameHints = Array.from(new Set((query.match(/@[a-zA-Z0-9_]{1,15}/g) || []).map((token) => token.slice(1))));
  if (usernameHints.length === 0) {
    return { rows: [], selectedRoute: search.selectedRoute, usedUsernameHint: false };
  }

  const fallback = await deSearchMentionsByUsernames(usernameHints, query, limit, onAttempt);
  return {
    rows: fallback,
    selectedRoute: search.selectedRoute,
    usedUsernameHint: true,
  };
};

export const deSearchMentionsAdvanced = async (
  query: string,
  limit: number,
  usernames: string[] = [],
  preferredSort: DeSearchSortPreference = "Top",
  onAttempt?: DeSearchAttemptRecorder
): Promise<Array<Record<string, unknown>>> => {
  if (usernames.length > 0) {
    const usernameScoped = await deSearchMentionsViaTwitterUserFilter(usernames, query, limit, preferredSort, onAttempt);
    if (usernameScoped.length > 0) {
      return usernameScoped;
    }
  }

  const primary = await deSearchMentions(query, limit, preferredSort, onAttempt);
  if (primary.length > 0) {
    return primary;
  }

  if (usernames.length === 0) {
    return [];
  }

  return deSearchMentionsByUsernames(usernames, query, limit, onAttempt);
};

export const deSearchMentionsAdvancedWithDiagnostics = async (
  query: string,
  limit: number,
  usernames: string[] = [],
  preferredSort: DeSearchSortPreference = "Top"
): Promise<{ rows: Array<Record<string, unknown>>; diagnostics: DeSearchDiagnostics }> => {
  const attempts: DeSearchRequestAttempt[] = [];
  const recordAttempt: DeSearchAttemptRecorder = (attempt) => {
    attempts.push(attempt);
  };

  if (usernames.length > 0) {
    const usernameScoped = await deSearchMentionsViaTwitterUserFilter(usernames, query, limit, preferredSort, recordAttempt);
    if (usernameScoped.length > 0) {
      return {
        rows: usernameScoped,
        diagnostics: {
          strategy: "twitter_user_filter",
          selectedRoute: { method: "GET", path: "/twitter" },
          attempts,
        },
      };
    }
  }

  const primary = await deSearchMentionsWithMeta(query, limit, preferredSort, recordAttempt);
  if (primary.rows.length > 0) {
    return {
      rows: primary.rows,
      diagnostics: {
        strategy: primary.usedUsernameHint ? "query_username_hint" : "search_route",
        selectedRoute: primary.selectedRoute,
        attempts,
      },
    };
  }

  if (usernames.length === 0) {
    return {
      rows: [],
      diagnostics: {
        strategy: "empty",
        selectedRoute: primary.selectedRoute,
        attempts,
      },
    };
  }

  const usernameFallback = await deSearchMentionsByUsernames(usernames, query, limit, recordAttempt);
  return {
    rows: usernameFallback,
    diagnostics: {
      strategy: "username_endpoint_fallback",
      selectedRoute: primary.selectedRoute,
      attempts,
    },
  };
};

export const rpcAddressLookup = async (
  address: string,
  chain: string
): Promise<BlockchainData | null> => {
  const [balanceHex, txCountHex] = await Promise.all([
    rpcCall(chain, "eth_getBalance", [address, "latest"]),
    rpcCall(chain, "eth_getTransactionCount", [address, "latest"]),
  ]);

  if (!balanceHex && !txCountHex) {
    return null;
  }

  return {
    address,
    chain,
    balance: typeof balanceHex === "string" ? balanceHex : undefined,
    txCount: typeof txCountHex === "string" ? Number.parseInt(txCountHex, 16) : 0,
  };
};

export type TokenRiskLevel = "unknown" | "low" | "medium" | "high" | "critical";

export interface TokenRiskScore {
  riskLevel: TokenRiskLevel;
  score: number; // 0-100
  factors: {
    isNewToken: boolean;
    lowLiquidity: boolean;
    lowVolume: boolean;
    noTrading: boolean;
  };
  liquidity?: number;
  volume24h?: number;
  createdAt?: string;
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const geckoTerminalTokenMarket = async (
  tokenAddress: string,
  chain: string
): Promise<{ liquidity: number; volume24h: number } | null> => {
  const networkMap: Record<string, string> = {
    ethereum: "eth",
    bsc: "bsc",
    base: "base",
    arbitrum: "arbitrum",
  };

  const network = networkMap[chain];
  const normalizedAddress = tokenAddress.trim().toLowerCase();
  if (!network || !/^0x[a-f0-9]{40}$/.test(normalizedAddress)) {
    return null;
  }

  try {
    const baseUrl = process.env.GECKOTERMINAL_API_URL || "https://api.geckoterminal.com/api/v2";
    const response = await axios.get(`${baseUrl}/networks/${network}/tokens/${normalizedAddress}/pools`, {
      timeout: 6000,
    });

    const payload = response.data as Record<string, unknown>;
    const rows = Array.isArray(payload.data) ? payload.data : [];
    const pools = rows
      .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && !Array.isArray(row)))
      .map((row) => (row.attributes && typeof row.attributes === "object" ? (row.attributes as Record<string, unknown>) : null))
      .filter((row): row is Record<string, unknown> => Boolean(row));

    if (pools.length === 0) {
      return null;
    }

    const bestPool = pools
      .slice()
      .sort((a, b) => (toFiniteNumber(b.reserve_in_usd) || 0) - (toFiniteNumber(a.reserve_in_usd) || 0))[0];

    const liquidity = toFiniteNumber(bestPool.reserve_in_usd) || 0;
    const volumeNode =
      bestPool.volume_usd && typeof bestPool.volume_usd === "object"
        ? (bestPool.volume_usd as Record<string, unknown>)
        : undefined;
    const volume24h = toFiniteNumber(volumeNode?.h24) || 0;

    return {
      liquidity,
      volume24h,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status && status !== 404) {
        console.warn(`GeckoTerminal market lookup failed (${status}) for ${chain}:${tokenAddress}`);
      }
    }
    return null;
  }
};

export interface TokenMovementIntel {
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
    riskLevel: TokenRiskLevel | "unknown";
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
}

export type DefiLlamaBridgeProtocol = {
  id: string;
  name: string;
  displayName: string;
  chains: string[];
  url: string | null;
};

export type DuneBridgeContext = {
  queryId: number;
  matchedRows: number;
  latestRecord: Record<string, unknown> | null;
};

export type DuneBridgeRows = {
  queryId: number;
  rows: Array<Record<string, unknown>>;
};

// Dexscreener token enrichment with risk scoring
export const dexscreenerTokenRisk = async (tokenAddress: string, chain: string): Promise<TokenRiskScore | null> => {
  try {
    const baseUrl = process.env.DEXSCREENER_API_URL || "https://api.dexscreener.com/latest";
    const normalizedAddress = tokenAddress.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(normalizedAddress)) {
      return null;
    }

    const chainMap: Record<string, string> = {
      ethereum: "ethereum",
      bsc: "bsc",
      base: "base",
      arbitrum: "arbitrum",
      hyperliquid: "hyperliquid",
    };
    const targetChain = chainMap[chain] || chain;

    const getPairs = async (url: string): Promise<Record<string, unknown>[]> => {
      const response = await axios.get(url, { timeout: 5000 });
      const data = response.data as Record<string, unknown>;
      const pairs = data.pairs;
      if (!Array.isArray(pairs)) {
        return [];
      }
      return pairs.filter(
        (pair): pair is Record<string, unknown> => Boolean(pair && typeof pair === "object" && !Array.isArray(pair))
      );
    };

    let pairs: Record<string, unknown>[] = [];

    try {
      pairs = await getPairs(`${baseUrl}/dex/tokens/${normalizedAddress}`);
    } catch (primaryError) {
      if (axios.isAxiosError(primaryError) && primaryError.response?.status !== 404) {
        throw primaryError;
      }
    }

    if (pairs.length === 0) {
      try {
        pairs = await getPairs(`${baseUrl}/dex/search?q=${normalizedAddress}`);
      } catch (fallbackError) {
        if (axios.isAxiosError(fallbackError) && fallbackError.response?.status !== 404) {
          throw fallbackError;
        }
      }
    }

    if (pairs.length === 0) {
      const geckoMarket = await geckoTerminalTokenMarket(normalizedAddress, chain);
      if (geckoMarket) {
        const factors = {
          isNewToken: false,
          lowLiquidity: geckoMarket.liquidity < 50000,
          lowVolume: geckoMarket.volume24h < 10000,
          noTrading: geckoMarket.volume24h === 0,
        };

        let score = 0;
        let riskLevel: TokenRiskLevel = "low";

        if (factors.noTrading) score += 40;
        else if (factors.lowVolume) score += 25;

        if (factors.lowLiquidity) score += 35;

        if (score >= 80) riskLevel = "critical";
        else if (score >= 60) riskLevel = "high";
        else if (score >= 40) riskLevel = "medium";
        else riskLevel = "low";

        return {
          riskLevel,
          score: Math.min(100, score),
          factors,
          liquidity: geckoMarket.liquidity,
          volume24h: geckoMarket.volume24h,
        };
      }

      return {
        riskLevel: "critical",
        score: 95,
        factors: {
          isNewToken: true,
          lowLiquidity: true,
          lowVolume: true,
          noTrading: true,
        },
      };
    }

    const pairsOnChain = pairs.filter((pair) => {
      const chainId = typeof pair.chainId === "string" ? pair.chainId.toLowerCase() : "";
      return chainId === targetChain;
    });

    const rankedPairs = (pairsOnChain.length > 0 ? pairsOnChain : pairs).slice().sort((a, b) => {
      const aLiquidity = toFiniteNumber((a.liquidity as Record<string, unknown> | undefined)?.usd) || 0;
      const bLiquidity = toFiniteNumber((b.liquidity as Record<string, unknown> | undefined)?.usd) || 0;
      return bLiquidity - aLiquidity;
    });

    const pair = rankedPairs[0];

    const liquidity = (() => {
      const liq = pair.liquidity as Record<string, unknown> | undefined;
      return toFiniteNumber(liq?.usd) || 0;
    })();

    const volume24h = (() => {
      const vol = pair.volume as Record<string, unknown> | undefined;
      return toFiniteNumber(vol?.h24) || 0;
    })();

    const pairCreatedAt = typeof pair.pairCreatedAt === "number" ? new Date(pair.pairCreatedAt) : null;
    const ageHours = pairCreatedAt ? (Date.now() - pairCreatedAt.getTime()) / (1000 * 60 * 60) : 999;

    let finalLiquidity = liquidity;
    let finalVolume24h = volume24h;
    if (finalLiquidity === 0 || finalVolume24h === 0) {
      const geckoMarket = await geckoTerminalTokenMarket(normalizedAddress, chain);
      if (geckoMarket) {
        if (finalLiquidity === 0) {
          finalLiquidity = geckoMarket.liquidity;
        }
        if (finalVolume24h === 0) {
          finalVolume24h = geckoMarket.volume24h;
        }
      }
    }

    const factors = {
      isNewToken: ageHours < 24,
      lowLiquidity: finalLiquidity < 50000,
      lowVolume: finalVolume24h < 10000,
      noTrading: finalVolume24h === 0,
    };

    let score = 0;
    let riskLevel: TokenRiskLevel = "low";

    if (factors.noTrading) score += 40;
    else if (factors.lowVolume) score += 25;

    if (factors.lowLiquidity) score += 35;
    if (factors.isNewToken) score += 20;

    if (score >= 80) riskLevel = "critical";
    else if (score >= 60) riskLevel = "high";
    else if (score >= 40) riskLevel = "medium";
    else riskLevel = "low";

    return {
      riskLevel,
      score: Math.min(100, score),
      factors,
      liquidity: finalLiquidity,
      volume24h: finalVolume24h,
      createdAt: pairCreatedAt?.toISOString(),
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) console.warn(`Dexscreener rate limited`);
      else if (status === 404) console.warn(`Token ${tokenAddress} not found on Dexscreener`);
    }
    return null;
  }
};

// CoinGecko price history with time-based lookup
export const coingeckoPriceAtTime = async (tokenId: string, unixTimestamp: number): Promise<number | null> => {
  try {
    const baseUrl = process.env.COINGECKO_API_URL || "https://api.coingecko.com/api/v3";
    const date = new Date(unixTimestamp * 1000);
    const dateStr = `${date.getUTCDate()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${date.getUTCFullYear()}`;

    const response = await axios.get(`${baseUrl}/coins/${tokenId}/history`, {
      params: {
        date: dateStr,
        localization: "false",
      },
      timeout: 5000,
    });

    const data = response.data as Record<string, unknown>;
    if (data.market_data && typeof data.market_data === "object") {
      const marketData = data.market_data as Record<string, unknown>;
      if (marketData.current_price && typeof marketData.current_price === "object") {
        const price = (marketData.current_price as Record<string, unknown>).usd;
        if (typeof price === "number") return price;
      }
    }
    return null;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) console.warn("CoinGecko rate limited");
      else if (status === 404) console.warn(`Token ${tokenId} not found on CoinGecko`);
    }
    return null;
  }
};

// CoinGecko contract lookup by chain + token contract
export const coingeckoTokenPriceByContract = async (
  chain: string,
  contractAddress: string
): Promise<number | null> => {
  const platformMap: Record<string, string> = {
    ethereum: "ethereum",
    bsc: "binance-smart-chain",
    base: "base",
    arbitrum: "arbitrum-one",
    hyperliquid: "hyperliquid",
  };

  const platform = platformMap[chain];
  if (!platform || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    return null;
  }

  try {
    const baseUrl = process.env.COINGECKO_API_URL || "https://api.coingecko.com/api/v3";
    const response = await axios.get(`${baseUrl}/simple/token_price/${platform}`, {
      params: {
        contract_addresses: contractAddress,
        vs_currencies: "usd",
      },
      timeout: 5000,
    });

    const data = response.data as Record<string, unknown>;
    const key = contractAddress.toLowerCase();
    const tokenRow = data[key];
    if (!tokenRow || typeof tokenRow !== "object" || Array.isArray(tokenRow)) {
      return null;
    }

    const usd = (tokenRow as Record<string, unknown>).usd;
    return typeof usd === "number" && Number.isFinite(usd) ? usd : null;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) console.warn("CoinGecko contract price lookup rate limited");
    }
    return null;
  }
};

const normalizeDefiLlamaProtocol = (row: Record<string, unknown>): DefiLlamaBridgeProtocol | null => {
  const id = typeof row.id === "string" ? row.id : "";
  const name = typeof row.name === "string" ? row.name : "";
  const displayName = typeof row.displayName === "string" ? row.displayName : name;
  const url = typeof row.url === "string" ? row.url : null;
  const chainCandidates = [row.chains, row.chainTvls, row.chain];

  const chains = new Set<string>();
  for (const candidate of chainCandidates) {
    if (Array.isArray(candidate)) {
      for (const value of candidate) {
        if (typeof value === "string" && value.trim().length > 0) {
          chains.add(value.trim().toLowerCase());
        }
      }
    } else if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      for (const key of Object.keys(candidate as Record<string, unknown>)) {
        if (key.trim().length > 0) {
          chains.add(key.trim().toLowerCase());
        }
      }
    } else if (typeof candidate === "string" && candidate.trim().length > 0) {
      chains.add(candidate.trim().toLowerCase());
    }
  }

  if (!name && !displayName) {
    return null;
  }

  return {
    id: id || displayName || name,
    name: name || displayName,
    displayName: displayName || name,
    chains: Array.from(chains),
    url,
  };
};

export const defillamaBridgeProtocols = async (): Promise<DefiLlamaBridgeProtocol[]> => {
  try {
    const response = await axios.get(`${DEFILLAMA_BASE_URL}/bridges`, {
      timeout: 8000,
    });

    const data = response.data as Record<string, unknown>;
    const listCandidates = [data.protocols, data.bridges, data.data, response.data];
    for (const candidate of listCandidates) {
      if (!Array.isArray(candidate)) {
        continue;
      }

      const normalized = candidate
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
        .map(normalizeDefiLlamaProtocol)
        .filter((item): item is DefiLlamaBridgeProtocol => Boolean(item));

      if (normalized.length > 0) {
        return normalized;
      }
    }

    return [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) {
        console.warn("DefiLlama bridge endpoint rate limited");
      }
    }
    return [];
  }
};

export const defillamaFindBridgeProtocol = async (
  protocolHint: string,
  chain?: string
): Promise<DefiLlamaBridgeProtocol | null> => {
  const cleanedHint = protocolHint.trim().toLowerCase();
  if (!cleanedHint) {
    return null;
  }

  const protocols = await defillamaBridgeProtocols();
  if (protocols.length === 0) {
    return null;
  }

  const chainNeedle = (chain || "").trim().toLowerCase();

  const directMatch = protocols.find((item) => {
    const name = item.name.toLowerCase();
    const displayName = item.displayName.toLowerCase();
    const textMatch =
      cleanedHint.includes(name) ||
      name.includes(cleanedHint) ||
      cleanedHint.includes(displayName) ||
      displayName.includes(cleanedHint);

    if (!textMatch) {
      return false;
    }

    if (!chainNeedle) {
      return true;
    }

    return item.chains.length === 0 || item.chains.includes(chainNeedle);
  });

  return directMatch || null;
};

export const duneBridgeContextForAddress = async (
  address: string,
  chain: string
): Promise<DuneBridgeContext | null> => {
  const rowsResult = await duneBridgeRowsForAddress(address, chain);
  if (!rowsResult) {
    return null;
  }

  return {
    queryId: rowsResult.queryId,
    matchedRows: rowsResult.rows.length,
    latestRecord: rowsResult.rows[0] || null,
  };
};

export const duneBridgeRowsForAddress = async (
  address: string,
  chain: string
): Promise<DuneBridgeRows | null> => {
  const apiKey = process.env.DUNE_API_KEY;
  const queryIdRaw = process.env.DUNE_BRIDGE_QUERY_ID;
  if (!apiKey || !queryIdRaw) {
    return null;
  }

  const queryId = Number.parseInt(queryIdRaw, 10);
  if (!Number.isFinite(queryId)) {
    return null;
  }

  try {
    const response = await axios.get(`${DUNE_BASE_URL}/query/${queryId}/results`, {
      params: {
        filters: JSON.stringify({
          address: address.toLowerCase(),
          chain: chain.toLowerCase(),
        }),
      },
      headers: {
        "X-Dune-API-Key": apiKey,
      },
      timeout: 12000,
    });

    const data = response.data as Record<string, unknown>;
    const result = data.result;
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return null;
    }

    const rowsRaw = (result as Record<string, unknown>).rows;
    if (!Array.isArray(rowsRaw)) {
      return null;
    }

    const rows = rowsRaw.filter(
      (item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))
    );

    return { queryId, rows };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) {
        console.warn("Dune query rate limited");
      } else if (status === 401 || status === 403) {
        console.warn("Dune auth failed; verify DUNE_API_KEY");
      }
    }
    return null;
  }
};

  export type DuneFundFlowRows = {
    queryId: string;
    rows: Array<Record<string, unknown>>;
  };

  export const duneFundFlowForAddress = async (
    address: string,
    _chain: string,
    startTimestamp: number,
    txHash?: string
  ): Promise<DuneFundFlowRows | null> => {
    const apiKey = process.env.DUNE_API_KEY;
    const queryIdRaw = process.env.DUNE_FUND_FLOW_QUERY_ID;
    if (!apiKey || !queryIdRaw) {
      return null;
    }

    const queryId = Number.parseInt(queryIdRaw, 10);
    if (!Number.isFinite(queryId)) {
      return null;
    }

    try {
      const queryParameters: Record<string, string | number> = {
        wallet_address: address.toLowerCase(),
        start_timestamp: startTimestamp,
        tx_hash: txHash?.trim()?.toLowerCase() || "",
      };

      const headers = {
        "X-Dune-API-Key": apiKey,
        "Content-Type": "application/json",
      };

      const executeResponse = await axios.post(
        `${DUNE_BASE_URL}/query/${queryId}/execute`,
        {
          query_parameters: queryParameters,
        },
        {
          headers,
          timeout: 20000,
        }
      );

      const executeData = executeResponse.data as Record<string, unknown>;
      const executionIdRaw = executeData.execution_id;
      const executionId = typeof executionIdRaw === "string" ? executionIdRaw : "";

      if (!executionId) {
        return null;
      }

      let completed = false;
      for (let attempt = 0; attempt < 15; attempt += 1) {
        const statusResponse = await axios.get(`${DUNE_BASE_URL}/execution/${executionId}/status`, {
          headers,
          timeout: 10000,
        });

        const statusData = statusResponse.data as Record<string, unknown>;
        const state = String(statusData.state || "").toUpperCase();

        if (state.includes("COMPLETED")) {
          completed = true;
          break;
        }

        if (state.includes("FAILED") || state.includes("CANCELLED") || state.includes("EXPIRED")) {
          return null;
        }

        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      if (!completed) {
        return null;
      }

      const response = await axios.get(`${DUNE_BASE_URL}/execution/${executionId}/results`, {
        headers,
        timeout: 20000,
      });

      const data = response.data as Record<string, unknown>;
      const result = data.result;
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        return null;
      }

      const rowsRaw = (result as Record<string, unknown>).rows;
      if (!Array.isArray(rowsRaw)) {
        return null;
      }

      const rows = rowsRaw.filter(
        (item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))
      );

      return { queryId: String(queryId), rows };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const duneError = error.response?.data;
        if (status === 429) {
          console.warn("Dune fund-flow query rate limited");
        } else if (status === 401 || status === 403) {
          console.warn("Dune auth failed for fund-flow; verify DUNE_API_KEY");
        } else if (status === 400) {
          console.warn("Dune fund-flow query rejected (400). Verify query parameter names/types in Dune.", duneError);
        } else {
          console.warn(`Dune fund-flow query failed: ${error.message}`, duneError);
        }
      }
      return null;
    }
  };

// CoinGecko price/history (legacy)
export const coingeckoPriceHistory = async (tokenId: string, days: number = 30) => {
  try {
    const baseUrl = process.env.COINGECKO_API_URL || "https://api.coingecko.com/api/v3";
    const response = await axios.get(`${baseUrl}/coins/${tokenId}/market_chart`, {
      params: {
        vs_currency: "usd",
        days,
      },
      timeout: 5000,
    });

    return response.data;
  } catch (error) {
    console.error("CoinGecko lookup failed:", error);
    return null;
  }
};

// Unified profile builder with fallback logic
export const buildWalletProfile = async (address: string, chain: string) => {
  const [arkhamData, rpcData] = await Promise.all([
    arkhamLookup(address, chain),
    rpcAddressLookup(address, chain),
  ]);

  const computeWalletRisk = (): WalletRiskComputation => {
    const factors: string[] = [];
    let score = 45;

    const txCount = rpcData?.txCount ?? 0;
    const lowerLabels = (arkhamData?.labels || []).map((label) => label.toLowerCase());
    const raw =
      arkhamData?.raw && typeof arkhamData.raw === "object" && !Array.isArray(arkhamData.raw)
        ? (arkhamData.raw as Record<string, unknown>)
        : null;

    if (lowerLabels.length === 0) {
      score += 10;
      factors.push("no-known-labels");
    }

    const suspiciousSignals = ["sanction", "hack", "drainer", "phish", "scam", "mixer", "tornado", "fraud", "exploit"];
    if (lowerLabels.some((label) => suspiciousSignals.some((signal) => label.includes(signal)))) {
      score += 35;
      factors.push("suspicious-label-match");
    }

    const cexSignals = ["cex", "exchange", "custody", "hot-wallet", "market-maker"];
    if (lowerLabels.some((label) => cexSignals.some((signal) => label.includes(signal)))) {
      score -= 22;
      factors.push("institutional-label-match");
    }

    if (txCount <= 20) {
      score += 12;
      factors.push("low-activity");
    } else if (txCount > 100_000) {
      score -= 18;
      factors.push("very-high-activity");
    } else if (txCount > 10_000) {
      score -= 10;
      factors.push("high-activity");
    }

    if (raw && typeof raw.isUserAddress === "boolean" && raw.isUserAddress) {
      score -= 5;
      factors.push("user-wallet-flag");
    }

    if (raw && typeof raw.contract === "boolean" && raw.contract) {
      score += 8;
      factors.push("contract-address");
    }

    const bounded = Math.max(0, Math.min(100, Math.round(score)));
    return {
      score: bounded,
      factors,
    };
  };

  const derivedRisk = computeWalletRisk();
  const finalRisk = arkhamData?.riskScore ?? derivedRisk.score;

  return {
    address,
    chain,
    arkhamLabels: arkhamData?.labels || [],
    arkhamRisk: finalRisk,
    riskSource: arkhamData?.riskScore !== null && arkhamData?.riskScore !== undefined ? "arkham" : "aubox_heuristic",
    riskFactors: derivedRisk.factors,
    txCount: rpcData?.txCount || 0,
    balanceHex: rpcData?.balance || null,
    firstSeen: null,
    lastSeen: null,
    sources: {
      arkham: !!arkhamData,
      rpc: !!rpcData,
    },
  };
};

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TOKEN_LOG_WINDOW_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_LOG_WINDOW_SIZE = 2000;
const ALCHEMY_FREE_TIER_LOG_WINDOW_SIZE = 10;

const tokenLogWindowCache = new Map<string, { rows: Record<string, unknown>[]; timestamp: number }>();

const topicToAddress = (topic: string): string => {
  if (typeof topic !== "string" || !topic.startsWith("0x") || topic.length < 42) {
    return "";
  }
  return `0x${topic.slice(-40)}`.toLowerCase();
};

const toHexBlock = (value: number): string => {
  return `0x${Math.max(0, Math.floor(value)).toString(16)}`;
};

const getTokenLogWindowCacheKey = (
  chain: string,
  tokenAddress: string,
  fromBlock: number,
  toBlock: number
): string => {
  return `${chain}:${tokenAddress}:${fromBlock}:${toBlock}`;
};

const getLogWindowSize = (chain: string): number => {
  const rpcUrl = getRpcUrl(chain) || "";
  if (/alchemy\.com/i.test(rpcUrl)) {
    return ALCHEMY_FREE_TIER_LOG_WINDOW_SIZE;
  }
  return DEFAULT_LOG_WINDOW_SIZE;
};

const fetchTransferLogsBatched = async (
  chain: string,
  tokenAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<Record<string, unknown>[]> => {
  const windowSize = Math.max(1, getLogWindowSize(chain));
  const mergedRows: Record<string, unknown>[] = [];
  let cacheHits = 0;
  let rpcCalls = 0;

  for (let start = fromBlock; start <= toBlock; start += windowSize) {
    const end = Math.min(toBlock, start + windowSize - 1);
    const cacheKey = getTokenLogWindowCacheKey(chain, tokenAddress, start, end);
    const cached = tokenLogWindowCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp <= TOKEN_LOG_WINDOW_CACHE_TTL_MS) {
      cacheHits += 1;
      mergedRows.push(...cached.rows);
      continue;
    }

    rpcCalls += 1;
    const logs = await rpcCall(chain, "eth_getLogs", [
      {
        address: tokenAddress,
        fromBlock: toHexBlock(start),
        toBlock: toHexBlock(end),
        topics: [TRANSFER_TOPIC],
      },
    ]);

    const rows = Array.isArray(logs)
      ? logs.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      : [];

    tokenLogWindowCache.set(cacheKey, {
      rows,
      timestamp: Date.now(),
    });
    mergedRows.push(...rows);
  }

  console.info(
    `[token-movement] batched logs ${chain} ${tokenAddress.slice(0, 10)}... windowsize=${windowSize} rpcCalls=${rpcCalls} cacheHits=${cacheHits} rows=${mergedRows.length}`
  );

  return mergedRows;
};

const toBigIntSafe = (value: unknown): bigint => {
  if (typeof value === "string" && value.startsWith("0x")) {
    try {
      return BigInt(value);
    } catch {
      return BigInt(0);
    }
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return BigInt(Math.floor(value));
  }
  return BigInt(0);
};

export const analyzeTokenMovement = async (
  tokenAddress: string,
  chain: string,
  walletAddress?: string,
  lookbackBlocks: number = 4000
): Promise<TokenMovementIntel | null> => {
  const normalizedToken = tokenAddress.trim().toLowerCase();
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedToken)) {
    return null;
  }

  const normalizedWallet = walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress)
    ? walletAddress.toLowerCase()
    : null;

  const latestBlockHex = await rpcCall(chain, "eth_blockNumber", []);
  if (typeof latestBlockHex !== "string") {
    return null;
  }

  const latestBlock = Number.parseInt(latestBlockHex, 16);
  if (!Number.isFinite(latestBlock)) {
    return null;
  }

  const fromBlock = Math.max(0, latestBlock - Math.max(500, Math.min(20000, lookbackBlocks)));

  const rows = await fetchTransferLogsBatched(chain, normalizedToken, fromBlock, latestBlock);

  const holders = new Set<string>();
  const senders = new Set<string>();
  const receivers = new Set<string>();
  const counterparties = new Map<string, number>();
  let totalTransferredRaw = BigInt(0);

  let inboundCount = 0;
  let outboundCount = 0;
  let inboundRaw = BigInt(0);
  let outboundRaw = BigInt(0);

  for (const row of rows) {
    const topics = Array.isArray(row.topics) ? row.topics : [];
    const from = topics.length > 1 && typeof topics[1] === "string" ? topicToAddress(topics[1]) : "";
    const to = topics.length > 2 && typeof topics[2] === "string" ? topicToAddress(topics[2]) : "";
    const valueRaw = toBigIntSafe(row.data);

    if (from && from !== "0x0000000000000000000000000000000000000000") {
      senders.add(from);
      holders.add(from);
      counterparties.set(from, (counterparties.get(from) || 0) + 1);
    }
    if (to && to !== "0x0000000000000000000000000000000000000000") {
      receivers.add(to);
      holders.add(to);
      counterparties.set(to, (counterparties.get(to) || 0) + 1);
    }

    totalTransferredRaw += valueRaw;

    if (normalizedWallet) {
      if (to === normalizedWallet) {
        inboundCount += 1;
        inboundRaw += valueRaw;
      }
      if (from === normalizedWallet) {
        outboundCount += 1;
        outboundRaw += valueRaw;
      }
    }
  }

  const tokenRisk = await dexscreenerTokenRisk(normalizedToken, chain);
  const topCounterparties = Array.from(counterparties.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([address, interactions]) => ({ address, interactions }));

  const intel: TokenMovementIntel = {
    chain,
    tokenAddress: normalizedToken,
    sampledFromBlock: toHexBlock(fromBlock),
    sampledToBlock: toHexBlock(latestBlock),
    transferEventCount: rows.length,
    estimatedHolderCount: holders.size,
    uniqueSenders: senders.size,
    uniqueReceivers: receivers.size,
    totalTransferredRaw: totalTransferredRaw.toString(),
    market: {
      liquidityUsd: tokenRisk?.liquidity ?? null,
      volume24hUsd: tokenRisk?.volume24h ?? null,
      riskLevel: tokenRisk?.riskLevel || "unknown",
      riskScore: typeof tokenRisk?.score === "number" ? tokenRisk.score : null,
    },
    topCounterparties,
  };

  if (normalizedWallet) {
    const netRaw = inboundRaw - outboundRaw;
    intel.walletRelation = {
      wallet: normalizedWallet,
      inboundTransfers: inboundCount,
      outboundTransfers: outboundCount,
      netDirection: netRaw > BigInt(0) ? "inflow" : netRaw < BigInt(0) ? "outflow" : "neutral",
      inboundRaw: inboundRaw.toString(),
      outboundRaw: outboundRaw.toString(),
      netRaw: netRaw.toString(),
    };
  }

  return intel;
};
