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
const ACCESS_CODES_TABLE_NAME = "auboxaccesscodes";

let usersTableClient: TableClient | null = null;
let casesTableClient: TableClient | null = null;
let caseEventsTableClient: TableClient | null = null;
let caseArtifactsTableClient: TableClient | null = null;
let jobsTableClient: TableClient | null = null;
let accessCodesTableClient: TableClient | null = null;

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

const getAccessCodesTableClient = (): TableClient => {
  if (accessCodesTableClient) {
    return accessCodesTableClient;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured");
  }

  accessCodesTableClient = TableClient.fromConnectionString(connectionString, ACCESS_CODES_TABLE_NAME);
  return accessCodesTableClient;
};

let usersTableInitPromise: Promise<void> | null = null;
let casesTableInitPromise: Promise<void> | null = null;
let caseEventsTableInitPromise: Promise<void> | null = null;
let caseArtifactsTableInitPromise: Promise<void> | null = null;
let jobsTableInitPromise: Promise<void> | null = null;
let accessCodesTableInitPromise: Promise<void> | null = null;

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

const ensureAccessCodesTable = async (): Promise<void> => {
  if (!accessCodesTableInitPromise) {
    accessCodesTableInitPromise = (async () => {
      const client = getAccessCodesTableClient();
      await client.createTable().catch(() => {
        // Ignore if table already exists.
      });
    })();
  }

  await accessCodesTableInitPromise;
};

export interface AuthUser {
  id: string;
  email: string;
  username?: string;
  name?: string;
  profileIcon?: string;
  createdAt?: string;
  lastLoginAt?: string;
  oid?: string;
  accessGranted?: boolean;
  onboardingCompleted?: boolean;
  onboardingStep?: string;
  userSequenceNumber?: number;
  inviteGrantLimit?: number;
  inviteGrantUsed?: number;
  inviteGrantCycleDays?: number;
  inviteGrantCycleStartedAt?: string;
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
  username?: string;
  name?: string;
  profileIcon?: string;
  createdAt?: string;
  lastLoginAt?: string;
  passwordHash: string;
  accessGranted: boolean;
  onboardingCompleted: boolean;
  onboardingStep: string;
  userSequenceNumber?: number;
  howHeardAboutUs?: string;
  roleStatus?: string;
  teamSize?: string;
  useCase?: string;
  region?: string;
  referralCodeUsed?: string;
  inviteGrantLimit?: number;
  inviteGrantUsed?: number;
  inviteGrantCycleDays?: number;
  inviteGrantCycleStartedAt?: string;
};

export interface InviteGrantSummary {
  limit: number;
  used: number;
  remaining: number;
  cycleDays?: number;
  cycleStartedAt?: string;
  nextResetAt?: string;
}

export interface InviteGrantUserRecord {
  id: string;
  email: string;
  username?: string;
  name?: string;
  inviteGrantLimit: number;
  inviteGrantUsed: number;
  inviteGrantRemaining: number;
  inviteGrantCycleDays?: number;
  inviteGrantCycleStartedAt?: string;
  inviteGrantNextResetAt?: string;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  username?: string;
  name?: string;
  createdAt?: string;
  lastLoginAt?: string;
  onboardingCompleted: boolean;
  accessGranted: boolean;
}

export interface AdminUserListResult {
  users: AdminUserRecord[];
  totalUsers: number;
  activeUsers: number;
}

export interface AccessCodeCreatorStats {
  creatorUserId: string;
  creatorEmail?: string;
  codesCreated: number;
  totalCapacityIssued: number;
  successfulSignups: number;
}

export interface AccessCodeRecord {
  code: string;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
  expiresAt?: string;
}

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
  feature: "profile" | "trace" | "cluster" | "timeline" | "report" | "social" | "token";
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
  sourceFeature: "trace" | "cluster" | "social" | "profile" | "timeline" | "report" | "manual" | "token";
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
const DEFAULT_INVITE_GRANT_CYCLE_DAYS = 30;

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
  username: entity.username ? String(entity.username) : undefined,
  name: entity.name ? String(entity.name) : undefined,
  profileIcon: entity.profileIcon ? String(entity.profileIcon) : undefined,
  createdAt: entity.createdAt ? String(entity.createdAt) : undefined,
  lastLoginAt: entity.lastLoginAt ? String(entity.lastLoginAt) : undefined,
  passwordHash: String(entity.passwordHash || ""),
  accessGranted: Boolean(entity.accessGranted),
  onboardingCompleted: Boolean(entity.onboardingCompleted),
  onboardingStep: String(entity.onboardingStep || "access_code"),
  userSequenceNumber: entity.userSequenceNumber ? Number(entity.userSequenceNumber) : undefined,
  howHeardAboutUs: entity.howHeardAboutUs ? String(entity.howHeardAboutUs) : undefined,
  roleStatus: entity.roleStatus ? String(entity.roleStatus) : undefined,
  teamSize: entity.teamSize ? String(entity.teamSize) : undefined,
  useCase: entity.useCase ? String(entity.useCase) : undefined,
  region: entity.region ? String(entity.region) : undefined,
  referralCodeUsed: entity.referralCodeUsed ? String(entity.referralCodeUsed) : undefined,
  inviteGrantLimit: Number(entity.inviteGrantLimit || 0),
  inviteGrantUsed: Number(entity.inviteGrantUsed || 0),
  inviteGrantCycleDays: Number(entity.inviteGrantCycleDays || DEFAULT_INVITE_GRANT_CYCLE_DAYS),
  inviteGrantCycleStartedAt: entity.inviteGrantCycleStartedAt
    ? String(entity.inviteGrantCycleStartedAt)
    : undefined,
});

