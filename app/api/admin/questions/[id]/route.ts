// app/api/admin/questions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAdmin(req);
  if (!r.ok) return r.res;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const q = await prisma.surveyQuestion.update({
    where: { id },
    data: {
      order: body.order ?? undefined,
      text: body.text ?? undefined,
    },
  });

  return NextResponse.json({ ok: true, question: q });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAdmin(req);
  if (!r.ok) return r.res;

  const { id } = await params;

  await prisma.surveyQuestion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}