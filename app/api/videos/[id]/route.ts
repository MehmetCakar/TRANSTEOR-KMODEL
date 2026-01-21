// app/api/videos/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJWT } from "@/lib/jwt";

async function getUserFromRequest(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return null;
  try {
    const email = parseJWT(token);
    const user = await prisma.user.findUnique({ where: { email } });
    return user;
  } catch {
    return null;
  }
}

// GET → videonun bilgisi + kullanıcının progress'i + o videoya ait anket
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // ← Next 15 Promise olayı

  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "no auth" }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: "no id" }, { status: 400 });
  }

  const video = await prisma.video.findUnique({
    where: { id },
  });

  if (!video || !video.isActive) {
    return NextResponse.json({ error: "video not found" }, { status: 404 });
  }

  const progress = await prisma.videoProgress.findUnique({
    where: {
      userId_videoId: {
        userId: user.id,
        videoId: video.id,
      },
    },
  });

  // 🔹 Bu videoya bağlı aktif VIDEO tipi anketi bul
  const survey = await prisma.survey.findFirst({
    where: {
      isActive: true,
      type: "VIDEO",
      videoId: video.id,
    },
  });

  // 🔹 Kullanıcı bu videonun anketini doldurmuş mu?
  let surveyAnswered = false;
  if (survey) {
    const resp = await prisma.surveyResponse.findFirst({
      where: {
        userId: user.id,
        surveyId: survey.id,
      },
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

// POST → videoyu tamamlandı işaretleme (bunu çok bozmayalım)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "no auth" }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: "no id" }, { status: 400 });
  }

  const video = await prisma.video.findUnique({
    where: { id },
  });

  if (!video || !video.isActive) {
    return NextResponse.json({ error: "video not found" }, { status: 404 });
  }

  const now = new Date();

  const progress = await prisma.videoProgress.upsert({
    where: {
      userId_videoId: {
        userId: user.id,
        videoId: video.id,
      },
    },
    update: {
      watchedSeconds: video.durationSeconds,
      isCompleted: true,
      finishedAt: now,
    },
    create: {
      userId: user.id,
      videoId: video.id,
      watchedSeconds: video.durationSeconds,
      isCompleted: true,
      startedAt: now,
      finishedAt: now,
    },
  });

  return NextResponse.json({
    ok: true,
    progress: {
      watchedSeconds: progress.watchedSeconds,
      isCompleted: progress.isCompleted,
    },
  });
}