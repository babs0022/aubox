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

// Dexscreener token enrichment with risk scoring
export const dexscreenerTokenRisk = async (tokenAddress: string, chain: string): Promise<TokenRiskScore | null> => {
  try {
    const baseUrl = process.env.DEXSCREENER_API_URL || "https://api.dexscreener.com/latest";
    const chainMap: Record<string, string> = {
      ethereum: "eth",
      bsc: "bsc",
      base: "base",
      arbitrum: "arbitrum",
      hyperliquid: "hyperliquid",
    };
    const dexChain = chainMap[chain] || chain;

    const response = await axios.get(`${baseUrl}/dex/tokens/${dexChain}:${tokenAddress}`, {
      timeout: 5000,
    });

    const data = response.data as Record<string, unknown>;
    if (!data.pairs || !Array.isArray(data.pairs) || data.pairs.length === 0) {
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

    const pair = (data.pairs as unknown[])[0] as Record<string, unknown>;
    
    const liquidity = (() => {
      const liq = pair.liquidity as Record<string, unknown> | undefined;
      return typeof liq?.usd === "number" ? liq.usd : 0;
    })();
    
    const volume24h = (() => {
      const vol = pair.volume as Record<string, unknown> | undefined;
      return typeof vol?.h24 === "number" ? vol.h24 : 0;
    })();
    
    const pairCreatedAt = typeof pair.pairCreatedAt === "number" ? new Date(pair.pairCreatedAt) : null;
    const ageHours = pairCreatedAt ? (Date.now() - pairCreatedAt.getTime()) / (1000 * 60 * 60) : 999;

    const factors = {
      isNewToken: ageHours < 24,
      lowLiquidity: liquidity < 50000,
      lowVolume: volume24h < 10000,
      noTrading: volume24h === 0,
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
      liquidity,
      volume24h,
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
