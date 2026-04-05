import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromSession } from "@/lib/auth";
import { createFeedback, FeedbackType } from "@/lib/azure";

const feedbackSchema = z.object({
  type: z.enum(["feature_request", "bug_report"] as const).describe("Type of feedback"),
  title: z.string().trim().min(5).max(100).describe("Feedback title"),
  description: z.string().trim().min(10).max(2000).describe("Detailed description"),
  category: z.string().trim().min(2).max(50).describe("Category or classification"),
});

type FeedbackPayload = z.infer<typeof feedbackSchema>;

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();
    if (!user?.sub || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const payload = feedbackSchema.parse(body) as FeedbackPayload;

    const feedback = await createFeedback(
      user.sub,
      user.email,
      payload.type as FeedbackType,
      payload.title,
      payload.description,
      payload.category
    );

    return NextResponse.json(
      {
        success: true,
        feedback,
        message: "Thank you for your feedback! Our team will review it soon.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid feedback data",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error("Error creating feedback:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
