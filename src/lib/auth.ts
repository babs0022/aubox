import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-min-32-chars");

export interface AuthToken {
  sub: string;
  email: string;
  username?: string;
  name?: string;
  iat: number;
  exp: number;
}

export const createToken = async (
  sub: string,
  email: string,
  username?: string,
  name?: string
): Promise<string> => {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 24 * 60 * 60; // 24 hours

  const token = await new SignJWT({ sub, email, username, name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(JWT_SECRET);

  return token;
};

export const verifyToken = async (token: string): Promise<AuthToken | null> => {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as unknown as AuthToken;
  } catch {
    return null;
  }
};

export const getUserFromSession = async (): Promise<AuthToken | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get("aubox_token")?.value;

  if (!token) return null;
  return verifyToken(token);
};
