import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromSession } from "@/lib/auth";
import { listFeedbackForAdmin, FeedbackType, FeedbackStatus } from "@/lib/azure";
import { isAdminEmail } from "@/lib/admins";

const querySchema = z.object({
  type: z.enum(["feature_request", "bug_report"]).optional(),
  status: z.enum(["new", "in_review", "resolved", "dismissed", "all"]).optional().default("all"),
  search: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession();
    if (!user?.sub || !user.email || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = querySchema.safeParse({
      type: request.nextUrl.searchParams.get("type") || undefined,
      status: request.nextUrl.searchParams.get("status") || "all",
      search: request.nextUrl.searchParams.get("search") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const result = await listFeedbackForAdmin({
      type: parsed.data.type as FeedbackType | undefined,
      status: (parsed.data.status as FeedbackStatus | "all") || "all",
      search: parsed.data.search,
    });

    // Set cache headers for admin data
    const response = NextResponse.json({
      success: true,
      type: parsed.data.type || null,
      status: parsed.data.status || "all",
      search: parsed.data.search || "",
      summary: result.summary,
      feedback: result.feedback,
    });

    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}
