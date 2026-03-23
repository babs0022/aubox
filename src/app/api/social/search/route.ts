import { getUserFromSession } from "@/lib/auth";
import { deSearchMentionsAdvancedWithDiagnostics } from "@/lib/datasources";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const socialSearchSchema = z.object({
  query: z.string().trim().max(500).optional(),
  entities: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  hashtags: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  tickers: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  usernames: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  user: z.string().trim().min(1).max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  limit: z.number().min(1).max(50).optional(),
  sort: z.enum(["Top", "Latest"]).optional(),
});

const normalizeArray = (values: string[] | undefined, prefix = ""): string[] => {
  if (!values) return [];
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (prefix && !value.startsWith(prefix) ? `${prefix}${value}` : value));
};

export async function POST(request: NextRequest) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = socialSearchSchema.parse(await request.json());

    const usernames = Array.from(new Set([...normalizeArray(payload.usernames, "@"), ...normalizeArray(payload.user ? [payload.user] : [], "@")]));

    const parts = [
      payload.query?.trim() || "",
      ...normalizeArray(payload.entities),
      ...normalizeArray(payload.tags),
      ...normalizeArray(payload.hashtags, "#"),
      ...normalizeArray(payload.tickers, "$"),
      ...usernames,
    ].filter((part) => part.length > 0);

    if (parts.length === 0) {
      return NextResponse.json({
        results: [],
        compiledQuery: "",
        count: 0,
        diagnostics: {
          strategy: "empty",
          selectedRoute: null,
          attempts: [],
        },
      });
    }

    const compiledQuery = parts.join(" ");
    const limit = payload.limit || 20;
    const sort = payload.sort || "Top";
    const { rows, diagnostics } = await deSearchMentionsAdvancedWithDiagnostics(compiledQuery, limit, usernames, sort);

    return NextResponse.json({
      compiledQuery,
      results: rows,
      count: rows.length,
      diagnostics,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to run social search" }, { status: 500 });
  }
}
