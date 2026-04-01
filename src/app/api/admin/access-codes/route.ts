import { getUserFromSession } from "@/lib/auth";
import {
  createAccessCode,
  isAuthError,
  listAccessCodeCreatorStats,
  listAccessCodes,
  listUsersWithInviteGrants,
  setUserInviteGrantByEmail,
} from "@/lib/azure";
import { isAdminEmail } from "@/lib/admins";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  code: z.string().trim().min(4).max(64).optional(),
  maxUses: z.number().int().min(1).max(10000).optional(),
  expiresAt: z.string().datetime().optional(),
  delegateUserEmail: z.string().email().optional(),
  grantLimit: z.number().int().min(0).max(100000).optional(),
  grantCycleDays: z.number().int().min(1).max(365).optional(),
});

const ensureAdmin = async () => {
  const user = await getUserFromSession();
  if (!user?.sub || !user.email || !isAdminEmail(user.email)) {
    return null;
  }
  return user;
};

export async function GET(request: NextRequest) {
  const user = await ensureAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const windowParam = request.nextUrl.searchParams.get("windowDays") || "30";
  const windowDays = windowParam === "all" ? undefined : Number(windowParam);
  const safeWindowDays = windowDays && Number.isFinite(windowDays) && windowDays > 0 ? windowDays : undefined;

  const [codes, creatorStats, grantUsers] = await Promise.all([
    listAccessCodes({ includeInactive: true }),
    listAccessCodeCreatorStats({ windowDays: safeWindowDays }),
    listUsersWithInviteGrants(),
  ]);

  return NextResponse.json({
    success: true,
    windowDays: safeWindowDays ?? "all",
    codes,
    creatorStats,
    grantUsers,
    summary: {
      totalCodes: codes.length,
      activeCodes: codes.filter((item) => item.isActive).length,
      totalUses: codes.reduce((sum, item) => sum + item.usedCount, 0),
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await ensureAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = createSchema.parse(body);

    if (payload.delegateUserEmail) {
      const updatedGrant = await setUserInviteGrantByEmail(
        payload.delegateUserEmail,
        payload.grantLimit ?? 0,
        payload.grantCycleDays
      );
      return NextResponse.json({ success: true, inviteGrant: updatedGrant });
    }

    if (!payload.code) {
      return NextResponse.json({ error: "Code is required when creating an access code" }, { status: 400 });
    }

    const created = await createAccessCode(
      payload.code.toLowerCase(),
      user.sub,
      payload.maxUses ?? 100,
      payload.expiresAt
    );

    return NextResponse.json({ success: true, code: created });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create access code" }, { status: 500 });
  }
}
