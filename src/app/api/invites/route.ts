import { getUserFromSession } from "@/lib/auth";
import {
  createAccessCode,
  getInviteGrantSummary,
  isAuthError,
  listAccessCodes,
  releaseInviteGrantCapacity,
  reserveInviteGrantCapacity,
} from "@/lib/azure";
import { isAdminEmail } from "@/lib/admins";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const createInviteSchema = z.object({
  code: z.string().trim().min(4).max(64).optional(),
  maxUses: z.number().int().min(1).max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

const generateInviteCode = () => {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
  return `aubx-${suffix}`;
};

export async function GET() {
  const user = await getUserFromSession();
  if (!user?.sub || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = isAdminEmail(user.email);

  const codes = await listAccessCodes({
    createdByUserId: user.sub,
    includeInactive: true,
  });

  const totalCodes = codes.length;
  const totalUses = codes.reduce((sum, item) => sum + item.usedCount, 0);
  const conversionRate = totalCodes > 0 ? Number(((totalUses / totalCodes) * 100).toFixed(1)) : 0;

  const grant = admin
    ? null
    : await getInviteGrantSummary(user.sub).catch(() => ({
        limit: 0,
        used: 0,
        remaining: 0,
        cycleDays: 30,
        cycleStartedAt: new Date().toISOString(),
        nextResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }));

  const summary = {
    totalCodes,
    activeCodes: codes.filter((item) => item.isActive).length,
    totalUses,
    remainingUses: codes.reduce((sum, item) => sum + Math.max(item.maxUses - item.usedCount, 0), 0),
    successfulSignups: totalUses,
    conversionRate,
  };

  return NextResponse.json({
    success: true,
    isAdmin: admin,
    grant,
    codes,
    summary,
  });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromSession();
  if (!user?.sub || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = createInviteSchema.parse(body);
    const admin = isAdminEmail(user.email);

    const requestedUses = payload.maxUses ?? 5;
    const maxUses = admin ? requestedUses : Math.min(requestedUses, 25);
    const code = (payload.code || generateInviteCode()).toLowerCase();

    if (!admin) {
      await reserveInviteGrantCapacity(user.sub, maxUses);
    }

    let created;
    try {
      created = await createAccessCode(code, user.sub, maxUses, payload.expiresAt);
    } catch (error) {
      if (!admin) {
        await releaseInviteGrantCapacity(user.sub, maxUses).catch(() => {
          // Ignore rollback failures to preserve original creation error.
        });
      }
      throw error;
    }

    const grant = admin ? null : await getInviteGrantSummary(user.sub).catch(() => null);

    return NextResponse.json({
      success: true,
      code: created,
      grant,
      message: "Invite code created",
    });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create invite code" }, { status: 500 });
  }
}
