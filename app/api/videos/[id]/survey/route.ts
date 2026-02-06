// app/api/videos/[id]/survey/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJWT } from "@/lib/jwt";
import { debug } from "console";

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
  { params }: { params: Promise<{ id: string }> } // ✅ params Promise
) {
  const { id } = await params; // ✅ unwrap
  const videoId = id;

  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "no auth" }, { status: 401 });
  }

  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video || !video.isActive) {
    return NextResponse.json({ error: "video not found" }, { status: 404 });
  }

  // Bu videoya bağlı VIDEO tipi anket var mı?
  const survey = await prisma.survey.findFirst({
    where: { type: "VIDEO", isActive: true, videoId },
    orderBy: { createdAt: "desc" },
  });

  if (!survey) {
    return NextResponse.json({ surveyId: null, alreadyFilled: false, debug: { videoId, surveyNotFound: true } });
  }

  const response = await prisma.surveyResponse.findFirst({
    where: { userId: user.id, surveyId: survey.id },
  });

  const alreadyFilled = !!response;

  if (alreadyFilled) {
    await prisma.videoProgress.upsert({
      where: { userId_videoId: { userId: user.id, videoId } },
      update: {
        isCompleted: true,
        finishedAt: new Date(),
        // watchedSeconds'e dokunmuyoruz (rapor gerçek kalsın)
      },
      create: {
        userId: user.id,
        videoId,
        isCompleted: true,
        watchedSeconds: 0,      // ilk kez oluşuyorsa 0 kalabilir
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });
  }

  return NextResponse.json({
    surveyId: survey.id,
    alreadyFilled,
    debug: { videoId, surveyId: survey.id, userId: user.id },
  });
}