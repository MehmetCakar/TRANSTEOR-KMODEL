// app/api/admin/surveys/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { SurveyType } from "@prisma/client";

type IncomingOption = { order?: number; text?: string; isCorrect?: boolean };
type IncomingQuestion = { order?: number; text?: string; options?: IncomingOption[] };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;

  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!survey) return NextResponse.json({ error: "survey not found" }, { status: 404 });
  return NextResponse.json({ ok: true, survey });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const body = await req.json().catch(() => null);

  const title = String(body?.title ?? "").trim();
  const rawType = String(body?.type ?? "").trim().toUpperCase();
  const isActive = body?.isActive !== false;
  const videoId = body?.videoId ? String(body.videoId) : null;

  const type = (Object.values(SurveyType) as string[]).includes(rawType)
    ? (rawType as SurveyType)
    : null;

  const questions = Array.isArray(body?.questions)
    ? (body.questions as IncomingQuestion[])
        .map((q, i) => ({
          order: Number(q?.order ?? i + 1),
          text: String(q?.text ?? "").trim(),
          options: Array.isArray(q?.options)
            ? q.options
                .map((o, j) => ({
                  order: Number(o?.order ?? j + 1),
                  text: String(o?.text ?? "").trim(),
                  isCorrect: Boolean(o?.isCorrect),
                }))
                .filter(o => o.text.length > 0)
            : [],
        }))
        .filter(q => q.text.length > 0)
    : [];

  if (!title || !type) {
    return NextResponse.json({ error: "title ve geçerli type zorunlu" }, { status: 400 });
  }
  if (type === "VIDEO" && !videoId) {
    return NextResponse.json({ error: "VIDEO anketi için videoId zorunlu" }, { status: 400 });
  }

  // validasyon
  for (const q of questions) {
    if (q.options.length < 2) {
      return NextResponse.json({ error: `Soru ${q.order}: en az 2 şık olmalı` }, { status: 400 });
    }
    const correctCount = q.options.filter(o => o.isCorrect).length;
    if (correctCount !== 1) {
      return NextResponse.json({ error: `Soru ${q.order}: tam 1 doğru şık seçilmeli` }, { status: 400 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    // önce survey meta güncelle
    await tx.survey.update({
      where: { id },
      data: {
        title,
        type,
        isActive,
        videoId: type === "VIDEO" ? videoId : null,
      },
    });

    // en basit ve sağlam yol: eski soruları komple sil, yenisini yaz
    // (Cascade ile options da silinir)
    await tx.surveyQuestion.deleteMany({ where: { surveyId: id } });

    for (const q of questions) {
      const question = await tx.surveyQuestion.create({
        data: { surveyId: id, order: q.order, text: q.text },
      });

      await tx.surveyOption.createMany({
        data: q.options.map((o) => ({
          questionId: question.id,
          order: o.order,
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      });
    }

    return tx.survey.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
      },
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

  await prisma.survey.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}