const normalizeInviteGrantState = (
  user: StoredUser,
  now: Date = new Date()
): InviteGrantSummary & { didResetCycle: boolean } => {
  const limit = Math.max(0, Number(user.inviteGrantLimit || 0));
  const cycleDays = Math.max(1, Number(user.inviteGrantCycleDays || DEFAULT_INVITE_GRANT_CYCLE_DAYS));
  const nowIso = now.toISOString();
  const initialCycleStart = user.inviteGrantCycleStartedAt || nowIso;
  const cycleStartMs = new Date(initialCycleStart).getTime();
  const cycleDurationMs = cycleDays * 24 * 60 * 60 * 1000;

  let cycleStartedAt = initialCycleStart;
  let used = Math.min(Math.max(0, Number(user.inviteGrantUsed || 0)), limit);
  let didResetCycle = false;

  if (Number.isFinite(cycleStartMs) && cycleStartMs + cycleDurationMs <= now.getTime()) {
    used = 0;
    cycleStartedAt = nowIso;
    didResetCycle = true;
  }

  const remaining = Math.max(limit - used, 0);
  const nextResetAt = new Date(new Date(cycleStartedAt).getTime() + cycleDurationMs).toISOString();

  return {
    limit,
    used,
    remaining,
    cycleDays,
    cycleStartedAt,
    nextResetAt,
    didResetCycle,
  };
};

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
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      accessGranted: user.accessGranted,
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
      userSequenceNumber: user.userSequenceNumber,
      inviteGrantLimit: user.inviteGrantLimit,
      inviteGrantUsed: user.inviteGrantUsed,
      inviteGrantCycleDays: user.inviteGrantCycleDays,
      inviteGrantCycleStartedAt: user.inviteGrantCycleStartedAt,
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
        accessGranted: Boolean(existing.accessGranted),
        onboardingCompleted: Boolean(existing.onboardingCompleted),
        onboardingStep: String(existing.onboardingStep || "access_code"),
        userSequenceNumber: existing.userSequenceNumber || "",
        howHeardAboutUs: existing.howHeardAboutUs || "",
        roleStatus: existing.roleStatus || "",
        teamSize: existing.teamSize || "",
        useCase: existing.useCase || "",
        region: existing.region || "",
        referralCodeUsed: existing.referralCodeUsed || "",
        inviteGrantLimit: existing.inviteGrantLimit || 0,
        inviteGrantUsed: existing.inviteGrantUsed || 0,
        inviteGrantCycleDays: existing.inviteGrantCycleDays || DEFAULT_INVITE_GRANT_CYCLE_DAYS,
        inviteGrantCycleStartedAt: existing.inviteGrantCycleStartedAt || existing.updatedAt || new Date().toISOString(),
        createdAt: existing.createdAt,
        lastLoginAt: existing.lastLoginAt || "",
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
  name?: string
): Promise<AuthUser> => {
  const normalizedEmail = normalizeEmail(email);

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
    username: "",
    name: name?.trim() || "",
    profileIcon: "",
    passwordHash: hashPassword(password),
    accessGranted: false,
    onboardingCompleted: false,
    onboardingStep: "access_code",
    lastLoginAt: "",
    inviteGrantLimit: 0,
    inviteGrantUsed: 0,
    inviteGrantCycleDays: DEFAULT_INVITE_GRANT_CYCLE_DAYS,
    inviteGrantCycleStartedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Invalidate cache to ensure new user is available for lookup
  invalidateUserCache(normalizedEmail, "");

  return {
    id,
    email: normalizedEmail,
    username: undefined,
    name: name?.trim() || undefined,
    accessGranted: false,
    onboardingCompleted: false,
    onboardingStep: "access_code",
  };
};

