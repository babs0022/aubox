import { addCaseEvent, listCaseEvents } from "@/lib/azure";
import { getUserFromSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const eventSchema = z.object({
  feature: z.enum(["profile", "trace", "cluster", "timeline", "report", "social", "token"]),
  title: z.string().trim().min(3).max(140),
  narrative: z.string().trim().min(8).max(6000),
  metrics: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        type: z.string().min(1),
      })
    )
    .optional(),
  edges: z
    .array(
      z.object({
        source: z.string().min(1),
        target: z.string().min(1),
        label: z.string().optional(),
      })
    )
    .optional(),
});

type RouteParams = {
  params: Promise<{ caseId: string }>;
};

export async function GET(_: NextRequest, context: RouteParams) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { caseId } = await context.params;
  const events = await listCaseEvents(user.sub, caseId);
  return NextResponse.json({ events });
}

export async function POST(request: NextRequest, context: RouteParams) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { caseId } = await context.params;
    const body = await request.json();
    const payload = eventSchema.parse(body);
    const event = await addCaseEvent(user.sub, caseId, payload);
    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save case event" }, { status: 500 });
  }
}
