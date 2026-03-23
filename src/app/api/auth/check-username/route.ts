import { checkUsernameAvailability } from "@/lib/azure";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

    return NextResponse.json(
      {
        username,
        available,
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