export const signInUser = async (email: string, password: string): Promise<AuthUser> => {
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AuthError("Invalid email or password", 401);
  }

  const now = new Date().toISOString();
  await ensureUsersTable();
  const client = getUsersTableClient();
  await client.updateEntity(
    {
      partitionKey: "users",
      rowKey: user.id,
      lastLoginAt: now,
      updatedAt: now,
    },
    "Merge"
  );

  invalidateUserCache(user.email, user.username || "");

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    profileIcon: user.profileIcon,
    createdAt: user.createdAt,
    lastLoginAt: now,
    accessGranted: user.accessGranted,
    onboardingCompleted: user.onboardingCompleted,
    onboardingStep: user.onboardingStep,
    userSequenceNumber: user.userSequenceNumber,
    inviteGrantLimit: user.inviteGrantLimit,
    inviteGrantUsed: user.inviteGrantUsed,
    inviteGrantCycleDays: user.inviteGrantCycleDays,
    inviteGrantCycleStartedAt: user.inviteGrantCycleStartedAt,
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

    const currentUsername = String(existing.username || "").trim().toLowerCase();
    const nextUsername = payload.username
      ? normalizeUsername(payload.username)
      : currentUsername;

    if (nextUsername && nextUsername !== currentUsername) {
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
        accessGranted: Boolean(existing.accessGranted),
        onboardingCompleted: Boolean(existing.onboardingCompleted),
        onboardingStep: String(existing.onboardingStep || "access_code"),
        userSequenceNumber: existing.userSequenceNumber || "",
        howHeardAboutUs: existing.howHeardAboutUs || "",
        roleStatus: existing.roleStatus || "",
        teamSize: existing.teamSize || "",
        useCase: existing.useCase || "",
        region: existing.region || "",
        referralCodeUsed: existing.referralCodeUsed || "",
        inviteGrantLimit: existing.inviteGrantLimit || 0,
        inviteGrantUsed: existing.inviteGrantUsed || 0,
        inviteGrantCycleDays: existing.inviteGrantCycleDays || DEFAULT_INVITE_GRANT_CYCLE_DAYS,
        inviteGrantCycleStartedAt: existing.inviteGrantCycleStartedAt || existing.updatedAt || new Date().toISOString(),
        createdAt: existing.createdAt,
        lastLoginAt: existing.lastLoginAt || "",
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
      accessGranted: Boolean(existing.accessGranted),
      onboardingCompleted: Boolean(existing.onboardingCompleted),
      onboardingStep: String(existing.onboardingStep || "access_code"),
      userSequenceNumber: existing.userSequenceNumber ? Number(existing.userSequenceNumber) : undefined,
      inviteGrantLimit: Number(existing.inviteGrantLimit || 0),
      inviteGrantUsed: Number(existing.inviteGrantUsed || 0),
      inviteGrantCycleDays: Number(existing.inviteGrantCycleDays || DEFAULT_INVITE_GRANT_CYCLE_DAYS),
      inviteGrantCycleStartedAt: existing.inviteGrantCycleStartedAt
        ? String(existing.inviteGrantCycleStartedAt)
        : undefined,
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

const nextUserSequenceNumber = async (): Promise<number> => {
  await ensureUsersTable();
  const client = getUsersTableClient();
  const entities = client.listEntities({
    queryOptions: {
      filter: "PartitionKey eq 'users'",
      select: ["userSequenceNumber"],
    },
  });

  let highest = 0;
  for await (const entity of entities) {
    const value = Number(entity.userSequenceNumber || 0);
    if (Number.isFinite(value) && value > highest) {
      highest = value;
    }
  }

  return highest + 1;
};

const mapEntityToAccessCode = (entity: Record<string, unknown>): AccessCodeRecord => ({
  code: String(entity.rowKey || ""),
  maxUses: Number(entity.maxUses || 1),
  usedCount: Number(entity.usedCount || 0),
  isActive: Boolean(entity.isActive ?? true),
  createdByUserId: String(entity.createdByUserId || "system"),
  createdAt: String(entity.createdAt || new Date().toISOString()),
  expiresAt: entity.expiresAt ? String(entity.expiresAt) : undefined,
});

export const createAccessCode = async (
  code: string,
  createdByUserId = "system",
  maxUses = 1,
  expiresAt?: string
): Promise<AccessCodeRecord> => {
  await ensureAccessCodesTable();
  const client = getAccessCodesTableClient();
  const normalizedCode = code.trim().toLowerCase();

  if (!normalizedCode) {
    throw new AuthError("Access code is required", 400);
  }

  const existing = await client.getEntity<Record<string, unknown>>("codes", normalizedCode).catch(() => null);
  if (existing) {
    throw new AuthError("Access code already exists", 409);
  }

  const now = new Date().toISOString();
  const entity = {
    partitionKey: "codes",
    rowKey: normalizedCode,
    maxUses: Math.max(1, maxUses),
    usedCount: 0,
    isActive: true,
    createdByUserId,
    createdAt: now,
    expiresAt: expiresAt || "",
  };

  await client.createEntity(entity);
  return mapEntityToAccessCode(entity);
};

export const listAccessCodes = async (options?: {
  createdByUserId?: string;
  includeInactive?: boolean;
}): Promise<AccessCodeRecord[]> => {
  await ensureAccessCodesTable();
  const client = getAccessCodesTableClient();

  const entities = client.listEntities({
    queryOptions: {
      filter: "PartitionKey eq 'codes'",
    },
  });

  const records: AccessCodeRecord[] = [];
  for await (const entity of entities) {
    const record = mapEntityToAccessCode(entity as Record<string, unknown>);
    records.push(record);
  }

  const filtered = records.filter((record) => {
    if (options?.createdByUserId && record.createdByUserId !== options.createdByUserId) {
      return false;
    }
    if (!options?.includeInactive && !record.isActive) {
      return false;
    }
    return true;
  });

  return filtered.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
};

export const listAccessCodeCreatorStats = async (options?: { windowDays?: number }): Promise<AccessCodeCreatorStats[]> => {
  const codes = await listAccessCodes({ includeInactive: true });
  const cutoffMs = options?.windowDays && options.windowDays > 0
    ? Date.now() - options.windowDays * 24 * 60 * 60 * 1000
    : null;

  await ensureUsersTable();
  const usersClient = getUsersTableClient();
  const users = usersClient.listEntities({
    queryOptions: {
      filter: "PartitionKey eq 'users'",
      select: ["RowKey", "email"],
    },
  });

  const emailById = new Map<string, string>();
  for await (const entity of users) {
    const id = String(entity.rowKey || "");
    if (id) {
      emailById.set(id, String(entity.email || ""));
    }
  }

  const statsByCreator = new Map<string, AccessCodeCreatorStats>();
  for (const code of codes) {
    if (cutoffMs) {
      const createdMs = new Date(code.createdAt).getTime();
      if (!Number.isFinite(createdMs) || createdMs < cutoffMs) {
        continue;
      }
    }

    const creatorUserId = code.createdByUserId || "system";
    const existing = statsByCreator.get(creatorUserId) || {
      creatorUserId,
      creatorEmail: emailById.get(creatorUserId),
      codesCreated: 0,
      totalCapacityIssued: 0,
      successfulSignups: 0,
    };

    existing.codesCreated += 1;
    existing.totalCapacityIssued += code.maxUses;
    existing.successfulSignups += code.usedCount;
    statsByCreator.set(creatorUserId, existing);
  }

  return Array.from(statsByCreator.values()).sort((a, b) => {
    if (b.successfulSignups !== a.successfulSignups) {
      return b.successfulSignups - a.successfulSignups;
    }
    return b.codesCreated - a.codesCreated;
  });
};

const buildInviteGrantSummary = (user: StoredUser): InviteGrantSummary => {
  const normalized = normalizeInviteGrantState(user);
  return {
    limit: normalized.limit,
    used: normalized.used,
    remaining: normalized.remaining,
    cycleDays: normalized.cycleDays,
    cycleStartedAt: normalized.cycleStartedAt,
    nextResetAt: normalized.nextResetAt,
  };
};

export const getInviteGrantSummary = async (userId: string): Promise<InviteGrantSummary> => {
  await ensureUsersTable();
  const client = getUsersTableClient();
  const entity = await client.getEntity<Record<string, unknown>>("users", userId).catch(() => null);
  if (!entity) {
    throw new AuthError("User not found", 404);
  }

  return buildInviteGrantSummary(mapEntityToUser(entity));
};

export const reserveInviteGrantCapacity = async (userId: string, amount: number): Promise<InviteGrantSummary> => {
  const requested = Math.max(1, Math.floor(amount));

  await ensureUsersTable();
  const client = getUsersTableClient();
  const entity = await client.getEntity<Record<string, unknown>>("users", userId).catch(() => null);
  if (!entity) {
    throw new AuthError("User not found", 404);
  }

  const user = mapEntityToUser(entity);
  const grantState = normalizeInviteGrantState(user);
  const grant: InviteGrantSummary = {
    limit: grantState.limit,
    used: grantState.used,
    remaining: grantState.remaining,
    cycleDays: grantState.cycleDays,
    cycleStartedAt: grantState.cycleStartedAt,
    nextResetAt: grantState.nextResetAt,
  };
  if (grant.remaining < requested) {
    throw new AuthError("Invite grant limit reached. Contact an admin for more capacity.", 403);
  }

  const nextUsed = grant.used + requested;
  await client.updateEntity(
    {
      partitionKey: "users",
      rowKey: user.id,
      email: user.email,
      username: user.username || "",
      passwordHash: user.passwordHash,
      name: user.name || "",
      profileIcon: user.profileIcon || "",
      accessGranted: user.accessGranted,
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
      userSequenceNumber: user.userSequenceNumber || "",
      howHeardAboutUs: user.howHeardAboutUs || "",
      roleStatus: user.roleStatus || "",
      teamSize: user.teamSize || "",
      useCase: user.useCase || "",
      region: user.region || "",
      referralCodeUsed: user.referralCodeUsed || "",
      inviteGrantLimit: grant.limit,
      inviteGrantUsed: nextUsed,
      inviteGrantCycleDays: grant.cycleDays,
      inviteGrantCycleStartedAt: grant.cycleStartedAt,
      createdAt: entity.createdAt,
      lastLoginAt: user.lastLoginAt || "",
      updatedAt: new Date().toISOString(),
    },
    "Replace"
  );

  invalidateUserCache(user.email, user.username || "");

  return {
    limit: grant.limit,
    used: nextUsed,
    remaining: Math.max(grant.limit - nextUsed, 0),
    cycleDays: grant.cycleDays,
    cycleStartedAt: grant.cycleStartedAt,
    nextResetAt: grant.nextResetAt,
  };
};

export const releaseInviteGrantCapacity = async (userId: string, amount: number): Promise<InviteGrantSummary> => {
  const released = Math.max(1, Math.floor(amount));

  await ensureUsersTable();
  const client = getUsersTableClient();
  const entity = await client.getEntity<Record<string, unknown>>("users", userId).catch(() => null);
  if (!entity) {
    throw new AuthError("User not found", 404);
  }

  const user = mapEntityToUser(entity);
  const grantState = normalizeInviteGrantState(user);
  const grant: InviteGrantSummary = {
    limit: grantState.limit,
    used: grantState.used,
    remaining: grantState.remaining,
    cycleDays: grantState.cycleDays,
    cycleStartedAt: grantState.cycleStartedAt,
    nextResetAt: grantState.nextResetAt,
  };
  const nextUsed = Math.max(grant.used - released, 0);

  await client.updateEntity(
    {
      partitionKey: "users",
      rowKey: user.id,
      email: user.email,
      username: user.username || "",
      passwordHash: user.passwordHash,
      name: user.name || "",
      profileIcon: user.profileIcon || "",
      accessGranted: user.accessGranted,
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
      userSequenceNumber: user.userSequenceNumber || "",
      howHeardAboutUs: user.howHeardAboutUs || "",
      roleStatus: user.roleStatus || "",
      teamSize: user.teamSize || "",
      useCase: user.useCase || "",
      region: user.region || "",
      referralCodeUsed: user.referralCodeUsed || "",
      inviteGrantLimit: grant.limit,
      inviteGrantUsed: nextUsed,
      inviteGrantCycleDays: grant.cycleDays,
      inviteGrantCycleStartedAt: grant.cycleStartedAt,
      createdAt: entity.createdAt,
      lastLoginAt: user.lastLoginAt || "",
      updatedAt: new Date().toISOString(),
    },
    "Replace"
  );

  invalidateUserCache(user.email, user.username || "");

  return {
    limit: grant.limit,
    used: nextUsed,
    remaining: Math.max(grant.limit - nextUsed, 0),
    cycleDays: grant.cycleDays,
    cycleStartedAt: grant.cycleStartedAt,
    nextResetAt: grant.nextResetAt,
  };
};

export const setUserInviteGrantByEmail = async (
  email: string,
  inviteGrantLimit: number,
  inviteGrantCycleDays?: number
): Promise<InviteGrantUserRecord> => {
  const normalized = normalizeEmail(email);
  const user = await findUserByEmail(normalized);
  if (!user) {
    throw new AuthError("User not found for provided email", 404);
  }

  await ensureUsersTable();
  const client = getUsersTableClient();
  const entity = await client.getEntity<Record<string, unknown>>("users", user.id).catch(() => null);
  if (!entity) {
    throw new AuthError("User not found", 404);
  }

  const current = mapEntityToUser(entity);
  const limit = Math.max(0, Math.floor(inviteGrantLimit));
  const used = Math.min(Math.max(0, Number(current.inviteGrantUsed || 0)), limit);
  const cycleDays = Math.max(1, Math.floor(inviteGrantCycleDays || current.inviteGrantCycleDays || DEFAULT_INVITE_GRANT_CYCLE_DAYS));
  const cycleStartedAt = new Date().toISOString();

  await client.updateEntity(
    {
      partitionKey: "users",
      rowKey: current.id,
      email: current.email,
      username: current.username || "",
      passwordHash: current.passwordHash,
      name: current.name || "",
      profileIcon: current.profileIcon || "",
      accessGranted: current.accessGranted,
      onboardingCompleted: current.onboardingCompleted,
      onboardingStep: current.onboardingStep,
      userSequenceNumber: current.userSequenceNumber || "",
      howHeardAboutUs: current.howHeardAboutUs || "",
      roleStatus: current.roleStatus || "",
      teamSize: current.teamSize || "",
      useCase: current.useCase || "",
      region: current.region || "",
      referralCodeUsed: current.referralCodeUsed || "",
      inviteGrantLimit: limit,
      inviteGrantUsed: used,
      inviteGrantCycleDays: cycleDays,
      inviteGrantCycleStartedAt: cycleStartedAt,
      createdAt: entity.createdAt,
      lastLoginAt: current.lastLoginAt || "",
      updatedAt: new Date().toISOString(),
    },
    "Replace"
  );

  invalidateUserCache(current.email, current.username || "");

  return {
    id: current.id,
    email: current.email,
    username: current.username,
    name: current.name,
    inviteGrantLimit: limit,
    inviteGrantUsed: used,
    inviteGrantRemaining: Math.max(limit - used, 0),
    inviteGrantCycleDays: cycleDays,
    inviteGrantCycleStartedAt: cycleStartedAt,
    inviteGrantNextResetAt: new Date(new Date(cycleStartedAt).getTime() + cycleDays * 24 * 60 * 60 * 1000).toISOString(),
  };
};

export const listUsersWithInviteGrants = async (): Promise<InviteGrantUserRecord[]> => {
  await ensureUsersTable();
  const client = getUsersTableClient();
  const entities = client.listEntities({
    queryOptions: {
      filter: "PartitionKey eq 'users'",
    },
  });

  const users: InviteGrantUserRecord[] = [];
  for await (const entity of entities) {
    const mapped = mapEntityToUser(entity as Record<string, unknown>);
    const normalized = normalizeInviteGrantState(mapped);
    const limit = normalized.limit;
    const used = normalized.used;
    if (limit === 0 && used === 0) {
      continue;
    }

    users.push({
      id: mapped.id,
      email: mapped.email,
      username: mapped.username,
      name: mapped.name,
      inviteGrantLimit: limit,
      inviteGrantUsed: used,
      inviteGrantRemaining: Math.max(limit - used, 0),
      inviteGrantCycleDays: normalized.cycleDays,
      inviteGrantCycleStartedAt: normalized.cycleStartedAt,
      inviteGrantNextResetAt: normalized.nextResetAt,
    });
  }

  return users.sort((a, b) => {
    if (b.inviteGrantRemaining !== a.inviteGrantRemaining) {
      return b.inviteGrantRemaining - a.inviteGrantRemaining;
    }
    return a.email.localeCompare(b.email);
  });
};

export const listUsersForAdmin = async (options?: {
  search?: string;
  activeWithinHours?: number;
}): Promise<AdminUserListResult> => {
  await ensureUsersTable();
  const client = getUsersTableClient();

  const search = options?.search?.trim().toLowerCase() || "";
  const activeWithinHours = options?.activeWithinHours;
  const nowMs = Date.now();

  const entities = client.listEntities({
    queryOptions: {
      filter: "PartitionKey eq 'users'",
    },
  });

  const users: AdminUserRecord[] = [];
  let activeUsers = 0;

  for await (const entity of entities) {
    const mapped = mapEntityToUser(entity as Record<string, unknown>);
    if (!mapped.id || !mapped.email) {
      continue;
    }

    if (
      search &&
      !mapped.email.toLowerCase().includes(search) &&
      !mapped.id.toLowerCase().includes(search) &&
      !(mapped.username || "").toLowerCase().includes(search)
    ) {
      continue;
    }

    const lastLoginAt = mapped.lastLoginAt;
    const lastLoginMs = lastLoginAt ? new Date(lastLoginAt).getTime() : NaN;
    const isActive =
      typeof activeWithinHours === "number"
        ? Number.isFinite(lastLoginMs) && nowMs - lastLoginMs <= activeWithinHours * 60 * 60 * 1000
        : Boolean(lastLoginAt);

    if (isActive) {
      activeUsers += 1;
    }

    users.push({
      id: mapped.id,
      email: mapped.email,
      username: mapped.username,
      name: mapped.name,
      createdAt: mapped.createdAt,
      lastLoginAt,
      onboardingCompleted: mapped.onboardingCompleted,
      accessGranted: mapped.accessGranted,
    });
  }

  users.sort((a, b) => {
    const aCreated = new Date(a.createdAt || 0).getTime();
    const bCreated = new Date(b.createdAt || 0).getTime();
    return bCreated - aCreated;
  });

  return {
    users,
    totalUsers: users.length,
    activeUsers,
  };
};

export const deleteUserForAdmin = async (userId: string): Promise<{ id: string; email: string }> => {
  await ensureUsersTable();
  const client = getUsersTableClient();

  const entity = await client.getEntity<Record<string, unknown>>("users", userId).catch(() => null);
  if (!entity) {
    throw new AuthError("User not found", 404);
  }

  const mapped = mapEntityToUser(entity);
  await client.deleteEntity("users", userId);
  invalidateUserCache(mapped.email, mapped.username || "");

  return {
    id: mapped.id,
    email: mapped.email,
  };
};

export const setAccessCodeActive = async (code: string, isActive: boolean): Promise<AccessCodeRecord> => {
  await ensureAccessCodesTable();
  const client = getAccessCodesTableClient();
  const normalizedCode = code.trim().toLowerCase();

  if (!normalizedCode) {
    throw new AuthError("Access code is required", 400);
  }

  const existing = await client.getEntity<Record<string, unknown>>("codes", normalizedCode).catch(() => null);
  if (!existing) {
    throw new AuthError("Access code not found", 404);
  }

  const record = mapEntityToAccessCode(existing);
  await client.updateEntity(
    {
      partitionKey: "codes",
      rowKey: record.code,
      maxUses: record.maxUses,
      usedCount: record.usedCount,
      isActive,
      createdByUserId: record.createdByUserId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt || "",
      updatedAt: new Date().toISOString(),
    },
    "Replace"
  );

  return {
    ...record,
    isActive,
  };
};

export const ensureDefaultAccessCodes = async (): Promise<void> => {
  const configured = process.env.AUBOX_DEFAULT_ACCESS_CODES || "";
  const parsed = configured
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parsed.length === 0) {
    return;
  }

  for (const code of parsed) {
    try {
      await createAccessCode(code, "system", Number(process.env.AUBOX_DEFAULT_ACCESS_CODE_USES || 1000));
    } catch (error) {
      if (isAuthError(error) && error.status === 409) {
        continue;
      }
      throw error;
    }
  }
};

