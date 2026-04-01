import { isAdminEmail } from "@/lib/admins";
import { createToken, getUserFromSession } from "@/lib/auth";
import { completeOnboarding, isAuthError } from "@/lib/azure";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const onboardingSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  profileIcon: z.string().trim().min(1),
  howHeardAboutUs: z.string().trim().min(2).max(120),
  roleStatus: z.string().trim().min(2).max(120),
  teamSize: z.string().trim().max(80).optional(),
  useCase: z.string().trim().max(160).optional(),
  region: z.string().trim().max(80).optional(),
});

export async function POST(request: NextRequest) {
  const sessionUser = await getUserFromSession();
  if (!sessionUser?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = onboardingSchema.parse(body);

    const updated = await completeOnboarding(sessionUser.sub, payload);

    const token = await createToken(
      updated.id,
      updated.email,
      updated.username,
      updated.name,
      true,
      true,
      isAdminEmail(updated.email)
    );

    const response = NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        profileIcon: updated.profileIcon,
        userSequenceNumber: updated.userSequenceNumber,
        accessGranted: true,
        onboardingCompleted: true,
      },
      message: "Onboarding completed.",
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
