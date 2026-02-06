// app/api/admin/videos/[id]/watch/route.ts
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

  const body = await req.json().catch(() => null);

  const deltaSeconds = Math.max(0, Number(body?.deltaSeconds ?? 0));
  const lastPositionSec = Math.max(0, Number(body?.lastPositionSec ?? 0));
  const isCompleted = body?.isCompleted === true;

  // completed ise: direkt %100’e çek
  if (isCompleted) {
    const dur = Math.max(0, Number(video.durationSeconds || 0));

    await prisma.$transaction(async (tx) => {
      await tx.videoWatch.upsert({
        where: { userId_videoId: { userId: user.id, videoId } },
        update: {
          isCompleted: true,
          watchedSeconds: dur,
          lastPositionSec: dur,
        },
        create: {
          userId: user.id,
          videoId,
          isCompleted: true,
          watchedSeconds: dur,
          lastPositionSec: dur,
        },
      });

      await tx.videoProgress.upsert({
        where: { userId_videoId: { userId: user.id, videoId } },
        update: {
          isCompleted: true,
          watchedSeconds: dur,
          finishedAt: new Date(),
        },
        create: {
          userId: user.id,
          videoId,
          isCompleted: true,
          watchedSeconds: dur,
          finishedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ ok: true, completed: true });
  }

  // completed değilse: delta ile increment + clamp
  const dur = Math.max(0, Number(video.durationSeconds || 0));

  const updated = await prisma.$transaction(async (tx) => {
    const vw = await tx.videoWatch.upsert({
      where: { userId_videoId: { userId: user.id, videoId } },
      update: {
        watchedSeconds: { increment: Math.floor(deltaSeconds) },
        lastPositionSec: Math.floor(lastPositionSec),
      },
      create: {
        userId: user.id,
        videoId,
        watchedSeconds: Math.floor(deltaSeconds),
        lastPositionSec: Math.floor(lastPositionSec),
      },
    });

    // clamp (durationSeconds üstüne çıkmasın)
    const clampedWatch = dur ? Math.min(vw.watchedSeconds, dur) : vw.watchedSeconds;
    const clampedPos = dur ? Math.min(vw.lastPositionSec, dur) : vw.lastPositionSec;

    const vw2 =
      clampedWatch !== vw.watchedSeconds || clampedPos !== vw.lastPositionSec
        ? await tx.videoWatch.update({
            where: { id: vw.id },
            data: { watchedSeconds: clampedWatch, lastPositionSec: clampedPos },
          })
        : vw;

    const vp = await tx.videoProgress.upsert({
      where: { userId_videoId: { userId: user.id, videoId } },
      update: {
        watchedSeconds: { increment: Math.floor(deltaSeconds) },
      },
      create: {
        userId: user.id,
        videoId,
        watchedSeconds: Math.floor(deltaSeconds),
      },
    });

    const vpClamped = dur ? Math.min(vp.watchedSeconds, dur) : vp.watchedSeconds;
    const vp2 =
      vpClamped !== vp.watchedSeconds
        ? await tx.videoProgress.update({ where: { id: vp.id }, data: { watchedSeconds: vpClamped } })
        : vp;

    return { vw: vw2, vp: vp2 };
  });

  return NextResponse.json({ ok: true, watch: updated.vw, progress: updated.vp });
}