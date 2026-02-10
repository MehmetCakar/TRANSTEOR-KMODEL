// app/api/admin/surveys/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { SurveyType } from "@prisma/client";

type IncomingOption = { order?: number; text?: string; isCorrect?: boolean };
type IncomingQuestion = { order?: number; text?: string; options?: IncomingOption[] };

function normalizeType(raw: unknown): SurveyType | null {
  const t = String(raw ?? "").trim().toUpperCase();
  return (Object.values(SurveyType) as string[]).includes(t) ? (t as SurveyType) : null;
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => null);

  const title = String(body?.title ?? "").trim();
  const type = normalizeType(body?.type);
  const isActive = body?.isActive !== false;
  const videoId = body?.videoId ? String(body.videoId) : null;

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
                  isCorrect: o?.isCorrect === true,
                }))
                .filter((o) => o.text.length > 0)
            : [],
        }))
        .filter((q) => q.text.length > 0)
    : [];

  // validations
  if (!title || !type) {
    return NextResponse.json({ error: "title ve geçerli type zorunlu" }, { status: 400 });
  }
  if (type === "VIDEO" && !videoId) {
    return NextResponse.json({ error: "VIDEO anketi için videoId zorunlu" }, { status: 400 });
  }
  if (questions.length === 0) {
    return NextResponse.json({ error: "en az bir soru eklemelisiniz" }, { status: 400 });
  }
  for (const q of questions) {
    if (q.options.length < 2) {
      return NextResponse.json({ error: `Soru ${q.order}: en az 2 şık olmalı` }, { status: 400 });
    }
    const correctCount = q.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      return NextResponse.json({ error: `Soru ${q.order}: tam 1 doğru şık seçilmeli` }, { status: 400 });
    }
  }

  const saved = await prisma.$transaction(async (tx) => {
    // ✅ Tekil survey mantığı:
    // - VIDEO: aynı videoId için aktif survey varsa update
    // - FOLLOWUP: aktif followup varsa update
    const existing =
      type === "VIDEO"
        ? await tx.survey.findFirst({
            where: { type: "VIDEO", isActive: true, videoId: videoId! },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          })
        : await tx.survey.findFirst({
            where: { type: "FOLLOWUP", isActive: true },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });

    const survey = existing
      ? await tx.survey.update({
          where: { id: existing.id },
          data: {
            title,
            isActive,
            type,
            videoId: type === "VIDEO" ? videoId : null,
          },
        })
      : await tx.survey.create({
          data: {
            title,
            type,
            isActive,
            videoId: type === "VIDEO" ? videoId : null,
          },
        });

    // ✅ Soruları sıfırla (en temiz yöntem)
    await tx.surveyOption.deleteMany({ where: { question: { surveyId: survey.id } } });
    await tx.surveyQuestion.deleteMany({ where: { surveyId: survey.id } });

    // ✅ Yeniden oluştur
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

    // ✅ Detaylı dön
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

  return NextResponse.json({ ok: true, survey: saved });
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const surveys = await prisma.survey.findMany({
    where: {
      isActive: true,
      OR: [{ type: "VIDEO" }, { type: "FOLLOWUP" }],
    },
    select: { id: true, videoId: true, title: true, type: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ surveys });
}