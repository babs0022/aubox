import { isAdminEmail } from "@/lib/admins";
import { isAuthError, signInUser, signUpUser } from "@/lib/azure";
import { createToken } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  action: z.enum(["signup", "signin"]),
  name: z.string().trim().min(2).max(80).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, action, name } = authSchema.parse(body);

    let result;

    if (action === "signup") {
      result = await signUpUser(email, password, name);
      void sendWelcomeEmail({
        toEmail: result.email,
        recipientName: name || result.name || result.username || undefined,
      }).catch((error) => {
        console.error("Welcome email error", error);
      });
    } else {
      result = await signInUser(email, password);
      const isAdmin = isAdminEmail(result.email);
      if (!result.accessGranted && !isAdmin) {
        return NextResponse.json(
          {
            requiresAccessCode: true,
            message: "Access code verification required before dashboard access.",
          },
          { status: 403 }
        );
      }
    }

    if (!result) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    const isAdmin = isAdminEmail(result.email);
    const effectiveAccessGranted = Boolean(result.accessGranted) || isAdmin;
    const effectiveOnboardingCompleted = Boolean(result.onboardingCompleted) || isAdmin;

    const token = await createToken(
      result.id,
      result.email,
      result.username,
      result.name,
      effectiveAccessGranted,
      effectiveOnboardingCompleted,
      isAdmin
    );

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: result.id,
          email: result.email,
          username: result.username || null,
          name: result.name || null,
          accessGranted: effectiveAccessGranted,
          onboardingCompleted: effectiveOnboardingCompleted,
          onboardingStep: effectiveOnboardingCompleted ? "done" : result.onboardingStep || "access_code",
          isAdmin,
        },
        message:
          action === "signup"
            ? "Account created. Verify your access code to continue onboarding."
            : "Signed in successfully.",
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
