// app/api/videos/[id]/watch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJWT } from "@/lib/jwt";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: videoId } = await params;

  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "no auth" }, { status: 401 });

  let email = "";
  try {
    email = parseJWT(token);
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) return NextResponse.json({ error: "video not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const deltaSecondsRaw = Number(body?.deltaSeconds ?? 0);
  const watchedSecondsRaw = Number(body?.watchedSeconds ?? 0);
  const lastPositionSecRaw = Number(body?.lastPositionSec ?? 0);

  const deltaSeconds = Number.isFinite(deltaSecondsRaw) && deltaSecondsRaw > 0 ? deltaSecondsRaw : 0;
  const incomingTotal = Number.isFinite(watchedSecondsRaw) && watchedSecondsRaw >= 0 ? watchedSecondsRaw : 0;
  const lastPositionSec = Number.isFinite(lastPositionSecRaw) && lastPositionSecRaw >= 0 ? Math.floor(lastPositionSecRaw) : 0;

  const dur = Number(video.durationSeconds || 0);
  const tol = 5;

  const existingWatch = await prisma.videoWatch.findUnique({
    where: { userId_videoId: { userId: user.id, videoId } },
  });

  let nextWatched = existingWatch?.watchedSeconds ?? 0;
  if (deltaSeconds > 0) nextWatched += deltaSeconds;
  else nextWatched = Math.max(nextWatched, incomingTotal);

  if (dur > 0) nextWatched = Math.min(nextWatched, dur);

  const askedCompleted = body?.isCompleted === true;
  const reachedEnd = dur > 0 ? lastPositionSec >= Math.max(0, dur - tol) : false;
  const shouldComplete = askedCompleted && reachedEnd;

  const nextIsCompleted = (existingWatch?.isCompleted ?? false) || shouldComplete;

  const now = new Date();

  const watch = await prisma.videoWatch.upsert({
    where: { userId_videoId: { userId: user.id, videoId } },
    update: {
      watchedSeconds: nextIsCompleted && dur > 0 ? dur : Math.floor(nextWatched),
      lastPositionSec,
      isCompleted: nextIsCompleted,
    },
    create: {
      userId: user.id,
      videoId,
      watchedSeconds: nextIsCompleted && dur > 0 ? dur : Math.floor(nextWatched),
      lastPositionSec,
      isCompleted: nextIsCompleted,
    },
  });

  // ✅ startedAt burada yok!
  await prisma.videoProgress.upsert({
    where: { userId_videoId: { userId: user.id, videoId } },
    update: {
      watchedSeconds: Math.max(0, Math.floor(watch.watchedSeconds)),
      isCompleted: nextIsCompleted,
      finishedAt: nextIsCompleted ? now : undefined,
    },
    create: {
      userId: user.id,
      videoId,
      watchedSeconds: Math.max(0, Math.floor(watch.watchedSeconds)),
      isCompleted: nextIsCompleted,           
      finishedAt: nextIsCompleted ? now : null,
    },
  });

  return NextResponse.json({ ok: true, watch });
}