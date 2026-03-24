import { getUserFromSession } from "@/lib/auth";
import { analyzeTokenMovement } from "@/lib/datasources";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const tokenMovementSchema = z.object({
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chain: z.enum(["ethereum", "bsc", "base", "arbitrum", "hyperliquid"]),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  lookbackBlocks: z.number().min(500).max(20000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tokenAddress, chain, walletAddress, lookbackBlocks } = tokenMovementSchema.parse(body);

    const intel = await analyzeTokenMovement(tokenAddress, chain, walletAddress, lookbackBlocks || 4000);
    if (!intel) {
      return NextResponse.json({ error: "Unable to analyze token movement" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      intel,
      message: "Token movement analysis complete.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error("Token movement API error:", error);
    return NextResponse.json({ error: "Failed to analyze token movement" }, { status: 500 });
  }
}
