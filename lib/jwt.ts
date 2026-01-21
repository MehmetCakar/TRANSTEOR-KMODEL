// lib/jwt.ts
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export function issueJWT(email: string, ttlMs: number, role?: "USER" | "ADMIN") {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + Math.floor(ttlMs / 1000);
  const payload: jwt.JwtPayload = { sub: email, role, iat: nowSec, exp: expSec };
  return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
}

// ✅ SADECE STRING
export function parseJWT(token: string): string {
  const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  if (typeof decoded.sub === "string" && decoded.sub) return decoded.sub;
  throw new Error("bad token");
}

// ✅ ROLE LAZIMSA AYRI FONKSIYON
export function parseJWTWithRole(token: string): { email: string; role?: "USER" | "ADMIN" } {
  const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  const email = typeof decoded.sub === "string" ? decoded.sub : "";
  if (!email) throw new Error("bad token");
  const role = typeof (decoded as any).role === "string" ? (decoded as any).role : undefined;
  return { email, role: role as any };
}