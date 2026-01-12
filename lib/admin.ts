// lib/admin.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJWT } from "./jwt"; // veya "@/lib/jwt" hangisini kullanıyorsan TEKLEŞTİR

export function isAdminEmail(email: string) {
  const raw = process.env.ADMIN_EMAILS || "";
  const admins = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return admins.includes(email.trim().toLowerCase());
}

export async function getUserFromRequest(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return null;
  try {
    const email = parseJWT(token);
    return await prisma.user.findUnique({ where: { email } });
  } catch {
    return null;
  }
}

export async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return { ok: false as const, status: 401, error: "no auth" };
  if (user.role !== "ADMIN")
    return { ok: false as const, status: 403, error: "forbidden" };
  return { ok: true as const, user };
}