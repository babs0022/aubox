import { getUserFromSession } from "@/lib/auth";
import { executeTraceWorkflow } from "@/lib/investigation-workflow";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const traceRequestSchema = z.object({
  sourceAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chain: z.enum(["ethereum", "bsc", "base", "arbitrum", "hyperliquid"]),
  depth: z.number().min(1).max(5).default(2),
  direction: z.enum(["inbound", "outbound", "both"]).default("outbound"),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sourceAddress, chain, depth, direction } = traceRequestSchema.parse(body);

    const workflowResult = await executeTraceWorkflow(sourceAddress, chain, depth, direction);

    return NextResponse.json(
      workflowResult,
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issueText = error.issues.map((issue) => issue.message).join("; ");
      return NextResponse.json({ error: issueText || "Invalid trace request" }, { status: 400 });
    }

    console.error("Trace API error:", error);
    return NextResponse.json({ error: "Failed to trace funds" }, { status: 500 });
  }
}
