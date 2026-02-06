// app/api/admin/videos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const videos = await prisma.video.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ videos });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => null);

  const title = String(body?.title ?? "").trim();
  const description = body?.description ? String(body.description) : null;
  const url = String(body?.url ?? "").trim();
  const durationSeconds = Number(body?.durationSeconds);
  const isActive = body?.isActive !== false;

  if (!title || !url || !durationSeconds) {
    return NextResponse.json(
      { error: "title, url, durationSeconds zorunlu" },
      { status: 400 }
    );
  }

  // ✅ order otomatik: max(order)+1
  const last = await prisma.video.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  const nextOrder = (last?.order ?? 0) + 1;

  const created = await prisma.video.create({
    data: { order: nextOrder, title, description, url, durationSeconds, isActive },
  });

  return NextResponse.json({ ok: true, video: created });
}