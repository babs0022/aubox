import { isAdminEmail } from "@/lib/admins";
import { getUserFromSession } from "@/lib/auth";
import {
  approveAccessRequest,
  generateAccessCodeForRequest,
  getAccessRequestByIdForAdmin,
  isAuthError,
  rejectAccessRequest,
} from "@/lib/azure";
import { sendAccessApprovalEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate_code"),
    adminNotes: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal("approve_send"),
    adminNotes: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal("reject"),
    adminNotes: z.string().trim().max(1000).optional(),
  }),
]);

const ensureAdmin = async () => {
  const user = await getUserFromSession();
  if (!user?.sub || !user.email || !isAdminEmail(user.email)) {
    return null;
  }

  return user;
};

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const actor = await ensureAdmin();
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { requestId } = await context.params;
  const requestRecord = await getAccessRequestByIdForAdmin(requestId);
  if (!requestRecord) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  return NextResponse.json(
    { success: true, request: requestRecord },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const actor = await ensureAdmin();
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { requestId } = await context.params;

  try {
    const body = await request.json();
    const payload = actionSchema.parse(body);

    if (payload.action === "generate_code") {
      const updated = await generateAccessCodeForRequest(requestId, actor.sub, payload.adminNotes);
      return NextResponse.json({ success: true, request: updated, message: "Access code generated." });
    }

    const current = await getAccessRequestByIdForAdmin(requestId);
    if (!current) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (payload.action === "approve_send") {
      if (!current.generatedCode) {
        return NextResponse.json({ error: "Generate an access code before approval." }, { status: 400 });
      }

      await sendAccessApprovalEmail({
        toEmail: current.email,
        recipientName: current.fullName,
        accessCode: current.generatedCode,
      });

      const approved = await approveAccessRequest(
        requestId,
        actor.sub,
        new Date().toISOString(),
        payload.adminNotes
      );

      return NextResponse.json({
        success: true,
        request: approved,
        message: "Approval email sent and request marked approved.",
      });
    }

    const rejected = await rejectAccessRequest(requestId, actor.sub, payload.adminNotes);
    return NextResponse.json({ success: true, request: rejected, message: "Request rejected." });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to update access request" }, { status: 500 });
  }
}
