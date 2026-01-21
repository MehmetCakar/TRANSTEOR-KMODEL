// app/api/admin/surveys/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { SurveyType } from "@prisma/client";

type IncomingOption = { order?: number; text?: string; isCorrect?: boolean };
type IncomingQuestion = { order?: number; text?: string; options?: IncomingOption[] };

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

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

  // basit validasyon: her soruda en az 2 şık + 1 doğru
  for (const q of questions) {
    if (q.options.length < 2) {
      return NextResponse.json({ error: `Soru ${q.order}: en az 2 şık olmalı` }, { status: 400 });
    }
    const correctCount = q.options.filter(o => o.isCorrect).length;
    if (correctCount !== 1) {
      return NextResponse.json({ error: `Soru ${q.order}: tam 1 doğru şık seçilmeli` }, { status: 400 });
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const survey = await tx.survey.create({
      data: {
        title,
        type,
        isActive,
        videoId: type === "VIDEO" ? videoId : null,
      },
    });

    for (const q of questions) {
      const question = await tx.surveyQuestion.create({
        data: { surveyId: survey.id, order: q.order, text: q.text },
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
      where: { id: survey.id },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
      },
    });
  });

  return NextResponse.json({ ok: true, survey: created });
}