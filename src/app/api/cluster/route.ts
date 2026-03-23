import { getUserFromSession } from "@/lib/auth";
import { executeClusterWorkflow } from "@/lib/investigation-workflow";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const clusterRequestSchema = z.object({
  seedAddresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).min(1).max(10),
  chain: z.enum(["ethereum", "bsc", "base", "arbitrum", "hyperliquid"]).default("ethereum"),
  strictness: z.enum(["conservative", "balanced", "aggressive"]).default("balanced"),
  timeWindow: z.enum(["7d", "30d", "90d", "180d", "365d"]).default("30d"),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const user = await getUserFromSession();
    if (!user) {
      console.warn("[cluster-api] unauthorized", { requestId });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { seedAddresses, chain, strictness, timeWindow } = clusterRequestSchema.parse(body);

    console.log("[cluster-api] request_received", {
      requestId,
      userId: user.sub,
      seedCount: seedAddresses.length,
      chain,
      strictness,
      timeWindow,
    });

    const workflowResult = await executeClusterWorkflow(seedAddresses, chain, strictness, timeWindow, {
      requestId,
      enableDebugLogs: true,
    });

    console.log("[cluster-api] request_completed", {
      requestId,
      durationMs: Date.now() - startedAt,
      clusterCount: workflowResult.clusters.length,
      workflowRequestId: workflowResult.requestId,
      minEdgeConfidence: workflowResult.thresholds.minEdgeConfidence,
    });

    return NextResponse.json(
      workflowResult,
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn("[cluster-api] validation_failed", {
        requestId,
        durationMs: Date.now() - startedAt,
        issues: error.issues,
      });
      return NextResponse.json({ error: error.issues, requestId }, { status: 400 });
    }

    console.error("[cluster-api] request_failed", {
      requestId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Failed to cluster entities", requestId }, { status: 500 });
  }
}
