// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJWT } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("access_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "no auth" }, { status: 401 });
    }

    // parseJWT bazen email döner bazen userId dönebilir
    let claim: string;
    try {
      claim = String(parseJWT(token)).trim();
    } catch {
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }

    //  kullanıcıyı hem id hem email ile bul
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: claim }, { email: claim.toLowerCase() }],
      },
    });

    if (!user) {
      return NextResponse.json({ error: "user not found", tokenClaim: claim }, { status: 404 });
    }

    // 1) Videolar + ilerleme
    const videos = await prisma.video.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    });

    const videoIds = videos.map((v) => v.id);

    const progresses = await prisma.videoProgress.findMany({
      where: {
        userId: user.id,
        videoId: { in: videoIds },
      },
    });

    const completedCount = progresses.filter((p) => p.isCompleted).length;

    // completedCount: kaç video isCompleted true
    // basamak: 1..5
    let stage = 1;
    if (completedCount >= 1) stage = 1;           // istersen 1 kalsın
    if (completedCount >= 2) stage = 2;
    if (completedCount >= 4) stage = 3;
    if (completedCount >= 6) stage = 4;
    if (completedCount >= 8) stage = 5;

    // Alternatif daha kısa:
    const stage2 =
      completedCount >= 8 ? 5 :
      completedCount >= 6 ? 4 :
      completedCount >= 4 ? 3 :
      completedCount >= 2 ? 2 : 1;

    const lastCompleted = await prisma.videoProgress.findFirst({
      where: { userId: user.id, isCompleted: true },
      orderBy: { finishedAt: "desc" },
    });

    // 2) Anketler: VIDEO + FOLLOWUP
    const allSurveys = await prisma.survey.findMany({
      where: {
        isActive: true,
        OR: [{ type: "VIDEO" }, { type: "FOLLOWUP" }],
      },
    });

    const surveyResponses = await prisma.surveyResponse.findMany({
      where: { userId: user.id },
    });

    const videoSurveys = allSurveys.filter((s) => s.type === "VIDEO");

    const surveysPerVideo = videos.map((video) => {
      const survey = videoSurveys.find((s) => s.videoId === video.id) || null;
      const response = survey ? surveyResponses.find((r) => r.surveyId === survey.id) : null;

      const prog = progresses.find((p) => p.videoId === video.id);
      const videoCompleted = !!prog?.isCompleted;

      return {
        videoId: video.id,
        order: video.order,
        surveyId: survey?.id ?? null,
        title: survey?.title ?? null,
        completed: !!response, // anket dolduruldu mu
        videoCompleted, // video tamamlandı mı
      };
    });

    const totalVideoSurveys = surveysPerVideo.length;
    const completedVideoSurveys = surveysPerVideo.filter((s) => s.completed).length;
    const lastVideo = videos[videos.length - 1] || null;
    const lastVideoProgress = lastVideo
      ? progresses.find(p => p.videoId === lastVideo.id)
      : null;


    // ✅ unlock kuralı: videoCompleted OR surveyCompleted
    const isUnlocked = (videoId: string) => {
      const progDone = progresses.some((p) => p.videoId === videoId && p.isCompleted === true);
      const surveyDone = surveysPerVideo.some((x) => x.videoId === videoId && x.completed === true);
      return progDone || surveyDone;
    };

    const nextVideo =
      videos.find((v) => !isUnlocked(v.id)) || null;

    const unlockedCount = videos.filter((v) => isUnlocked(v.id)).length;

    // unlockedCount hesapladıktan hemen sonra:
    const stageByUnlocked =
      unlockedCount >= 8 ? 5 :
      unlockedCount >= 6 ? 4 :
      unlockedCount >= 4 ? 3 :
      unlockedCount >= 2 ? 2 : 1;

    // 6 ay sonrası followup
    const followupSurvey = allSurveys.find((s) => s.type === "FOLLOWUP") || null;

    const followupResponse = followupSurvey
      ? surveyResponses.find((r) => r.surveyId === followupSurvey.id)
      : null;

    let followupNeeded = false;
    let followupAvailableAt: Date | null = null;

    if (followupSurvey && lastVideoProgress?.startedAt) {
      const sixMonthsLater = new Date(lastVideoProgress.startedAt);
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

      followupAvailableAt = sixMonthsLater;
      followupNeeded = new Date() >= sixMonthsLater;
    }

    return NextResponse.json({
      email: user.email,

      videos: {
        total: videos.length,

        // ✅ UI için "ilerleme" (survey doldurulunca da ilerlesin)
        completed: unlockedCount,

        // ekstra debug/analytics için (istersen UI’da göstermeyebilirsin)
        completedStrict: completedCount, // sadece gerçek video tamamlanan

        nextVideo: nextVideo ? { id: nextVideo.id, order: nextVideo.order, title: nextVideo.title } : null,
      },

      surveys: {
        perVideo: {
          items: surveysPerVideo,
          total: totalVideoSurveys,
          completed: completedVideoSurveys,
        },
        followup: {
            surveyId: followupSurvey?.id ?? null,
            title: followupSurvey?.title ?? null,
            completed: !!followupResponse,
            needed: !!followupSurvey && followupNeeded && !followupResponse,

            //  UI için 
            availableAt: followupAvailableAt?.toISOString() ?? null,
            triggered: !!lastVideoProgress?.startedAt,   
            triggeredByVideo: lastVideo?.order ?? null,
          },
        },

        changeStages: {
          active: stageByUnlocked,
          unlockedCount,
          completedStrict: completedCount,
          totalVideos: videos.length,
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message || "internal error" }, { status: 500 });
  }
}