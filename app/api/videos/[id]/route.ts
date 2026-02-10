// app/api/videos/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJWT } from "@/lib/jwt";

async function getUserFromRequest(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return null;
  try {
    const email = parseJWT(token);
    return await prisma.user.findUnique({ where: { email } });
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoId } = await params;

  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });
  if (!videoId) return NextResponse.json({ error: "no id" }, { status: 400 });

  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video || !video.isActive) {
    return NextResponse.json({ error: "video not found" }, { status: 404 });
  }

  // Son aktif video mu? (8. video açılınca sayaç başlasın)
  const last = await prisma.video.findFirst({
    where: { isActive: true },
    orderBy: { order: "desc" },
    select: { id: true },
  });

  // startedAt'ı sadece 8. videoda ve sadece ilk kez set et
  // (race condition olmasın diye transaction içinde yapıyoruz)
  const progress = await prisma.$transaction(async (tx) => {
    if (last?.id === video.id) {
      const existing = await tx.videoProgress.findUnique({
        where: { userId_videoId: { userId: user.id, videoId: video.id } },
        select: { id: true, startedAt: true },
      });

      if (!existing?.startedAt) {
        const now = new Date();

        await tx.videoProgress.upsert({
          where: { userId_videoId: { userId: user.id, videoId: video.id } },
          update: { startedAt: now }, // sadece startedAt set
          create: {
            userId: user.id,
            videoId: video.id,
            watchedSeconds: 0,
            isCompleted: false,
            startedAt: now,
            finishedAt: null,
          },
        });
      }
    }

    // Güncel progress'i döndür
    return tx.videoProgress.findUnique({
      where: { userId_videoId: { userId: user.id, videoId: video.id } },
    });
  });

  // Bu videoya bağlı VIDEO tipi survey
  const survey = await prisma.survey.findFirst({
    where: { isActive: true, type: "VIDEO", videoId: video.id },
    select: { id: true, title: true },
  });

  let surveyAnswered = false;
  if (survey) {
    const resp = await prisma.surveyResponse.findFirst({
      where: { userId: user.id, surveyId: survey.id },
      select: { id: true },
    });
    surveyAnswered = !!resp;
  }

  return NextResponse.json({
    video: {
      id: video.id,
      order: video.order,
      title: video.title,
      description: video.description,
      url: video.url,
      durationSeconds: video.durationSeconds,
    },
    progress: progress
      ? {
          watchedSeconds: progress.watchedSeconds,
          isCompleted: progress.isCompleted,
          startedAt: progress.startedAt, // debug/UI için lazım
        }
      : null,
    survey: survey
      ? {
          id: survey.id,
          title: survey.title,
          answered: surveyAnswered,
        }
      : null,
  });
}