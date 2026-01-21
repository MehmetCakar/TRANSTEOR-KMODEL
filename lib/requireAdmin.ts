// lib/requireAdmin.ts

import { NextRequest, NextResponse } from "next/server";
import { parseJWT } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";

export async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) {
    return { ok: false as const, res: NextResponse.json({ error: "no auth" }, { status: 401 }) };
  }

  let email: string;
  try {
    email = parseJWT(token);
  } catch {
    return { ok: false as const, res: NextResponse.json({ error: "invalid token" }, { status: 401 }) };
  }

  if (!isAdminEmail(email)) {
    return { ok: false as const, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { ok: false as const, res: NextResponse.json({ error: "user not found" }, { status: 404 }) };
  }

  return { ok: true as const, email, user };
}