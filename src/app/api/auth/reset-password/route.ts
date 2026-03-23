import { resetPassword } from "@/lib/azure";
import { isAuthError } from "@/lib/azure";
import { createToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);

    const user = await resetPassword(token, password);

    // Issue new JWT token after password reset
    const jwtToken = await createToken(user.id, user.email, user.username, user.name);

    const response = NextResponse.json(
      {
        success: true,
        message: "Password reset successfully",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name || null,
        },
      },
      { status: 200 }
    );

    // Set secure HTTP-only cookie
    response.cookies.set("aubox_token", jwtToken, {
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
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
