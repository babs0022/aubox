import { enqueueJob } from "@/lib/azure";
import { getUserFromSession } from "@/lib/auth";
import { buildWalletProfile } from "@/lib/datasources";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const profileRequestSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chain: z.enum(["ethereum", "bsc", "base", "arbitrum", "hyperliquid"]),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { address, chain } = profileRequestSchema.parse(body);

    // Build wallet profile from integrated data sources
    const profile = await buildWalletProfile(address, chain);

    // Optionally enqueue for deeper/async analysis
    if (process.env.AZURE_SERVICE_BUS_QUEUE_PROFILE) {
      await enqueueJob(process.env.AZURE_SERVICE_BUS_QUEUE_PROFILE, {
        address,
        chain,
        userId: user.sub,
        timestamp: Date.now(),
      }).catch((err) => {
        const message = err instanceof Error ? err.message : "Unknown queue error";
        console.warn(`Queue enqueue skipped for profile job: ${message}`);
      });
    }

    return NextResponse.json(
      {
        success: true,
        profile,
        message: "Profile built from Arkham enrichment and chain RPC sources.",
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error("Profile API error:", error);
    return NextResponse.json({ error: "Failed to build profile" }, { status: 500 });
  }
}
