// app/api/admin/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: NextRequest) {
  const r = await requireAdmin(req);

  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  }

  return NextResponse.json({ ok: true, email: r.user.email });
}