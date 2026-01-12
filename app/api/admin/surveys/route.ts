import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { SurveyType } from "@prisma/client";

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

  const questions: { order: number; text: string }[] = Array.isArray(body?.questions)
    ? body.questions
        .map((q: any, i: number) => ({
          order: Number(q?.order ?? i + 1),
          text: String(q?.text ?? "").trim(),
        }))
        // @ts-expect-error
        .filter((q): q is { order: number; text: string } => q.text.length > 0)
    : [];

  if (!title || !type) {
    return NextResponse.json({ error: "title ve geçerli type zorunlu" }, { status: 400 });
  }

  if (type === "VIDEO" && !videoId) {
    return NextResponse.json({ error: "VIDEO anketi için videoId zorunlu" }, { status: 400 });
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

    if (questions.length) {
      await tx.surveyQuestion.createMany({
        data: questions.map((q) => ({ surveyId: survey.id, order: q.order, text: q.text })),
      });
    }

    return tx.survey.findUnique({
      where: { id: survey.id },
      include: { questions: { orderBy: { order: "asc" } } },
    });
  });

  return NextResponse.json({ ok: true, survey: created });
}