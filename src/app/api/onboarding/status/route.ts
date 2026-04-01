import { getUserFromSession } from "@/lib/auth";
import { getUserById } from "@/lib/azure";
import { NextResponse } from "next/server";

export async function GET() {
  const sessionUser = await getUserFromSession();
  if (!sessionUser?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(sessionUser.sub);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      username: user.username || null,
      profileIcon: user.profileIcon || null,
      accessGranted: Boolean(user.accessGranted),
      onboardingCompleted: Boolean(user.onboardingCompleted),
      onboardingStep: user.onboardingStep || "access_code",
      userSequenceNumber: user.userSequenceNumber || null,
    },
  });
}
