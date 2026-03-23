import { buildCaseReportPack, isAuthError } from "@/lib/azure";
import { getUserFromSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{ caseId: string }>;
};

export async function GET(_: NextRequest, context: RouteParams) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { caseId } = await context.params;
    const pack = await buildCaseReportPack(user.sub, caseId);
    return NextResponse.json({ success: true, pack });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to build report pack" }, { status: 500 });
  }
}
