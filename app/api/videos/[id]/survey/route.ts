// app/api/videos/[id]/survey/route.ts
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

// ⬇⬇ DİKKAT: params Promise, önce await ediyoruz
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;          // ← burada açıyoruz
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
  });

  if (!survey) {
    // Bu video için anket tanımlı değilse
    return NextResponse.json({ surveyId: null, alreadyFilled: false });
  }

  const response = await prisma.surveyResponse.findFirst({
    where: { userId: user.id, surveyId: survey.id },
  });

  return NextResponse.json({
    surveyId: survey.id,
    alreadyFilled: !!response,
  });
}