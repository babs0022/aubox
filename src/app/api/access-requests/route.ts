import { createAccessRequest, findPendingAccessRequestByEmail, isAuthError } from "@/lib/azure";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  organization: z.string().trim().min(2).max(120),
  ecosystemRole: z.string().trim().min(2).max(80),
  ecosystemRoleOther: z.string().trim().max(120).optional(),
  primaryUseCase: z.string().trim().min(2).max(140),
  expectations: z.string().trim().min(10).max(1500),
  telegramOrDiscord: z.string().trim().max(120).optional(),
  websiteOrLinkedIn: z.string().trim().max(200).optional(),
  region: z.string().trim().max(120).optional(),
  xHandle: z.string().trim().max(120).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = requestSchema.parse(body);

    const existingPending = await findPendingAccessRequestByEmail(payload.email);
    if (existingPending) {
      return NextResponse.json(
        {
          success: true,
          request: existingPending,
          alreadyPending: true,
          message: "A pending request already exists for this email.",
        },
        { status: 200 }
      );
    }

    const created = await createAccessRequest(payload);
    return NextResponse.json(
      {
        success: true,
        request: created,
        alreadyPending: false,
        message: "Request submitted. We will review it and get back to you by email.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to submit access request" }, { status: 500 });
  }
}
