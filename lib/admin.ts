// lib/admin.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJWT } from "@/lib/jwt";

export function isAdminEmail(email: string) {
  const raw = process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? "";
  const admins = raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}

export async function getUserFromRequest(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return null;

  try {
    const email = parseJWT(token); // ✅ string
    return await prisma.user.findUnique({ where: { email } });
  } catch {
    return null;
  }
}

export async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return { ok: false as const, status: 401, error: "no auth" };

  const envAdmin = isAdminEmail(user.email);

  // admin değilse ve env listesinde de yoksa -> 403
  if (user.role !== "ADMIN" && !envAdmin) {
    return { ok: false as const, status: 403, error: "forbidden" };
  }

  // env admin ise DB role'u ADMIN'e yükselt
  if (envAdmin && user.role !== "ADMIN") {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
  }

  return {
    ok: true as const,
    user: envAdmin ? { ...user, role: "ADMIN" as const } : user,
  };
}