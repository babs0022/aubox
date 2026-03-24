import { getUserFromSession } from "@/lib/auth";
import { deleteCaseArtifact, listCaseArtifacts, updateCaseArtifact, upsertCaseArtifact } from "@/lib/azure";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const artifactSchema = z.object({
  tag: z.string().trim().min(1).max(64).optional(),
  value: z.string().trim().min(1).max(512),
  kind: z.enum(["address", "entity", "hashtag", "ticker", "username", "query", "note"]),
  sourceFeature: z.enum(["trace", "cluster", "social", "profile", "timeline", "report", "manual", "token"]),
  aliases: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

const artifactUpdateSchema = z.object({
  id: z.string().trim().min(1).max(120),
  tag: z.string().trim().min(1).max(64).optional(),
  aliases: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

type RouteParams = {
  params: Promise<{ caseId: string }>;
};

export async function GET(request: NextRequest, context: RouteParams) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { caseId } = await context.params;
    const query = request.nextUrl.searchParams.get("q") || "";
    const limit = Math.max(1, Math.min(100, Number.parseInt(request.nextUrl.searchParams.get("limit") || "20", 10) || 20));
    const artifacts = await listCaseArtifacts(user.sub, caseId, query);

    return NextResponse.json({ artifacts: artifacts.slice(0, limit) });
  } catch {
    return NextResponse.json({ error: "Failed to load case artifacts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { caseId } = await context.params;
    const payload = artifactSchema.parse(await request.json());
    const artifact = await upsertCaseArtifact(user.sub, caseId, payload);
    return NextResponse.json({ success: true, artifact }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save case artifact" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { caseId } = await context.params;
    const payload = artifactUpdateSchema.parse(await request.json());
    const artifact = await updateCaseArtifact(user.sub, caseId, payload.id, {
      tag: payload.tag,
      aliases: payload.aliases,
      metadata: payload.metadata,
    });
    return NextResponse.json({ success: true, artifact });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    if (error instanceof Error && /not found/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update case artifact" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { caseId } = await context.params;
    const id = request.nextUrl.searchParams.get("id") || "";
    if (!id.trim()) {
      return NextResponse.json({ error: "Artifact id is required" }, { status: 400 });
    }

    await deleteCaseArtifact(user.sub, caseId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete case artifact" }, { status: 500 });
  }
}
