// app/api/admin/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET(req: NextRequest) {
  const r = await requireAdmin(req);
  if (!r.ok) return r.res;
  return NextResponse.json({ ok: true, email: r.email });
}