export const redeemAccessCodeForUser = async (
  userId: string,
  code: string
): Promise<AuthUser> => {
  await ensureUsersTable();
  await ensureAccessCodesTable();

  const usersClient = getUsersTableClient();
  const codesClient = getAccessCodesTableClient();
  const normalizedCode = code.trim().toLowerCase();

  if (!normalizedCode) {
    throw new AuthError("Access code is required", 400);
  }

  const userEntity = await usersClient.getEntity<Record<string, unknown>>("users", userId).catch(() => null);
  if (!userEntity) {
    throw new AuthError("User not found", 404);
  }

  const user = mapEntityToUser(userEntity);
  if (user.accessGranted) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      profileIcon: user.profileIcon,
      accessGranted: true,
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
      userSequenceNumber: user.userSequenceNumber,
    };
  }

  const codeEntity = await codesClient.getEntity<Record<string, unknown>>("codes", normalizedCode).catch(() => null);
  if (!codeEntity) {
    throw new AuthError("Invalid access code", 400);
  }

  const accessCode = mapEntityToAccessCode(codeEntity);
  if (!accessCode.isActive) {
    throw new AuthError("Access code is inactive", 400);
  }
  if (accessCode.expiresAt && new Date(accessCode.expiresAt).getTime() < Date.now()) {
    throw new AuthError("Access code has expired", 400);
  }
  if (accessCode.usedCount >= accessCode.maxUses) {
    throw new AuthError("Access code usage limit reached", 400);
  }

  const now = new Date().toISOString();
  await codesClient.updateEntity(
    {
      partitionKey: "codes",
      rowKey: accessCode.code,
      maxUses: accessCode.maxUses,
      usedCount: accessCode.usedCount + 1,
      isActive: accessCode.isActive,
      createdByUserId: accessCode.createdByUserId,
      createdAt: accessCode.createdAt,
      expiresAt: accessCode.expiresAt || "",
      updatedAt: now,
    },
    "Replace"
  );

  await usersClient.updateEntity(
    {
      partitionKey: "users",
      rowKey: user.id,
      email: user.email,
      username: user.username || "",
      passwordHash: user.passwordHash,
      name: user.name || "",
      profileIcon: user.profileIcon || "",
      accessGranted: true,
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: "profile",
      userSequenceNumber: user.userSequenceNumber || "",
      howHeardAboutUs: user.howHeardAboutUs || "",
      roleStatus: user.roleStatus || "",
      teamSize: user.teamSize || "",
      useCase: user.useCase || "",
      region: user.region || "",
      referralCodeUsed: normalizedCode,
      inviteGrantLimit: user.inviteGrantLimit || 0,
      inviteGrantUsed: user.inviteGrantUsed || 0,
      inviteGrantCycleDays: user.inviteGrantCycleDays || DEFAULT_INVITE_GRANT_CYCLE_DAYS,
      inviteGrantCycleStartedAt: user.inviteGrantCycleStartedAt || userEntity.updatedAt || now,
      createdAt: userEntity.createdAt,
      lastLoginAt: user.lastLoginAt || userEntity.lastLoginAt || "",
      updatedAt: now,
    },
    "Replace"
  );

  invalidateUserCache(user.email, user.username || "");

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    profileIcon: user.profileIcon,
    accessGranted: true,
    onboardingCompleted: user.onboardingCompleted,
    onboardingStep: "profile",
    userSequenceNumber: user.userSequenceNumber,
    inviteGrantLimit: user.inviteGrantLimit,
    inviteGrantUsed: user.inviteGrantUsed,
    inviteGrantCycleDays: user.inviteGrantCycleDays,
    inviteGrantCycleStartedAt: user.inviteGrantCycleStartedAt,
  };
};

