import { DefaultAzureCredential } from "@azure/identity";
import { ServiceBusClient } from "@azure/service-bus";
import { TableClient } from "@azure/data-tables";
import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const credential = new DefaultAzureCredential();

const serviceBusClient = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING
  ? new ServiceBusClient(process.env.AZURE_SERVICE_BUS_CONNECTION_STRING)
  : new ServiceBusClient(`${process.env.AZURE_SERVICE_BUS_NAMESPACE}.servicebus.windows.net`, credential);

const USERS_TABLE_NAME = "auboxusers";
const CASES_TABLE_NAME = "auboxcases";
const CASE_EVENTS_TABLE_NAME = "auboxcaseevents";
const CASE_ARTIFACTS_TABLE_NAME = "auboxcaseartifacts";
const JOBS_TABLE_NAME = "auboxjobs";

let usersTableClient: TableClient | null = null;
let casesTableClient: TableClient | null = null;
let caseEventsTableClient: TableClient | null = null;
let caseArtifactsTableClient: TableClient | null = null;
let jobsTableClient: TableClient | null = null;

const getUsersTableClient = (): TableClient => {
  if (usersTableClient) {
    return usersTableClient;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured");
  }

  usersTableClient = TableClient.fromConnectionString(connectionString, USERS_TABLE_NAME);
  return usersTableClient;
};

const getCasesTableClient = (): TableClient => {
  if (casesTableClient) {
    return casesTableClient;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured");
  }

  casesTableClient = TableClient.fromConnectionString(connectionString, CASES_TABLE_NAME);
  return casesTableClient;
};

const getCaseEventsTableClient = (): TableClient => {
  if (caseEventsTableClient) {
    return caseEventsTableClient;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured");
  }

  caseEventsTableClient = TableClient.fromConnectionString(connectionString, CASE_EVENTS_TABLE_NAME);
  return caseEventsTableClient;
};

const getCaseArtifactsTableClient = (): TableClient => {
  if (caseArtifactsTableClient) {
    return caseArtifactsTableClient;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured");
  }

  caseArtifactsTableClient = TableClient.fromConnectionString(connectionString, CASE_ARTIFACTS_TABLE_NAME);
  return caseArtifactsTableClient;
};

const getJobsTableClient = (): TableClient => {
  if (jobsTableClient) {
    return jobsTableClient;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured");
  }

  jobsTableClient = TableClient.fromConnectionString(connectionString, JOBS_TABLE_NAME);
  return jobsTableClient;
};

let usersTableInitPromise: Promise<void> | null = null;
let casesTableInitPromise: Promise<void> | null = null;
let caseEventsTableInitPromise: Promise<void> | null = null;
let caseArtifactsTableInitPromise: Promise<void> | null = null;
let jobsTableInitPromise: Promise<void> | null = null;

const ensureUsersTable = async (): Promise<void> => {
  if (!usersTableInitPromise) {
    usersTableInitPromise = (async () => {
      const client = getUsersTableClient();
      await client.createTable().catch(() => {
        // Ignore if table already exists.
      });
    })();
  }

  await usersTableInitPromise;
};

const ensureCaseTables = async (): Promise<void> => {
  if (!casesTableInitPromise) {
    casesTableInitPromise = (async () => {
      const client = getCasesTableClient();
      await client.createTable().catch(() => {
        // Ignore if table already exists.
      });
    })();
  }

  if (!caseEventsTableInitPromise) {
    caseEventsTableInitPromise = (async () => {
      const client = getCaseEventsTableClient();
      await client.createTable().catch(() => {
        // Ignore if table already exists.
      });
    })();
  }

  if (!caseArtifactsTableInitPromise) {
    caseArtifactsTableInitPromise = (async () => {
      const client = getCaseArtifactsTableClient();
      await client.createTable().catch(() => {
        // Ignore if table already exists.
      });
    })();
  }

  await Promise.all([casesTableInitPromise, caseEventsTableInitPromise, caseArtifactsTableInitPromise]);
};

