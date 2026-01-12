import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export function issueJWT(email: string, ttlMs: number) {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + Math.floor(ttlMs / 1000);

  const payload: jwt.JwtPayload = { sub: email, iat: nowSec, exp: expSec };
  return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
}

export function parseJWT(token: string): string {
  const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  if (typeof decoded.sub === "string") return decoded.sub;
  throw new Error("bad claims");
}