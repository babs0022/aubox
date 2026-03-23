import { isAuthError, signInUser, signUpUser } from "@/lib/azure";
import { createToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  action: z.enum(["signup", "signin"]),
  name: z.string().trim().min(2).max(80).optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, action, name, username } = authSchema.parse(body);

    let result;

    if (action === "signup") {
      if (!username) {
        return NextResponse.json({ error: "Username is required for signup" }, { status: 400 });
      }
      result = await signUpUser(email, password, username, name);
    } else {
      result = await signInUser(email, password);
    }

    if (!result) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    const token = await createToken(result.id, result.email, result.username, result.name);

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: result.id,
          email: result.email,
          username: result.username,
          name: result.name || null,
        },
        message: action === "signup" ? "User created. Please verify email." : "Signed in successfully.",
      },
      { status: 200 }
    );

    // Set secure HTTP-only cookie
    response.cookies.set("aubox_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
