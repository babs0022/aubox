import { getUserFromSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";
import { AccessRequestStatus, listAccessRequestsForAdmin } from "@/lib/azure";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["pending", "code_generated", "approved", "rejected", "all"]).default("all"),
  search: z.string().trim().max(140).optional(),
});

const ensureAdmin = async () => {
  const user = await getUserFromSession();
  if (!user?.sub || !user.email || !isAdminEmail(user.email)) {
    return null;
  }

  return user;
};

export async function GET(request: NextRequest) {
  const actor = await ensureAdmin();
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = querySchema.safeParse({
    status: request.nextUrl.searchParams.get("status") || "all",
    search: request.nextUrl.searchParams.get("search") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.issues }, { status: 400 });
  }

  const result = await listAccessRequestsForAdmin({
    status: parsed.data.status as AccessRequestStatus | "all",
    search: parsed.data.search,
  });

  return NextResponse.json(
    {
      success: true,
      status: parsed.data.status,
      search: parsed.data.search || "",
      summary: result.summary,
      requests: result.requests,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
