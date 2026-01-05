// app/api/videos/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJWT } from "@/lib/auth";

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

// API'nin frontende döndüğü tek obje
type VideoApiResponse = {
  id: string;
  order: number;
  title: string;
  description: string | null;
  url: string | null;
  durationSeconds: number;
  watchedSeconds: number;
  isCompleted: boolean;
};

export async function GET(
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
    // Bu videoya ait aktif VIDEO anketini bul
  const survey = await prisma.survey.findFirst({
    where: {
      type: "VIDEO",
      isActive: true,
      videoId: id,
    },
  });

  if (!survey) {
    // anket yoksa dashboard’a dönebilsin diye
    return NextResponse.json({ surveyId: null });
  }

  // Kullanıcı daha önce doldurmuş mu?
  const existing = await prisma.surveyResponse.findFirst({
    where: {
      userId: user.id,
      surveyId: survey.id,
    },
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

  const payload: VideoApiResponse = {
    id: video.id,
    order: video.order,
    title: video.title,
    description: video.description,
    url: video.url,
    durationSeconds: video.durationSeconds,
    watchedSeconds: progress?.watchedSeconds ?? 0,
    isCompleted: progress?.isCompleted ?? false,
  };
 return NextResponse.json({
    surveyId: survey.id,
    alreadyFilled: !!existing,
    payload,
  });

}

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

  // Frontend'den gelen body'yi oku (gelse de gelmese de çalışsın)
  const body = await req.json().catch(() => ({}));
  let watchedSeconds =
    typeof body.watchedSeconds === "number"
      ? body.watchedSeconds
      : video.durationSeconds;
  const isCompleted =
    typeof body.isCompleted === "boolean" ? body.isCompleted : true;

  // watchedSeconds'i 0–duration aralığında tut
  if (watchedSeconds < 0) watchedSeconds = 0;
  if (watchedSeconds > video.durationSeconds) {
    watchedSeconds = video.durationSeconds;
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
      watchedSeconds,
      isCompleted,
      finishedAt: isCompleted ? now : null,
    },
    create: {
      userId: user.id,
      videoId: video.id,
      watchedSeconds,
      isCompleted,
      startedAt: now,
      finishedAt: isCompleted ? now : null,
    },
  });

  return NextResponse.json({
    watchedSeconds: progress.watchedSeconds,
    isCompleted: progress.isCompleted,
  });
}