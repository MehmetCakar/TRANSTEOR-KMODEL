// app/api/admin/reports/user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

function safeNum(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function clampPct(n: number) {
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function calcStats(survey: any, response: any) {
  const answers: { questionId: string; optionId: string }[] = Array.isArray(response?.answers)
    ? (response.answers as any)
    : [];

  const correctByQuestion = new Map<string, string>();

  for (const q of survey.questions ?? []) {
    const correct = (q.options ?? []).find((o: any) => o.isCorrect);
    if (correct) correctByQuestion.set(q.id, correct.id);
  }

  const total = (survey.questions ?? []).length;
  let correct = 0;

  for (const q of survey.questions ?? []) {
    const a = answers.find((x) => x.questionId === q.id);
    if (!a) continue;
    if (correctByQuestion.get(q.id) === a.optionId) correct++;
  }

  const wrong = total - correct;
  const scorePct = total ? Math.round((correct / total) * 100) : 0;

  return { total, correct, wrong, scorePct };
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");
  const userId = searchParams.get("userId");

  if (!videoId || !userId) {
    return NextResponse.json({ error: "videoId ve userId zorunlu" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  const video = await prisma.video.findUnique({
    where: { id: videoId },
  });

  if (!user || !video) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // ⚠️ progress: butona basınca duration’a setlenebildiği için “gerçek izleme” gibi kullanmayacağız
  const progress = await prisma.videoProgress.findUnique({
    where: { userId_videoId: { userId, videoId } },
  });

  // ✅ gerçek izleme kaydı
  const watch = await prisma.videoWatch.findUnique({
    where: { userId_videoId: { userId, videoId } },
  });

  // ✅ watch’tan hesaplanan metrikler (tolerans: 2sn)
  const durationSeconds = safeNum(video.durationSeconds);
  const rawWatched = safeNum(watch?.watchedSeconds);
  const watchedSeconds = durationSeconds > 0 ? Math.min(rawWatched, durationSeconds) : rawWatched;

  const completedByTime =
    durationSeconds > 0 && watchedSeconds >= Math.max(0, durationSeconds - 2);

  const watchedIsCompleted = !!watch?.isCompleted || completedByTime;

  const watchedPct =
    durationSeconds > 0
      ? (watchedIsCompleted ? 100 : clampPct((watchedSeconds / durationSeconds) * 100))
      : 0;

  const survey = await prisma.survey.findFirst({
    where: { type: "VIDEO", isActive: true, videoId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { options: true },
      },
    },
  });

  const response = survey
    ? await prisma.surveyResponse.findFirst({
        where: { userId, surveyId: survey.id },
      })
    : null;

  const stats = survey && response ? calcStats(survey, response) : null;

  return NextResponse.json({
    ok: true,
    user,
    video,

    // ikisini de dönüyorum: UI’da hangisini göstereceğini sen seç
    progress,
    watch,

    watchSummary: {
      durationSeconds,
      watchedSeconds,
      watchedPct,
      isCompleted: watchedIsCompleted,
      finishedAt: watchedIsCompleted ? (watch?.updatedAt?.toISOString?.() ?? null) : null,
      lastPositionSec: safeNum(watch?.lastPositionSec),
    },

    survey,
    response,
    stats,
  });
}