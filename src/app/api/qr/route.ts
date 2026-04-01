import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const data = request.nextUrl.searchParams.get("data") || "https://aubox.app";
  const size = Number(request.nextUrl.searchParams.get("size") || 220);
  const safeSize = Number.isFinite(size) ? Math.max(120, Math.min(600, size)) : 220;

  const upstream = `https://api.qrserver.com/v1/create-qr-code/?size=${safeSize}x${safeSize}&data=${encodeURIComponent(data)}`;

  try {
    const response = await fetch(upstream, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to generate QR" }, { status: 502 });
    }

    const bytes = await response.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate QR" }, { status: 500 });
  }
}
