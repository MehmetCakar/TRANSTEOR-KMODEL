// app/api/admin/surveys/[id]/route.ts
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
  if (body?.title !== undefined) data.title = String(body.title).trim();
  if (body?.isActive !== undefined) data.isActive = !!body.isActive;

  const replaceQuestions = Array.isArray(body?.questions);

  const updated = await prisma.$transaction(async (tx) => {
    const survey = await tx.survey.update({ where: { id }, data });

    if (replaceQuestions) {
      await tx.surveyQuestion.deleteMany({ where: { surveyId: id } });

      const qs = body.questions
        .map((q: any, i: number) => ({
          order: Number(q?.order ?? i + 1),
          text: String(q?.text ?? "").trim(),
        }))
        .filter((q: any) => q.text.length > 0);

      if (qs.length) {
        await tx.surveyQuestion.createMany({
          data: qs.map((q: any) => ({ surveyId: id, order: q.order, text: q.text })),
        });
      }
    }

    return tx.survey.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: "asc" } } },
    });
  });

  return NextResponse.json({ ok: true, survey: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;

  // Silmek yerine pasif yapmak
  const updated = await prisma.survey.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true, survey: updated });
}