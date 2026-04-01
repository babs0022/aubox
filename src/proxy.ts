import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-min-32-chars");

const verifyTokenClaims = async (token: string) => {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as {
      accessGranted?: boolean;
      onboardingCompleted?: boolean;
    };
  } catch {
    return null;
  }
};

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("aubox_token")?.value;
  const { pathname } = request.nextUrl;

  const isPublicPath =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname === "/guide" ||
    pathname.startsWith("/onboarding");

  const isApiPath = pathname.startsWith("/api");
  const isAssetPath = pathname.startsWith("/_next") || pathname === "/icon.png";

  const isProtectedPath =
    pathname === "/cases" ||
    pathname.startsWith("/cases/") ||
    pathname === "/profile" ||
    pathname.startsWith("/dashboard");

  if (!token && isProtectedPath && !isPublicPath && !isApiPath && !isAssetPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isProtectedPath) {
    const claims = await verifyTokenClaims(token);
    if (!claims) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (!claims.accessGranted) {
      return NextResponse.redirect(new URL("/onboarding/access-code", request.url));
    }

    if (!claims.onboardingCompleted) {
      return NextResponse.redirect(new URL("/onboarding/welcome", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
