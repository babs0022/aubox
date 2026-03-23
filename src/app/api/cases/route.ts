import { createCase, listCases } from "@/lib/azure";
import { getUserFromSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createCaseSchema = z.object({
  title: z.string().trim().min(3).max(120),
  targetAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
  chain: z.enum(["ethereum", "bsc", "base", "arbitrum", "hyperliquid"]),
});

export async function GET() {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cases = await listCases(user.sub);
  return NextResponse.json({ cases });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = createCaseSchema.parse(body);
    const created = await createCase(user.sub, payload);
    return NextResponse.json({ success: true, case: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create case" }, { status: 500 });
  }
}
