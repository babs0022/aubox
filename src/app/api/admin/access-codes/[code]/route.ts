import { getUserFromSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admins";
import { isAuthError, setAccessCodeActive } from "@/lib/azure";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const user = await getUserFromSession();
  if (!user?.email || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = patchSchema.parse(body);
    const { code } = await context.params;

    const updated = await setAccessCodeActive(code, payload.isActive);
    return NextResponse.json({ success: true, code: updated });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to update code" }, { status: 500 });
  }
}
