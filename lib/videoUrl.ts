// lib/videoUrl.ts

export function isYouTubeUrl(url?: string | null) {
  if (!url) return false;
  const u = url.toLowerCase();
  return u.includes("youtube.com") || u.includes("youtu.be");
}

export function toYouTubeEmbed(url: string) {
  try {
    const make = (id: string) => {
      const params = new URLSearchParams({
        controls: "1",
        rel: "0",
        modestbranding: "1",
        playsinline: "1",
      });
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    };

    if (url.includes("youtube.com/embed/")) {
      // embed ise ama parametre yoksa ekle
      const u = new URL(url);
      const id = u.pathname.split("/embed/")[1]?.split("/")[0];
      if (!id) return url;
      return make(id);
    }

    const u = new URL(url);

    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").trim();
      return id ? make(id) : null;
    }

    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      return id ? make(id) : null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * DB’ye kaydetmeden önce URL’yi normalize eder:
 * - YouTube watch/youtu.be -> embed
 * - Diğer linkler olduğu gibi kalır
 */
export function normalizeVideoUrl(raw: string) {
  const url = (raw || "").trim();
  if (!url) return "";
  if (isYouTubeUrl(url)) return toYouTubeEmbed(url) ?? url;
  return url;
}

/**
 * Iframe src için biraz daha “temiz” parametreler ekleyebilirsin.
 */
export function buildYouTubeEmbedSrc(embedUrl: string) {
  // rel=0: önerilen videoları kısıtlar, modestbranding: küçük branding
  const hasQuery = embedUrl.includes("?");
  return embedUrl + (hasQuery ? "&" : "?") + "rel=0&modestbranding=1";
}