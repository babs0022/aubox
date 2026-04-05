import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromSession } from "@/lib/auth";
import { updateFeedbackStatus, FeedbackStatus } from "@/lib/azure";
import { isAdminEmail } from "@/lib/admins";

const updateSchema = z.object({
  status: z.enum(["new", "in_review", "resolved", "dismissed"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ feedbackId: string }> }
) {
  try {
    const { feedbackId } = await params;
    
    const user = await getUserFromSession();
    if (!user?.sub || !user.email || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!feedbackId) {
      return NextResponse.json({ error: "Feedback ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const feedback = await updateFeedbackStatus(feedbackId, parsed.data.status as FeedbackStatus);

    return NextResponse.json({
      success: true,
      feedback,
      message: `Feedback status updated to ${parsed.data.status}`,
    });
  } catch (error: any) {
    if (error.status === 404) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    console.error("Error updating feedback status:", error);
    return NextResponse.json(
      { error: "Failed to update feedback status" },
      { status: 500 }
    );
  }
}
