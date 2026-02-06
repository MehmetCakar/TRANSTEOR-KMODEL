// app/api/admin/youtube/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

function extractYouTubeId(input: string): string | null {
  try {
    const url = new URL(input);

    // youtu.be/<id>
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (url.hostname.includes("youtube.com")) {
      // /watch?v=<id>
      if (url.pathname === "/watch") return url.searchParams.get("v");

      const parts = url.pathname.split("/").filter(Boolean);

      // /embed/<id>
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];

      // /shorts/<id>
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
    }

    return null;
  } catch {
    return null;
  }
}

function iso8601ToSeconds(duration: string): number {
  // PT1H2M3S
  const m = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const s = Number(m[3] || 0);
  return h * 3600 + min * 60 + s;
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { searchParams } = new URL(req.url);
  const url = (searchParams.get("url") || "").trim();
  if (!url) return NextResponse.json({ error: "url zorunlu" }, { status: 400 });

  const videoId = extractYouTubeId(url);
  if (!videoId) return NextResponse.json({ error: "YouTube video id çıkarılamadı" }, { status: 400 });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY tanımlı değil (.env). Server restart ettin mi?" },
      { status: 500 }
    );
  }

  const apiUrl =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=contentDetails,snippet&id=${encodeURIComponent(videoId)}` +
    `&key=${encodeURIComponent(key)}`;

  const r = await fetch(apiUrl, { cache: "no-store" });
  const json = await r.json().catch(() => ({} as any));

  if (!r.ok) {
    // Google'ın hata mesajını aynen yansıt
    return NextResponse.json(
      { error: json?.error?.message || "YouTube API hatası", raw: json?.error || json },
      { status: 400 }
    );
  }

  const item = json?.items?.[0];
  if (!item) return NextResponse.json({ error: "Video bulunamadı (API items boş)" }, { status: 404 });

  const durationSeconds = iso8601ToSeconds(item.contentDetails?.duration || "");
  const title = item.snippet?.title || null;

  return NextResponse.json({
    ok: true,
    videoId,
    title,
    durationSeconds,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
  });
}