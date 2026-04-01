import { isAdminEmail } from "@/lib/admins";
import { createToken, getUserFromSession } from "@/lib/auth";
import { isAuthError, redeemAccessCodeForUser } from "@/lib/azure";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const redeemSchema = z.object({
  code: z.string().trim().min(3).max(64),
});

export async function POST(request: NextRequest) {
  const sessionUser = await getUserFromSession();
  if (!sessionUser?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { code } = redeemSchema.parse(body);

    const updated = await redeemAccessCodeForUser(sessionUser.sub, code);

    const token = await createToken(
      updated.id,
      updated.email,
      updated.username,
      updated.name,
      true,
      Boolean(updated.onboardingCompleted),
      isAdminEmail(updated.email)
    );

    const response = NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username || null,
        accessGranted: true,
        onboardingCompleted: Boolean(updated.onboardingCompleted),
        onboardingStep: updated.onboardingStep || "profile",
      },
      message: "Access code verified. Continue onboarding.",
    });

    response.cookies.set("aubox_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