export const completeOnboarding = async (
  userId: string,
  payload: {
    username: string;
    profileIcon: string;
    howHeardAboutUs: string;
    roleStatus: string;
    teamSize?: string;
    useCase?: string;
    region?: string;
  }
): Promise<AuthUser> => {
  const username = normalizeUsername(payload.username);
  if (!username || username.length < 3 || username.length > 24 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new AuthError("Invalid username format", 400);
  }

  const existingUsernameUser = await findUserByUsername(username);
  if (existingUsernameUser && existingUsernameUser.id !== userId) {
    throw new AuthError("Username is already taken", 409);
  }

  await ensureUsersTable();
  const usersClient = getUsersTableClient();
  const userEntity = await usersClient.getEntity<Record<string, unknown>>("users", userId).catch(() => null);
  if (!userEntity) {
    throw new AuthError("User not found", 404);
  }

  const user = mapEntityToUser(userEntity);
  if (!user.accessGranted) {
    throw new AuthError("Access code verification required", 403);
  }

  const sequenceNumber = user.userSequenceNumber || (await nextUserSequenceNumber());
  const now = new Date().toISOString();

  await usersClient.updateEntity(
    {
      partitionKey: "users",
      rowKey: user.id,
      email: user.email,
      username,
      passwordHash: user.passwordHash,
      name: user.name || "",
      profileIcon: payload.profileIcon,
      accessGranted: true,
      onboardingCompleted: true,
      onboardingStep: "done",
      userSequenceNumber: sequenceNumber,
      howHeardAboutUs: payload.howHeardAboutUs,
      roleStatus: payload.roleStatus,
      teamSize: payload.teamSize || "",
      useCase: payload.useCase || "",
      region: payload.region || "",
      referralCodeUsed: user.referralCodeUsed || "",
      inviteGrantLimit: user.inviteGrantLimit || 0,
      inviteGrantUsed: user.inviteGrantUsed || 0,
      inviteGrantCycleDays: user.inviteGrantCycleDays || DEFAULT_INVITE_GRANT_CYCLE_DAYS,
      inviteGrantCycleStartedAt: user.inviteGrantCycleStartedAt || userEntity.updatedAt || now,
      createdAt: userEntity.createdAt,
      lastLoginAt: user.lastLoginAt || userEntity.lastLoginAt || "",
      updatedAt: now,
    },
    "Replace"
  );

  invalidateUserCache(user.email, username);

  return {
    id: user.id,
    email: user.email,
    username,
    name: user.name,
    profileIcon: payload.profileIcon,
    accessGranted: true,
    onboardingCompleted: true,
    onboardingStep: "done",
    userSequenceNumber: sequenceNumber,
    inviteGrantLimit: user.inviteGrantLimit,
    inviteGrantUsed: user.inviteGrantUsed,
    inviteGrantCycleDays: user.inviteGrantCycleDays,
    inviteGrantCycleStartedAt: user.inviteGrantCycleStartedAt,
  };
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

export const buildCaseReportPack = async (
  userId: string,
  caseId: string
): Promise<{
  markdown: string;
  mermaid: string;
  summary: string;
  investigatorConclusion: string;
  findings: string[];
  contradictions: string[];
  nextChecks: string[];
  stats: {
    eventCount: number;
    nodeCount: number;
    edgeCount: number;
    strongEdgeCount: number;
    contradictionCount: number;
    featureCoverage: string[];
  };
}> => {
  const cases = await listCases(userId);
  const targetCase = cases.find((item) => item.id === caseId);
  if (!targetCase) {
    throw new AuthError("Case not found", 404);
  }

  const events = (await listCaseEvents(userId, caseId)).slice().sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  const evidenceLines = events.map((event) => `- [${event.feature.toUpperCase()}] ${event.title}: ${event.narrative}`);

  const featureCoverage = Array.from(new Set(events.map((event) => event.feature))).sort();

  const nodeMap = new Map<string, { label: string; type: string; support: number }>();
  for (const event of events) {
    for (const node of event.nodes || []) {
      const existing = nodeMap.get(node.id);
      if (!existing) {
        nodeMap.set(node.id, {
          label: node.label || node.id,
          type: node.type,
          support: 1,
        });
        continue;
      }
      existing.support += 1;
    }
  }

  const allEdges = events.flatMap((event) => event.edges || []);
  const edgeEvidence = new Map<
    string,
    {
      source: string;
      target: string;
      label: string;
      support: number;
      features: Set<string>;
      eventIds: Set<string>;
      firstSeen: string;
      lastSeen: string;
    }
  >();
  const pairLabels = new Map<string, Set<string>>();

  for (const event of events) {
    for (const edge of event.edges || []) {
      const label = (edge.label || "flow").trim() || "flow";
      const key = `${edge.source}|${edge.target}|${label}`;
      const pairKey = `${edge.source}|${edge.target}`;

      const labels = pairLabels.get(pairKey) || new Set<string>();
      labels.add(label);
      pairLabels.set(pairKey, labels);

      const existing = edgeEvidence.get(key);
      if (!existing) {
        edgeEvidence.set(key, {
          source: edge.source,
          target: edge.target,
          label,
          support: 1,
          features: new Set<string>([event.feature]),
          eventIds: new Set<string>([event.id]),
          firstSeen: event.createdAt,
          lastSeen: event.createdAt,
        });
        continue;
      }

      existing.support += 1;
      existing.features.add(event.feature);
      existing.eventIds.add(event.id);
      if (event.createdAt < existing.firstSeen) existing.firstSeen = event.createdAt;
      if (event.createdAt > existing.lastSeen) existing.lastSeen = event.createdAt;
    }
  }

  const uniqueEdges = Array.from(edgeEvidence.values()).sort((a, b) => b.support - a.support);

  const scoredEdges = uniqueEdges.map((edge) => {
    const pairKey = `${edge.source}|${edge.target}`;
    const conflictingLabels = (pairLabels.get(pairKey)?.size || 0) > 1;
    const supportPart = Math.min(60, edge.support * 20);
    const featurePart = Math.min(30, edge.features.size * 10);
    const confidence = Math.max(0, Math.min(100, supportPart + featurePart + (edge.label !== "flow" ? 5 : 0) - (conflictingLabels ? 15 : 0)));

    const contradictions: string[] = [];
    if (edge.support === 1) contradictions.push("single-observation");
    if (edge.features.size === 1) contradictions.push("single-source");
    if (conflictingLabels) contradictions.push("label-conflict");

    return {
      ...edge,
      confidence,
      contradictions,
      strong: confidence >= 70 && edge.support >= 3 && edge.features.size >= 2 && contradictions.length === 0,
    };
  });

  const contradictionSet = new Set<string>();
  for (const edge of scoredEdges) {
    if (edge.contradictions.length > 0) {
      contradictionSet.add(
        `${edge.source} -> ${edge.target} (${edge.label}) flagged: ${edge.contradictions.join(", ")}`
      );
    }
  }
  const contradictions = Array.from(contradictionSet).slice(0, 8);

  const findings: string[] = [];
  findings.push(`Collected ${events.length} evidence events across ${featureCoverage.length} feature source(s): ${featureCoverage.join(", ") || "none"}.`);

  if (scoredEdges.length > 0) {
    const topEdge = scoredEdges[0];
    findings.push(
      `Top linkage: ${topEdge.source} -> ${topEdge.target} (${topEdge.label}) with confidence ${topEdge.confidence} backed by ${topEdge.support} supporting observation(s).`
    );
  }

  const strongEdgeCount = scoredEdges.filter((edge) => edge.strong).length;
  findings.push(`${strongEdgeCount} edge(s) qualify as strong under multi-source and repeated-observation criteria.`);

  const mostConnectedNodes = Array.from(nodeMap.entries())
    .sort((a, b) => b[1].support - a[1].support)
    .slice(0, 3)
    .map(([id, value]) => `${value.label || id} (${value.type}, support ${value.support})`);
  if (mostConnectedNodes.length > 0) {
    findings.push(`Most repeated nodes: ${mostConnectedNodes.join("; ")}.`);
  }

  const nextChecks: string[] = [];
  if (contradictions.length > 0) {
    nextChecks.push("Re-verify contradiction-flagged links with direct transaction-level proof before final attribution.");
  }
  if (!featureCoverage.includes("cluster")) {
    nextChecks.push("Run Cluster Entities to add entity-link evidence and reduce single-source dependence.");
  }
  if (!featureCoverage.includes("trace")) {
    nextChecks.push("Run Trace Funds on top suspect addresses to collect movement-level proof.");
  }
  if (!featureCoverage.includes("social")) {
    nextChecks.push("Run Social Investigation around high-confidence hops for off-chain corroboration.");
  }
  if (nextChecks.length === 0) {
    nextChecks.push("Export proof packs for high-confidence findings and prepare external verification package.");
  }

  const mermaid = [
    "flowchart LR",
    ...scoredEdges.slice(0, 120).map(
      (edge) =>
        `  ${edge.source.replace(/[^a-zA-Z0-9_]/g, "_")} -->|${`${edge.label} c:${edge.confidence}`.replace(/[^a-zA-Z0-9_ :]/g, "")}| ${edge.target.replace(/[^a-zA-Z0-9_]/g, "_")}`
    ),
  ].join("\n");

  const summary = `Case ${targetCase.title} has ${events.length} evidence events, ${scoredEdges.length} unique links, and ${strongEdgeCount} strong link(s) across ${featureCoverage.length} source feature(s).`;

  const investigatorConclusion =
    contradictions.length > 0
      ? "Evidence indicates actionable linkage signals, but some relationships remain provisional pending contradiction-focused verification."
      : "Evidence indicates consistent multi-source linkage patterns with no major contradiction flags in the current dataset.";

  const findingsSection = findings.map((item) => `- ${item}`).join("\n");
  const contradictionSection = contradictions.length > 0 ? contradictions.map((item) => `- ${item}`).join("\n") : "- None detected in current aggregation.";
  const nextChecksSection = nextChecks.map((item) => `- ${item}`).join("\n");

  const markdown = `# ${targetCase.title}\n\n## Investigation Summary\n${summary}\n\n## Target\n- Address: ${targetCase.targetAddress}\n- Chain: ${targetCase.chain}\n\n## Investigator Conclusion\n${investigatorConclusion}\n\n## Key Findings\n${findingsSection}\n\n## Contradictions To Verify\n${contradictionSection}\n\n## Recommended Next Checks\n${nextChecksSection}\n\n## Evidence Narrative\n${evidenceLines.length > 0 ? evidenceLines.join("\n") : "- No evidence events captured yet."}\n\n## Analyst Notes\n- This report was auto-assembled from saved feature outputs and weighted evidence aggregation.\n\n## Graph Diagram (Mermaid)\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`;

  return {
    markdown,
    mermaid,
    summary,
    investigatorConclusion,
    findings,
    contradictions,
    nextChecks,
    stats: {
      eventCount: events.length,
      nodeCount: nodeMap.size,
      edgeCount: scoredEdges.length,
      strongEdgeCount,
      contradictionCount: contradictions.length,
      featureCoverage,
    },
  };
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
