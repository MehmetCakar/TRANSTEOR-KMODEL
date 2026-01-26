// app/api/admin/videos/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const body = await req.json().catch(() => null);

  const data: any = {};
  if (body?.order !== undefined) data.order = Number(body.order);
  if (body?.title !== undefined) data.title = String(body.title).trim();
  if (body?.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body?.url !== undefined) data.url = String(body.url).trim();
  if (body?.durationSeconds !== undefined) data.durationSeconds = Number(body.durationSeconds);
  if (body?.isActive !== undefined) data.isActive = !!body.isActive;

  const updated = await prisma.video.update({ where: { id }, data });
  return NextResponse.json({ ok: true, video: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;

  // Video silmek yerine pasif yapmak daha güvenli
  const updated = await prisma.video.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true, video: updated });
}