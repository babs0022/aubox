import { getUserFromSession } from "@/lib/auth";
import { getAsyncJob } from "@/lib/azure";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await context.params;
    const job = await getAsyncJob(user.sub, jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error("Get job API error:", error);
    return NextResponse.json({ error: "Failed to fetch job status" }, { status: 500 });
  }
}
