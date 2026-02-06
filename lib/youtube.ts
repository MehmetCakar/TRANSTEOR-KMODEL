export function extractYouTubeId(url: string): string | null {
  try {
    if (!url) return null;

    // Zaten id gelmiş olabilir
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();

    const u = new URL(url);

    // youtu.be/<id>
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").trim();
      return id ? id : null;
    }

    // youtube.com/watch?v=<id>
    if (u.hostname.includes("youtube.com")) {
      // /watch?v=
      const v = u.searchParams.get("v");
      if (v) return v;

      // /embed/<id>
      const embedMatch = u.pathname.match(/\/embed\/([^/]+)/);
      if (embedMatch?.[1]) return embedMatch[1];

      // /shorts/<id>
      const shortsMatch = u.pathname.match(/\/shorts\/([^/]+)/);
      if (shortsMatch?.[1]) return shortsMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}