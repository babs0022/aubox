import { getUserFromSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";
import { deleteUserForAdmin, getUserById, isAuthError, listUsersForAdmin } from "@/lib/azure";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  window: z.enum(["24h", "7d", "30d", "90d", "all"]).default("30d"),
  search: z.string().trim().max(120).optional(),
});

const deleteSchema = z.object({
  userId: z.string().uuid(),
});

const ensureAdmin = async () => {
  const user = await getUserFromSession();
  if (!user?.sub || !user.email || !isAdminEmail(user.email)) {
    return null;
  }
  return user;
};

const resolveWindowHours = (window: "24h" | "7d" | "30d" | "90d" | "all") => {
  if (window === "24h") return 24;
  if (window === "7d") return 7 * 24;
  if (window === "30d") return 30 * 24;
  if (window === "90d") return 90 * 24;
  return undefined;
};

export async function GET(request: NextRequest) {
  const actor = await ensureAdmin();
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = querySchema.safeParse({
    window: request.nextUrl.searchParams.get("window") || "30d",
    search: request.nextUrl.searchParams.get("search") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.issues }, { status: 400 });
  }

  const activeWithinHours = resolveWindowHours(parsed.data.window);
  const [overall, filtered] = await Promise.all([
    listUsersForAdmin({ activeWithinHours }),
    listUsersForAdmin({
      search: parsed.data.search,
      activeWithinHours,
    }),
  ]);

  return NextResponse.json({
    success: true,
    window: parsed.data.window,
    search: parsed.data.search || "",
    summary: {
      totalUsers: overall.totalUsers,
      activeUsers: overall.activeUsers,
    },
    users: filtered.users,
  });
}

export async function DELETE(request: NextRequest) {
  const actor = await ensureAdmin();
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = deleteSchema.parse(body);

    if (payload.userId === actor.sub) {
      return NextResponse.json({ error: "You cannot delete your current account." }, { status: 400 });
    }

    const targetUser = await getUserById(payload.userId);
    if (targetUser?.email && isAdminEmail(targetUser.email)) {
      return NextResponse.json({ error: "Cannot delete an admin account." }, { status: 400 });
    }

    const result = await deleteUserForAdmin(payload.userId);
    return NextResponse.json({ success: true, deleted: result });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
