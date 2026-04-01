import { getUserFromSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";
import { listUsersForAdmin } from "@/lib/azure";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  window: z.enum(["24h", "7d", "30d", "90d", "all"]).default("30d"),
  search: z.string().trim().max(120).optional(),
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

const csvEscape = (value: string): string => {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

  const result = await listUsersForAdmin({
    search: parsed.data.search,
    activeWithinHours: resolveWindowHours(parsed.data.window),
  });

  const lines = [
    ["uid", "email", "signed_up_at", "last_login_at", "onboarding_completed", "access_granted"].join(","),
    ...result.users.map((user) =>
      [
        csvEscape(user.id),
        csvEscape(user.email),
        csvEscape(user.createdAt || ""),
        csvEscape(user.lastLoginAt || ""),
        csvEscape(String(user.onboardingCompleted)),
        csvEscape(String(user.accessGranted)),
      ].join(",")
    ),
  ];

  const filename = `aubox-users-${parsed.data.window}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
}
