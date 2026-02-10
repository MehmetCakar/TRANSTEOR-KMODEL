// app/api/admin/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

function clampPct(n: number) {
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
function safeNum(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

type Score = { total: number; correct: number; wrong: number; scorePct: number };

function buildScoreMaps(surveys: any[], responses: any[]) {
  const scoreByUserSurvey = new Map<string, Score>();

  for (const s of surveys) {
    const correctByQ = new Map<string, string>();
    for (const q of s.questions ?? []) {
      const correct = (q.options ?? []).find((o: any) => o.isCorrect);
      if (correct) correctByQ.set(q.id, correct.id);
    }

    const total = (s.questions ?? []).length;

    for (const r of responses) {
      if (r.surveyId !== s.id) continue;

      const answers: { questionId: string; optionId: string }[] = Array.isArray(r.answers)
        ? (r.answers as any)
        : [];

      let correct = 0;
      for (const q of s.questions ?? []) {
        const a = answers.find((x) => x.questionId === q.id);
        if (!a) continue;
        if (correctByQ.get(q.id) === a.optionId) correct++;
      }

      const wrong = total - correct;
      const scorePct = total ? Math.round((correct / total) * 100) : 0;
      scoreByUserSurvey.set(`${r.userId}:${r.surveyId}`, { total, correct, wrong, scorePct });
    }
  }

  return scoreByUserSurvey;
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  // 1) Aktif videolar
  const videos = await prisma.video.findMany({
    where: { isActive: true },
    select: { id: true, order: true, title: true, durationSeconds: true },
    orderBy: { order: "asc" },
  });

  // 2) Kullanıcılar (ADMIN hariç)
  const users = await prisma.user.findMany({
    where: { role: "USER" },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });

  // 3) Watch kayıtları
  const allWatches = videos.length
    ? await prisma.videoWatch.findMany({
        where: { videoId: { in: videos.map((v) => v.id) } },
        select: { userId: true, videoId: true, watchedSeconds: true, isCompleted: true, updatedAt: true, lastPositionSec: true },
      })
    : [];

  const watchByUserVideo = new Map<string, any>();
  for (const w of allWatches) watchByUserVideo.set(`${w.userId}:${w.videoId}`, w);

  // 4) VIDEO survey'leri
  const videoSurveys = videos.length
    ? await prisma.survey.findMany({
        where: { type: "VIDEO", isActive: true, videoId: { in: videos.map((v) => v.id) } },
        include: {
          questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
        },
      })
    : [];

  const surveyByVideoId = new Map<string, any>();
  for (const s of videoSurveys) if (s.videoId) surveyByVideoId.set(s.videoId, s);

  // 5) FOLLOWUP survey (tek tane: en yenisi)
  const followupSurvey = await prisma.survey.findFirst({
    where: { type: "FOLLOWUP", isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
    },
  });

 
  const allSurveyIds = [
    ...videoSurveys.map((s) => s.id),
    ...(followupSurvey ? [followupSurvey.id] : []),
  ];

  // 6) Survey cevapları (VIDEO + FOLLOWUP)
  const responses = allSurveyIds.length
    ? await prisma.surveyResponse.findMany({
        where: { surveyId: { in: allSurveyIds } },
        select: { userId: true, surveyId: true, answers: true, createdAt: true },
      })
    : [];

  console.log("FOLLOWUP SURVEY:", followupSurvey?.id);

  console.log(
    "FOLLOWUP RESPONSES:",
    responses.filter(r => r.surveyId === followupSurvey?.id)
  );


  const respondedUserSurveySet = new Set<string>();
  for (const r of responses) respondedUserSurveySet.add(`${r.userId}:${r.surveyId}`);

  const scoreByUserSurvey = buildScoreMaps(
    [...videoSurveys, ...(followupSurvey ? [followupSurvey] : [])],
    responses
  );

  // 7) VIDEO report (mevcut format)
  const report: any[] = [];

  const watchedUserVideoSet = new Set<string>();
  for (const w of allWatches) watchedUserVideoSet.add(`${w.userId}:${w.videoId}`);

  for (const v of videos) {
    const s = surveyByVideoId.get(v.id) || null;
    const rows: any[] = [];

    for (const u of users) {
      const wKey = `${u.id}:${v.id}`;
      const hasWatch = watchedUserVideoSet.has(wKey);
      const hasResponse = s ? respondedUserSurveySet.has(`${u.id}:${s.id}`) : false;

      if (!hasWatch && !hasResponse) continue;

      const w = watchByUserVideo.get(wKey) || null;

      const durationSeconds = safeNum(v.durationSeconds);
      const rawWatched = safeNum(w?.watchedSeconds);
      const watchedSeconds = durationSeconds > 0 ? Math.min(rawWatched, durationSeconds) : rawWatched;

      const completedByTime = durationSeconds > 0 && watchedSeconds >= Math.max(0, durationSeconds - 2);
      const isCompleted = !!w?.isCompleted || completedByTime;

      const watchedPct =
        durationSeconds > 0 ? (isCompleted ? 100 : clampPct((watchedSeconds / durationSeconds) * 100)) : 0;

      let surveyPart: any = {
        surveyId: s?.id ?? null,
        title: s?.title ?? null,
        type: s?.type ?? null,
        hasSurvey: !!s,
        filled: false,
      };

      if (s) {
        const score = scoreByUserSurvey.get(`${u.id}:${s.id}`) || null;
        if (score) surveyPart = { ...surveyPart, filled: true, ...score };
      }

      rows.push({
        user: { id: u.id, email: u.email },
        watch: {
          watchedSeconds,
          durationSeconds,
          watchedPct,
          isCompleted,
          finishedAt: isCompleted ? (w?.updatedAt?.toISOString?.() ?? null) : null,
          lastPositionSec: safeNum(w?.lastPositionSec),
        },
        survey: surveyPart,
      });
    }

    report.push({ video: v, users: rows });
  }

 // 8) FOLLOWUP tek obje döndür (response varsa göster)
    let followup: any = null;

    if (followupSurvey) {
      const fuUsers = responses
        .filter((r) => r.surveyId === followupSurvey.id)
        .map((r) => {
          const u = users.find((x) => x.id === r.userId);
          if (!u) return null;

          const score = scoreByUserSurvey.get(`${u.id}:${followupSurvey.id}`) || null;

          return {
            user: { id: u.id, email: u.email },
            survey: {
              surveyId: followupSurvey.id,
              title: followupSurvey.title,
              type: followupSurvey.type,
              filled: true,              // ✅ response VAR
              total: score?.total ?? null,
              correct: score?.correct ?? null,
              wrong: score?.wrong ?? null,
              scorePct: score?.scorePct ?? null,
              answeredAt: r.createdAt?.toISOString?.() ?? null,
            },
          };
        })
        .filter(Boolean);

      followup = {
        surveyId: followupSurvey.id,
        title: followupSurvey.title,
        users: fuUsers,
      };
    }

  return NextResponse.json({ ok: true, report, followup });
}