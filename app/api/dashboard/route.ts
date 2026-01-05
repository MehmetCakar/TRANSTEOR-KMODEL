// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJWT } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("access_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "no auth" }, { status: 401 });
    }

    let email: string;
    try {
      email = parseJWT(token);
    } catch {
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    // ─────────────────────────────────────────────────────────────
    // 1) Videolar ve progress bilgisi
    // ─────────────────────────────────────────────────────────────
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

    const nextVideo = videos.find(
      (v) =>
        !progresses.some(
          (p) => p.videoId === v.id && p.isCompleted === true
        )
    );

    // Son tamamlanan video (6 ay sonrası için lazım olacak)
    const lastCompleted = await prisma.videoProgress.findFirst({
      where: {
        userId: user.id,
        isCompleted: true,
      },
      orderBy: { finishedAt: "desc" },
    });

    // ─────────────────────────────────────────────────────────────
    // 2) Anketler: her video için VIDEO tipi + tek FOLLOWUP
    // ─────────────────────────────────────────────────────────────
    const allSurveys = await prisma.survey.findMany({
      where: {
        isActive: true,
        OR: [
          { type: "VIDEO" },     // her videonun kendi anketi
          { type: "FOLLOWUP" },  // 6 ay sonrası anketi
        ],
      },
    });

    const surveyResponses = await prisma.surveyResponse.findMany({
      where: { userId: user.id },
    });

    // Video başına anket durumu
    const videoSurveys = allSurveys.filter((s) => s.type === "VIDEO");

    const surveysPerVideo = videos.map((video) => {
      const survey = videoSurveys.find((s) => s.videoId === video.id) || null;
      const response = survey
        ? surveyResponses.find((r) => r.surveyId === survey.id)
        : null;

      return {
        videoId: video.id,
        order: video.order,
        surveyId: survey?.id ?? null,
        title: survey?.title ?? null,
        completed: !!response,
      };
    });

    // 6 ay sonrası tek anket
    const followupSurvey = allSurveys.find((s) => s.type === "FOLLOWUP") || null;
    const followupResponse = followupSurvey
      ? surveyResponses.find((r) => r.surveyId === followupSurvey.id)
      : null;

    let followupNeeded = false;
    if (followupSurvey && lastCompleted?.finishedAt) {
      const sixMonthsLater = new Date(lastCompleted.finishedAt);
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
      // Bugünden önce/bugün ise artık doldurulabilir
      followupNeeded = new Date() >= sixMonthsLater;
    }

    // ─────────────────────────────────────────────────────────────
    // 3) JSON cevabı
    // ─────────────────────────────────────────────────────────────
    return NextResponse.json({
      email,
      videos: {
        total: videos.length,
        completed: completedCount,
        nextVideo: nextVideo
          ? {
              id: nextVideo.id,
              order: nextVideo.order,
              title: nextVideo.title,
            }
          : null,
      },
      surveys: {
        perVideo: surveysPerVideo,
        followup: {
          surveyId: followupSurvey?.id ?? null,
          title: followupSurvey?.title ?? null,
          completed: !!followupResponse,
          needed: !!followupSurvey && followupNeeded && !followupResponse,
        },
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "internal error" },
      { status: 500 }
    );
  }
}