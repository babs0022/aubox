import { requestPasswordReset } from "@/lib/azure";
import { isAuthError } from "@/lib/azure";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    const resetToken = await requestPasswordReset(email);

    return NextResponse.json(
      {
        success: true,
        message: "If email exists, reset link will be sent",
        // In development, return the token directly. In production, send via email
        resetToken: process.env.NODE_ENV === "development" ? resetToken : undefined,
      },
      { status: 200 }
    );
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