const ensureJobsTable = async (): Promise<void> => {
  if (!jobsTableInitPromise) {
    jobsTableInitPromise = (async () => {
      const client = getJobsTableClient();
      await client.createTable().catch(() => {
        // Ignore if table already exists.
      });
    })();
  }

  await jobsTableInitPromise;
};

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  name?: string;
  profileIcon?: string;
  oid?: string;
}

class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type StoredUser = {
  id: string;
  email: string;
  username: string;
  name?: string;
  profileIcon?: string;
  passwordHash: string;
};

export interface CaseRecord {
  id: string;
  userId: string;
  title: string;
  targetAddress: string;
  chain: string;
  status: "active" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface CaseEventRecord {
  id: string;
  caseId: string;
  userId: string;
  feature: "profile" | "trace" | "cluster" | "timeline" | "report" | "social";
  title: string;
  narrative: string;
  metrics?: Record<string, number | string>;
  nodes?: Array<{ id: string; label: string; type: string }>;
  edges?: Array<{ source: string; target: string; label?: string }>;
  createdAt: string;
}

export interface CaseArtifactRecord {
  id: string;
  caseId: string;
  userId: string;
  tag: string;
  value: string;
  kind: "address" | "entity" | "hashtag" | "ticker" | "username" | "query" | "note";
  sourceFeature: "trace" | "cluster" | "social" | "profile" | "timeline" | "report" | "manual";
  aliases?: string[];
  metadata?: Record<string, string | number>;
  createdAt: string;
  updatedAt: string;
}

export interface AsyncJobRecord {
  id: string;
  userId: string;
  type: "profile" | "trace" | "cluster";
  status: "queued" | "running" | "completed" | "failed";
  payload: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeUsername = (username: string) => username.trim().toLowerCase();

// Simple in-memory cache with 30s TTL for user lookups
const userLookupCache = new Map<string, { user: StoredUser | null; expires: number }>();

const getCachedUser = (cacheKey: string): StoredUser | null | undefined => {
  const cached = userLookupCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.user;
  }
  if (cached) {
    userLookupCache.delete(cacheKey);
  }
  return undefined;
};

const setCachedUser = (cacheKey: string, user: StoredUser | null): void => {
  userLookupCache.set(cacheKey, {
    user,
    expires: Date.now() + 30000, // 30 second TTL
  });
};

const invalidateUserCache = (email: string, username: string): void => {
  userLookupCache.delete(`email:${normalizeEmail(email)}`);
  userLookupCache.delete(`username:${normalizeUsername(username)}`);
};

// Reset token storage with 15 minute TTL
const resetTokens = new Map<string, { userId: string; email: string; expires: number }>();

const generateResetToken = (userId: string, email: string): string => {
  const token = randomUUID();
  resetTokens.set(token, {
    userId,
    email,
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  });
  // Cleanup old tokens periodically
  if (resetTokens.size > 1000) {
    const now = Date.now();
    for (const [key, value] of resetTokens.entries()) {
      if (value.expires <= now) {
        resetTokens.delete(key);
      }
    }
  }
  return token;
};

const verifyResetToken = (token: string): { userId: string; email: string } | null => {
  const data = resetTokens.get(token);
  if (!data || data.expires <= Date.now()) {
    resetTokens.delete(token);
    return null;
  }
  return { userId: data.userId, email: data.email };
};

const consumeResetToken = (token: string): void => {
  resetTokens.delete(token);
};

const hashPassword = (password: string): string => {
  const salt = randomUUID();
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, stored: string): boolean => {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;

  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (actual.length !== expected.length) return false;

  return timingSafeEqual(actual, expected);
};

const mapEntityToUser = (entity: Record<string, unknown>): StoredUser => ({
  id: String(entity.rowKey || ""),
  email: String(entity.email || ""),
  username: String(entity.username || ""),
  name: entity.name ? String(entity.name) : undefined,
  profileIcon: entity.profileIcon ? String(entity.profileIcon) : undefined,
  passwordHash: String(entity.passwordHash || ""),
});

const findUserByEmail = async (email: string): Promise<StoredUser | null> => {
  const normalized = normalizeEmail(email);
  const cacheKey = `email:${normalized}`;

  const cached = getCachedUser(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  await ensureUsersTable();
  const client = getUsersTableClient();
  const escapedEmail = normalized.replace(/'/g, "''");

  const entities = client.listEntities({
    queryOptions: {
      filter: `PartitionKey eq 'users' and email eq '${escapedEmail}'`,
    },
  });

  for await (const entity of entities) {
    const user = mapEntityToUser(entity as Record<string, unknown>);
    setCachedUser(cacheKey, user);
    return user;
  }

  setCachedUser(cacheKey, null);
  return null;
};

const findUserByUsername = async (username: string): Promise<StoredUser | null> => {
  const normalized = normalizeUsername(username);
  const cacheKey = `username:${normalized}`;

  const cached = getCachedUser(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  await ensureUsersTable();
  const client = getUsersTableClient();
  const escapedUsername = normalized.replace(/'/g, "''");

  const entities = client.listEntities({
    queryOptions: {
      filter: `PartitionKey eq 'users' and username eq '${escapedUsername}'`,
    },
  });

  for await (const entity of entities) {
    const user = mapEntityToUser(entity as Record<string, unknown>);
    setCachedUser(cacheKey, user);
    return user;
  }

  setCachedUser(cacheKey, null);
  return null;
};

export const getUserById = async (id: string): Promise<AuthUser | null> => {
  await ensureUsersTable();
  const client = getUsersTableClient();

  try {
    const entity = await client.getEntity<Record<string, unknown>>("users", id);
    const user = mapEntityToUser(entity);
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      profileIcon: user.profileIcon,
    };
  } catch {
    return null;
  }
};

export const requestPasswordReset = async (email: string): Promise<string> => {
  const user = await findUserByEmail(email);
  if (!user) {
    // Don't reveal if email exists for security
    throw new AuthError("If email exists, reset link will be sent", 200);
  }

  const resetToken = generateResetToken(user.id, user.email);
  return resetToken;
};

export const resetPassword = async (
  token: string,
  newPassword: string
): Promise<AuthUser> => {
  const tokenData = verifyResetToken(token);
  if (!tokenData) {
    throw new AuthError("Invalid or expired reset token", 401);
  }

  const user = await getUserById(tokenData.userId);
  if (!user) {
    throw new AuthError("User not found", 404);
  }

  await ensureUsersTable();
  const client = getUsersTableClient();

  try {
    const existing = await client.getEntity<Record<string, unknown>>("users", tokenData.userId);

    await client.updateEntity(
      {
        partitionKey: "users",
        rowKey: tokenData.userId,
        email: existing.email,
        username: existing.username,
        passwordHash: hashPassword(newPassword),
        name: existing.name || "",
        profileIcon: existing.profileIcon || "",
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      },
      "Replace"
    );

    // Consume the token after successful reset
    consumeResetToken(token);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError("Failed to reset password", 500);
  }
};

export const signUpUser = async (
  email: string,
  password: string,
  username: string,
  name?: string
): Promise<AuthUser> => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);

  if (await findUserByUsername(normalizedUsername)) {
    throw new AuthError("Username is already taken", 409);
  }

  if (await findUserByEmail(normalizedEmail)) {
    throw new AuthError("Email is already registered", 409);
  }

  await ensureUsersTable();
  const client = getUsersTableClient();
  const id = randomUUID();

  await client.createEntity({
    partitionKey: "users",
    rowKey: id,
    email: normalizedEmail,
    username: normalizedUsername,
    name: name?.trim() || "",
    profileIcon: "",
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Invalidate cache to ensure new user is available for lookup
  invalidateUserCache(normalizedEmail, normalizedUsername);

  return {
    id,
    email: normalizedEmail,
    username: normalizedUsername,
    name: name?.trim() || undefined,
  };
};

export const signInUser = async (email: string, password: string): Promise<AuthUser> => {
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AuthError("Invalid email or password", 401);
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    profileIcon: user.profileIcon,
  };
};

export const updateUserProfile = async (
  userId: string,
  payload: { name?: string; profileIcon?: string; username?: string }
): Promise<AuthUser | null> => {
  await ensureUsersTable();
  const client = getUsersTableClient();

  try {
    const existing = await client.getEntity<Record<string, unknown>>("users", userId);

    const nextUsername = payload.username
      ? normalizeUsername(payload.username)
      : String(existing.username || "").trim().toLowerCase();

    if (nextUsername !== String(existing.username || "").trim().toLowerCase()) {
      const existingUsernameUser = await findUserByUsername(nextUsername);
      if (existingUsernameUser && existingUsernameUser.id !== userId) {
        throw new AuthError("Username is already taken", 409);
      }
    }

    await client.updateEntity(
      {
        partitionKey: "users",
        rowKey: userId,
        email: existing.email,
        username: nextUsername,
        passwordHash: existing.passwordHash,
        name: payload.name || "",
        profileIcon: payload.profileIcon || "",
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      },
      "Replace"
    );

    // Invalidate affected cache entries
    invalidateUserCache(String(existing.email || ""), nextUsername);

    return {
      id: userId,
      email: String(existing.email || ""),
      username: nextUsername,
      name: payload.name || "",
      profileIcon: payload.profileIcon || "",
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    return null;
  }
};

export const isAuthError = (error: unknown): error is AuthError => {
  return error instanceof AuthError;
};

export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  const user = await findUserByUsername(username);
  return user === null;
};

export const createCase = async (
  userId: string,
  payload: { title: string; targetAddress: string; chain: string }
): Promise<CaseRecord> => {
  await ensureCaseTables();
  const client = getCasesTableClient();
  const id = randomUUID();
  const now = new Date().toISOString();

  await client.createEntity({
    partitionKey: userId,
    rowKey: id,
    title: payload.title.trim(),
    targetAddress: payload.targetAddress.trim(),
    chain: payload.chain,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    userId,
    title: payload.title.trim(),
    targetAddress: payload.targetAddress.trim(),
    chain: payload.chain,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
};

export const listCases = async (userId: string): Promise<CaseRecord[]> => {
  await ensureCaseTables();
  const client = getCasesTableClient();
  const escapedUserId = userId.replace(/'/g, "''");

  const entities = client.listEntities({
    queryOptions: {
      filter: `PartitionKey eq '${escapedUserId}'`,
    },
  });

  const cases: CaseRecord[] = [];
  for await (const entity of entities) {
    cases.push({
      id: String(entity.rowKey || ""),
      userId,
      title: String(entity.title || "Untitled Case"),
      targetAddress: String(entity.targetAddress || ""),
      chain: String(entity.chain || "ethereum"),
      status: (String(entity.status || "active") as "active" | "closed"),
      createdAt: String(entity.createdAt || ""),
      updatedAt: String(entity.updatedAt || ""),
    });
  }

  return cases.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
};

export const deleteCase = async (userId: string, caseId: string): Promise<void> => {
  await ensureCaseTables();
  const caseClient = getCasesTableClient();
  const eventClient = getCaseEventsTableClient();

  // Verify ownership before deleting.
  await caseClient.getEntity<Record<string, unknown>>(userId, caseId);

  // Delete all events attached to this case for the current user.
  const escapedCaseId = caseId.replace(/'/g, "''");
  const escapedUserId = userId.replace(/'/g, "''");
  const events = eventClient.listEntities({
    queryOptions: {
      filter: `PartitionKey eq '${escapedCaseId}' and userId eq '${escapedUserId}'`,
    },
  });

  for await (const entity of events) {
    await eventClient.deleteEntity(String(entity.partitionKey), String(entity.rowKey));
  }

  await caseClient.deleteEntity(userId, caseId);
};

export const addCaseEvent = async (
  userId: string,
  caseId: string,
  event: Omit<CaseEventRecord, "id" | "caseId" | "userId" | "createdAt">
): Promise<CaseEventRecord> => {
  await ensureCaseTables();
  const eventClient = getCaseEventsTableClient();
  const caseClient = getCasesTableClient();
  const id = randomUUID();
  const now = new Date().toISOString();

  await eventClient.createEntity({
    partitionKey: caseId,
    rowKey: id,
    userId,
    feature: event.feature,
    title: event.title,
    narrative: event.narrative,
    metricsJson: JSON.stringify(event.metrics || {}),
    nodesJson: JSON.stringify(event.nodes || []),
    edgesJson: JSON.stringify(event.edges || []),
    createdAt: now,
  });

  try {
    const existingCase = await caseClient.getEntity<Record<string, unknown>>(userId, caseId);
    await caseClient.updateEntity(
      {
        partitionKey: userId,
        rowKey: caseId,
        title: existingCase.title,
        targetAddress: existingCase.targetAddress,
        chain: existingCase.chain,
        status: existingCase.status || "active",
        createdAt: existingCase.createdAt,
        updatedAt: now,
      },
      "Replace"
    );
  } catch {
    // Ignore case update failures so event save still succeeds.
  }

  return {
    id,
    caseId,
    userId,
    feature: event.feature,
    title: event.title,
    narrative: event.narrative,
    metrics: event.metrics,
    nodes: event.nodes,
    edges: event.edges,
    createdAt: now,
  };
};

export const listCaseEvents = async (userId: string, caseId: string): Promise<CaseEventRecord[]> => {
  await ensureCaseTables();
  const eventClient = getCaseEventsTableClient();
  const entities = eventClient.listEntities({
    queryOptions: {
      filter: `PartitionKey eq '${caseId.replace(/'/g, "''")}' and userId eq '${userId.replace(/'/g, "''")}'`,
    },
  });

  const events: CaseEventRecord[] = [];
  for await (const entity of entities) {
    events.push({
      id: String(entity.rowKey || ""),
      caseId,
      userId,
      feature: String(entity.feature || "profile") as CaseEventRecord["feature"],
      title: String(entity.title || "Untitled event"),
      narrative: String(entity.narrative || ""),
      metrics: (() => {
        try {
          return JSON.parse(String(entity.metricsJson || "{}"));
        } catch {
          return {};
        }
      })(),
      nodes: (() => {
        try {
          return JSON.parse(String(entity.nodesJson || "[]"));
        } catch {
          return [];
        }
      })(),
      edges: (() => {
        try {
          return JSON.parse(String(entity.edgesJson || "[]"));
        } catch {
          return [];
        }
      })(),
      createdAt: String(entity.createdAt || ""),
    });
  }

  return events.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
};

const normalizeArtifactTag = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return normalized || "artifact";
};

const toArtifactRecord = (entity: Record<string, unknown>, caseId: string, userId: string): CaseArtifactRecord => {
  const aliases = (() => {
    try {
      return JSON.parse(String(entity.aliasesJson || "[]")) as string[];
    } catch {
      return [];
    }
  })();

  const metadata = (() => {
    try {
      return JSON.parse(String(entity.metadataJson || "{}")) as Record<string, string | number>;
    } catch {
      return {};
    }
  })();

  return {
    id: String(entity.rowKey || ""),
    caseId,
    userId,
    tag: String(entity.tag || "artifact"),
    value: String(entity.value || ""),
    kind: String(entity.kind || "note") as CaseArtifactRecord["kind"],
    sourceFeature: String(entity.sourceFeature || "manual") as CaseArtifactRecord["sourceFeature"],
    aliases,
    metadata,
    createdAt: String(entity.createdAt || ""),
    updatedAt: String(entity.updatedAt || ""),
  };
};

export const upsertCaseArtifact = async (
  userId: string,
  caseId: string,
  artifact: {
    value: string;
    kind: CaseArtifactRecord["kind"];
    sourceFeature: CaseArtifactRecord["sourceFeature"];
    tag?: string;
    aliases?: string[];
    metadata?: Record<string, string | number>;
  }
): Promise<CaseArtifactRecord> => {
  await ensureCaseTables();
  const client = getCaseArtifactsTableClient();
  const now = new Date().toISOString();
  const trimmedValue = artifact.value.trim();

  const tagBase = normalizeArtifactTag(
    artifact.tag && artifact.tag.trim().length > 0
      ? artifact.tag
      : `${artifact.sourceFeature}-${artifact.kind}-${trimmedValue.slice(0, 12)}`
  );

  const escapedCaseId = caseId.replace(/'/g, "''");
  const escapedUserId = userId.replace(/'/g, "''");
  const escapedValue = trimmedValue.replace(/'/g, "''");

  const existingEntities = client.listEntities({
    queryOptions: {
      filter: `PartitionKey eq '${escapedCaseId}' and userId eq '${escapedUserId}' and value eq '${escapedValue}'`,
    },
  });

  for await (const entity of existingEntities) {
    const existing = toArtifactRecord(entity as Record<string, unknown>, caseId, userId);
    const mergedAliases = Array.from(
      new Set([...(existing.aliases || []), ...((artifact.aliases || []).map((item) => item.trim()).filter(Boolean))])
    );

    await client.updateEntity(
      {
        partitionKey: caseId,
        rowKey: existing.id,
        userId,
        tag: existing.tag,
        value: existing.value,
        kind: existing.kind,
        sourceFeature: existing.sourceFeature,
        aliasesJson: JSON.stringify(mergedAliases),
        metadataJson: JSON.stringify({ ...(existing.metadata || {}), ...(artifact.metadata || {}) }),
        createdAt: existing.createdAt,
        updatedAt: now,
      },
      "Replace"
    );

    return {
      ...existing,
      aliases: mergedAliases,
      metadata: { ...(existing.metadata || {}), ...(artifact.metadata || {}) },
      updatedAt: now,
    };
  }

  const uniqueTag = `${tagBase}-${Date.now().toString().slice(-6)}`;
  const id = randomUUID();
  const aliases = (artifact.aliases || []).map((item) => item.trim()).filter(Boolean);

  await client.createEntity({
    partitionKey: caseId,
    rowKey: id,
    userId,
    tag: uniqueTag,
    value: trimmedValue,
    kind: artifact.kind,
    sourceFeature: artifact.sourceFeature,
    aliasesJson: JSON.stringify(aliases),
    metadataJson: JSON.stringify(artifact.metadata || {}),
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    caseId,
    userId,
    tag: uniqueTag,
    value: trimmedValue,
    kind: artifact.kind,
    sourceFeature: artifact.sourceFeature,
    aliases,
    metadata: artifact.metadata || {},
    createdAt: now,
    updatedAt: now,
  };
};

export const listCaseArtifacts = async (
  userId: string,
  caseId: string,
  query?: string
): Promise<CaseArtifactRecord[]> => {
  await ensureCaseTables();
  const client = getCaseArtifactsTableClient();
  const escapedCaseId = caseId.replace(/'/g, "''");
  const escapedUserId = userId.replace(/'/g, "''");

  const entities = client.listEntities({
    queryOptions: {
      filter: `PartitionKey eq '${escapedCaseId}' and userId eq '${escapedUserId}'`,
    },
  });

  const items: CaseArtifactRecord[] = [];
  for await (const entity of entities) {
    items.push(toArtifactRecord(entity as Record<string, unknown>, caseId, userId));
  }

  const needle = (query || "").trim().toLowerCase().replace(/^@/, "");
  const filtered = needle
    ? items.filter((item) => {
        if (item.tag.toLowerCase().includes(needle)) return true;
        if (item.value.toLowerCase().includes(needle)) return true;
        if ((item.aliases || []).some((alias) => alias.toLowerCase().includes(needle))) return true;
        return false;
      })
    : items;

  return filtered.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
};

export const updateCaseArtifact = async (
  userId: string,
  caseId: string,
  artifactId: string,
  updates: {
    tag?: string;
    aliases?: string[];
    metadata?: Record<string, string | number>;
  }
): Promise<CaseArtifactRecord> => {
  await ensureCaseTables();
  const client = getCaseArtifactsTableClient();
  const escapedCaseId = caseId.replace(/'/g, "''");
  const escapedUserId = userId.replace(/'/g, "''");
  const escapedArtifactId = artifactId.replace(/'/g, "''");

  const entities = client.listEntities({
    queryOptions: {
      filter: `PartitionKey eq '${escapedCaseId}' and RowKey eq '${escapedArtifactId}' and userId eq '${escapedUserId}'`,
    },
  });

  let existing: CaseArtifactRecord | null = null;
  for await (const entity of entities) {
    existing = toArtifactRecord(entity as Record<string, unknown>, caseId, userId);
    break;
  }

  if (!existing) {
    throw new AuthError("Artifact not found", 404);
  }

  const now = new Date().toISOString();
  const nextTag = updates.tag && updates.tag.trim().length > 0 ? normalizeArtifactTag(updates.tag) : existing.tag;
  const nextAliases = updates.aliases
    ? Array.from(new Set(updates.aliases.map((alias) => alias.trim()).filter(Boolean)))
    : existing.aliases;
  const nextMetadata = updates.metadata ? { ...(existing.metadata || {}), ...updates.metadata } : existing.metadata;

  await client.updateEntity(
    {
      partitionKey: caseId,
      rowKey: artifactId,
      userId,
      tag: nextTag,
      value: existing.value,
      kind: existing.kind,
      sourceFeature: existing.sourceFeature,
      aliasesJson: JSON.stringify(nextAliases),
      metadataJson: JSON.stringify(nextMetadata || {}),
      createdAt: existing.createdAt,
      updatedAt: now,
    },
    "Replace"
  );

  return {
    ...existing,
    tag: nextTag,
    aliases: nextAliases,
    metadata: nextMetadata || {},
    updatedAt: now,
  };
};

export const deleteCaseArtifact = async (userId: string, caseId: string, artifactId: string): Promise<boolean> => {
  await ensureCaseTables();
  const client = getCaseArtifactsTableClient();
  const escapedCaseId = caseId.replace(/'/g, "''");
  const escapedUserId = userId.replace(/'/g, "''");
  const escapedArtifactId = artifactId.replace(/'/g, "''");

  const entities = client.listEntities({
    queryOptions: {
      filter: `PartitionKey eq '${escapedCaseId}' and RowKey eq '${escapedArtifactId}' and userId eq '${escapedUserId}'`,
    },
  });

  let found = false;
  for await (const _entity of entities) {
    found = true;
    break;
  }

  if (!found) {
    throw new AuthError("Artifact not found", 404);
  }

  await client.deleteEntity(caseId, artifactId);
  return true;
};

export const buildCaseReportPack = async (userId: string, caseId: string): Promise<{ markdown: string; mermaid: string; summary: string }> => {
  const cases = await listCases(userId);
  const targetCase = cases.find((item) => item.id === caseId);
  if (!targetCase) {
    throw new AuthError("Case not found", 404);
  }

  const events = await listCaseEvents(userId, caseId);
  const evidenceLines = events.map((event) => `- [${event.feature.toUpperCase()}] ${event.title}: ${event.narrative}`);

  const allEdges = events.flatMap((event) => event.edges || []);
  const uniqueEdges = Array.from(new Set(allEdges.map((edge) => `${edge.source}|${edge.target}|${edge.label || ""}`))).map(
    (entry) => {
      const [source, target, label] = entry.split("|");
      return { source, target, label };
    }
  );

  const mermaid = [
    "flowchart LR",
    ...uniqueEdges.map((edge) => `  ${edge.source.replace(/[^a-zA-Z0-9_]/g, "_")} -->|${(edge.label || "flow").replace(/[^a-zA-Z0-9_ ]/g, "")}| ${edge.target.replace(/[^a-zA-Z0-9_]/g, "_")}`),
  ].join("\n");

  const summary = `Case ${targetCase.title} has ${events.length} evidence events across profile, trace, and cluster analysis.`;

  const markdown = `# ${targetCase.title}\n\n## Investigation Summary\n${summary}\n\n## Target\n- Address: ${targetCase.targetAddress}\n- Chain: ${targetCase.chain}\n\n## Evidence Narrative\n${evidenceLines.length > 0 ? evidenceLines.join("\n") : "- No evidence events captured yet."}\n\n## Analyst Notes\n- This report was auto-assembled from saved feature outputs to reduce manual reporting overhead.\n\n## Graph Diagram (Mermaid)\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`;

  return { markdown, mermaid, summary };
};

export const createAsyncJob = async (
  userId: string,
  type: "profile" | "trace" | "cluster",
  payload: Record<string, unknown>,
  requestedJobId?: string
): Promise<AsyncJobRecord> => {
  await ensureJobsTable();
  const client = getJobsTableClient();

  const id = requestedJobId || `queued_${Date.now()}`;
  const now = new Date().toISOString();

  await client.createEntity({
    partitionKey: userId,
    rowKey: id,
    type,
    status: "queued",
    payloadJson: JSON.stringify(payload || {}),
    resultJson: "",
    error: "",
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    userId,
    type,
    status: "queued",
    payload,
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
};

export const updateAsyncJob = async (
  userId: string,
  jobId: string,
  patch: {
    status?: "queued" | "running" | "completed" | "failed";
    result?: Record<string, unknown> | null;
    error?: string | null;
  }
): Promise<void> => {
  await ensureJobsTable();
  const client = getJobsTableClient();

  await client.updateEntity(
    {
      partitionKey: userId,
      rowKey: jobId,
      ...(patch.status ? { status: patch.status } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "result")
        ? { resultJson: JSON.stringify(patch.result || {}) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "error") ? { error: patch.error || "" } : {}),
      updatedAt: new Date().toISOString(),
    },
    "Merge"
  );
};

export const getAsyncJob = async (userId: string, jobId: string): Promise<AsyncJobRecord | null> => {
  await ensureJobsTable();
  const client = getJobsTableClient();

  try {
    const entity = await client.getEntity<Record<string, unknown>>(userId, jobId);
    return {
      id: String(entity.rowKey),
      userId: String(entity.partitionKey),
      type: String(entity.type || "trace") as "profile" | "trace" | "cluster",
      status: String(entity.status || "queued") as "queued" | "running" | "completed" | "failed",
      payload: (() => {
        try {
          return JSON.parse(String(entity.payloadJson || "{}"));
        } catch {
          return {};
        }
      })(),
      result: (() => {
        try {
          const raw = String(entity.resultJson || "").trim();
          if (!raw) return null;
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })(),
      error: String(entity.error || "") || null,
      createdAt: String(entity.createdAt || ""),
      updatedAt: String(entity.updatedAt || ""),
    };
  } catch {
    return null;
  }
};

export const enqueueJob = async (
  queueName: string,
  jobPayload: Record<string, unknown>
): Promise<string> => {
  const requestedJobId = typeof jobPayload.jobId === "string" ? jobPayload.jobId : null;
  const message = {
    body: JSON.stringify(jobPayload),
    contentType: "application/json",
    timeToLive: 60 * 60 * 1000,
  };

  const candidateNames = Array.from(new Set([queueName, queueName.toLowerCase(), queueName.toUpperCase()]));
  let lastError: unknown = null;

  for (const candidate of candidateNames) {
    const sender = serviceBusClient.createSender(candidate);
    try {
      await sender.sendMessages(message);
      await sender.close();

      if (candidate !== queueName) {
        console.warn(`Queue '${queueName}' not found; used '${candidate}' instead. Update env to match exactly.`);
      }

      return requestedJobId || `queued_${Date.now()}`;
    } catch (error) {
      lastError = error;
      await sender.close();

      const errorWithCode = error as { code?: string };
      if (errorWithCode.code !== "MessagingEntityNotFound") {
        console.error(`Failed to enqueue job to ${candidate}:`, error);
        throw error;
      }
    }
  }

  console.error(`Failed to enqueue job to ${queueName}:`, lastError);
  throw lastError;
};

export const closeServiceBusClient = async () => {
  await serviceBusClient.close();
};
