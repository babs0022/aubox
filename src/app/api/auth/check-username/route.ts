import { checkUsernameAvailability } from "@/lib/azure";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const buildUsernameCandidates = (baseInput: string): string[] => {
  const normalized = baseInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const compact = normalized.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  const seed = compact || "investigator";
  const year = new Date().getFullYear();
  const shortSeed = seed.slice(0, 18);

  const candidates = [
    `${shortSeed}_${Math.floor(Math.random() * 90) + 10}`,
    `${shortSeed}${year}`,
    `${shortSeed}_${(Date.now() % 10000).toString().padStart(4, "0")}`,
    `${shortSeed}_aubox`,
    `${shortSeed}_onchain`,
    `${shortSeed}_${Math.floor(Math.random() * 900) + 100}`,
    `${shortSeed.slice(0, 12)}_${Math.floor(Math.random() * 9000) + 1000}`,
  ];

  return Array.from(new Set(candidates))
    .map((item) => item.slice(0, 24))
    .filter((item) => item.length >= 3 && /^[a-zA-Z0-9_]+$/.test(item));
};

const getAvailableSuggestions = async (baseInput: string, limit = 4): Promise<string[]> => {
  const candidates = buildUsernameCandidates(baseInput);
  const suggestions: string[] = [];

  for (const candidate of candidates) {
    if (suggestions.length >= limit) break;
    const available = await checkUsernameAvailability(candidate);
    if (available) {
      suggestions.push(candidate);
    }
  }

  return suggestions;
};

const checkSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = checkSchema.parse(body);

    const available = await checkUsernameAvailability(username);
    const suggestions = available ? [] : await getAvailableSuggestions(username);

    return NextResponse.json(
      {
        username,
        available,
        suggestions,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid username format", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
