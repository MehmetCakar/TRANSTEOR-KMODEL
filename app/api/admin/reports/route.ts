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

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  // 1) Aktif videolar
  const videos = await prisma.video.findMany({
    where: { isActive: true },
    select: { id: true, order: true, title: true, durationSeconds: true },
    orderBy: { order: "asc" },
  });

  if (videos.length === 0) return NextResponse.json({ ok: true, report: [] });

  // 2) Kullanıcılar (ADMIN hariç)
  const users = await prisma.user.findMany({
    where: { role: "USER" },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });

  // 3) Watch kayıtları (tüm videoId’ler)
  const allWatches = await prisma.videoWatch.findMany({
    where: { videoId: { in: videos.map((v) => v.id) } },
    select: {
      userId: true,
      videoId: true,
      watchedSeconds: true,
      isCompleted: true,
      updatedAt: true,
    },
  });

  // ✅ hız: map’e çevir
  const watchByUserVideo = new Map<string, any>();
  for (const w of allWatches) {
    watchByUserVideo.set(`${w.userId}:${w.videoId}`, w);
  }

  // 4) VIDEO type survey’leri FULL çek (questions+options dahil) — score için DB’ye tekrar gitmeyeceğiz
  const surveys = await prisma.survey.findMany({
    where: {
      type: "VIDEO",
      isActive: true,
      videoId: { in: videos.map((v) => v.id) },
    },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
    },
  });

  const surveyByVideoId = new Map<string, any>();
  for (const s of surveys) {
    if (s.videoId) surveyByVideoId.set(s.videoId, s);
  }

  // 5) Survey cevapları
  const surveyIds = surveys.map((s) => s.id);
  const responses = surveyIds.length
    ? await prisma.surveyResponse.findMany({
        where: { surveyId: { in: surveyIds } },
        select: { userId: true, surveyId: true, answers: true },
      })
    : [];

  const responseByUserSurvey = new Map<string, any>();
  for (const r of responses) {
    responseByUserSurvey.set(`${r.userId}:${r.surveyId}`, r);
  }

  // ✅ score hesaplarını da map’e alalım: userId:surveyId -> score
  const scoreByUserSurvey = new Map<
    string,
    { total: number; correct: number; wrong: number; scorePct: number }
  >();

  for (const s of surveys) {
    // doğru şık map’i
    const correctByQ = new Map<string, string>();
    for (const q of s.questions ?? []) {
      const correct = (q.options ?? []).find((o: any) => o.isCorrect);
      if (correct) correctByQ.set(q.id, correct.id);
    }

    const total = (s.questions ?? []).length;

    // bu survey’e ait response’ları dolaş
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

  // 6) Report oluştur
  const report: any[] = [];

  // ✅ “etkileşim gösteren user” filtresi için hızlı set
  // - watch var mı?
  // - response var mı?
  const watchedUserVideoSet = new Set<string>(); // `${userId}:${videoId}`
  for (const w of allWatches) watchedUserVideoSet.add(`${w.userId}:${w.videoId}`);

  const respondedUserSurveySet = new Set<string>(); // `${userId}:${surveyId}`
  for (const r of responses) respondedUserSurveySet.add(`${r.userId}:${r.surveyId}`);

  for (const v of videos) {
    const s = surveyByVideoId.get(v.id) || null;

    const rows: any[] = [];

    for (const u of users) {
      const wKey = `${u.id}:${v.id}`;
      const hasWatch = watchedUserVideoSet.has(wKey);

      let hasResponse = false;
      if (s) hasResponse = respondedUserSurveySet.has(`${u.id}:${s.id}`);

      // sadece etkileşim varsa göster
      if (!hasWatch && !hasResponse) continue;

      const w = watchByUserVideo.get(wKey) || null;

      const durationSeconds = safeNum(v.durationSeconds);
      const rawWatched = safeNum(w?.watchedSeconds);

      // ✅ raporda “tam izlediyse tam göster”: duration’a clamp
      const watchedSeconds = durationSeconds > 0 ? Math.min(rawWatched, durationSeconds) : rawWatched;

      // ✅ tolerans: video 4:11 ama tick sebebiyle 4:06 kaldıysa; son 2 sn tolerans
      const completedByTime =
        durationSeconds > 0 && watchedSeconds >= Math.max(0, durationSeconds - 2);

      const isCompleted = !!w?.isCompleted || completedByTime;

      const watchedPct =
        durationSeconds > 0
          ? (isCompleted ? 100 : clampPct((watchedSeconds / durationSeconds) * 100))
          : 0;

      let surveyPart: any = {
        surveyId: s?.id ?? null,
        title: s?.title ?? null,
        hasSurvey: !!s,
        filled: false,
      };

      if (s) {
        const score = scoreByUserSurvey.get(`${u.id}:${s.id}`) || null;
        if (score) {
          surveyPart = {
            ...surveyPart,
            filled: true,
            ...score,
          };
        }
      }

      rows.push({
        user: { id: u.id, email: u.email },
        watch: {
          watchedSeconds,
          durationSeconds,
          watchedPct,
          isCompleted,
          finishedAt: isCompleted ? (w?.updatedAt?.toISOString?.() ?? null) : null,
        },
        survey: surveyPart,
      });
    }

    report.push({ video: v, users: rows });
  }

  return NextResponse.json({ ok: true, report });
}