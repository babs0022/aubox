import { getUserById, isAuthError, updateUserProfile } from "@/lib/azure";
import { createToken, getUserFromSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const userProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .optional(),
  name: z.string().trim().max(100).optional(),
  // Allow blank input from form; validate URL only when value is provided.
  profileIcon: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value))
    .refine((value) => value === undefined || /^https?:\/\//i.test(value), {
      message: "profileIcon must be a valid http/https URL",
    }),
});

// GET /api/profile/user - Fetch current user profile
export async function GET(request: NextRequest) {
  try {
    void request;
    const user = await getUserFromSession();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stored = await getUserById(user.sub);
    return NextResponse.json({
      id: user.sub,
      email: user.email,
      username: stored?.username || user.username || "",
      name: stored?.name || user.name || "",
      profileIcon: stored?.profileIcon || "",
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

// PUT /api/profile/user - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { username, name, profileIcon } = userProfileSchema.parse(body);

    const updatedUser = await updateUserProfile(user.sub, {
      username,
      name: name || "",
      profileIcon: profileIcon || "",
    });

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const token = await createToken(
      updatedUser.id,
      updatedUser.email,
      updatedUser.username,
      updatedUser.name
    );

    const response = NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      name: updatedUser.name || "",
      profileIcon: updatedUser.profileIcon || "",
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
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
