import { dexscreenerTokenRisk } from "@/lib/datasources";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenAddress, chain } = body;

    if (!tokenAddress || !chain) {
      return NextResponse.json(
        { error: "Missing tokenAddress or chain" },
        { status: 400 }
      );
    }

    const riskInfo = await dexscreenerTokenRisk(tokenAddress, chain);

    return NextResponse.json(riskInfo);
  } catch (error) {
    console.error("Token risk fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch token risk" },
      { status: 500 }
    );
  }
}
