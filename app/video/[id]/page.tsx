// app/video/[id]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type VideoData = {
  video: {
    id: string;
    order: number;
    title: string;
    description: string | null;
    url: string | null;
    durationSeconds: number;
  };
  progress: {
    watchedSeconds: number;
    isCompleted: boolean;
    lastPositionSec?: number;
  } | null;
};

function isYouTubeUrl(url?: string | null) {
  if (!url) return false;
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);

    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").trim();
      return id || null;
    }

    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/watch")) return u.searchParams.get("v");

      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    }

    return null;
  } catch {
    return null;
  }
}

export default function VideoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const videoId = params?.id;

  const [data, setData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // player refs
  const playerRef = useRef<any>(null); // YT player
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);

  // ticking/watch refs
  const tickRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);

  // "bu sayfada" biriken izleme (toplam)
  const watchedAccRef = useRef<number>(0);

  // server’a en son gönderdiğimiz "acc"
  const lastSentAccRef = useRef<number>(0);

  // son bilinen position (sec)
  const lastPosRef = useRef<number>(0);

  const endedOnceRef = useRef(false);

  const videoUrl = data?.video.url || "";
  const ytId = useMemo(() => (videoUrl ? extractYouTubeId(videoUrl) : null), [videoUrl]);
  const isYT = !!ytId;

  

  // 1) load video
  useEffect(() => {
    if (!videoId) {
      setError("Video bulunamadı (geçersiz adres).");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) setError(json.error || "Video bilgisi alınamadı.");
        else setData(json);
      } catch (err: any) {
        setError(err.message || "Bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    })();
  }, [videoId]);

  // 2) server’a snapshot kaydet (deltaSeconds + lastPositionSec)
  async function saveWatchSnapshot(isCompleted?: boolean) {
    if (!videoId) return;

    const acc = Math.max(0, watchedAccRef.current);
    const delta = Math.max(0, acc - lastSentAccRef.current);

    // pos
    let lastPositionSec = Math.max(0, Math.floor(lastPosRef.current));

    // ✅ tamamlandı gönderiyorsak: pozisyonu süreye yaklaştır (tolerans sorununu bitirir)
    if (isCompleted) {
      const dur = Number(data?.video?.durationSeconds || 0);
      if (dur > 0) lastPositionSec = Math.max(lastPositionSec, Math.floor(dur));
    }

    // çok küçük hareketleri spamleme (ended/complete hariç)
    if (!isCompleted && delta < 0.5 && lastPositionSec <= 0) return;

    // gönderiyorsak lastSent güncelle
    lastSentAccRef.current = acc;

    await fetch(`/api/videos/${videoId}/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deltaSeconds: delta,
        lastPositionSec,
        isCompleted: !!isCompleted,
      }),
    }).catch(() => {});
  }

  // 3) tick start/stop (PLAY sırasında akar)
  function startTick() {
    if (tickRef.current) return;
    lastTickTimeRef.current = Date.now();

    tickRef.current = window.setInterval(async () => {
      const now = Date.now();
      const deltaSec = Math.max(0, (now - lastTickTimeRef.current) / 1000);
      lastTickTimeRef.current = now;

      watchedAccRef.current += deltaSec;

      // her ~10 saniyede bir snapshot (bucket)
      const bucket = Math.floor(watchedAccRef.current / 10);
      const lastBucket = Math.floor(lastSentAccRef.current / 10);
      if (bucket !== lastBucket) {
        await saveWatchSnapshot(false);
      }
    }, 2000);
  }

  function stopTick() {
    if (!tickRef.current) return;
    window.clearInterval(tickRef.current);
    tickRef.current = null;
  }

  // 4) YouTube init
  useEffect(() => {
    if (!isYT || !ytId) return;

    const scriptId = "yt-iframe-api";

    function loadScript() {
      return new Promise<void>((resolve) => {
        const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (existing) return resolve();

        const tag = document.createElement("script");
        tag.id = scriptId;
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
        resolve();
      });
    }

    let destroyed = false;

    (async () => {
      await loadScript();

      if (!window.YT || !window.YT.Player) {
        await new Promise<void>((resolve) => {
          window.onYouTubeIframeAPIReady = () => resolve();
        });
      }

      if (destroyed) return;

      playerRef.current = new window.YT.Player("yt-player", {
        videoId: ytId,
        playerVars: { modestbranding: 1, rel: 0 },
        events: {
          onReady: (ev: any) => {
            // kaldığı yerden devam
            const start = data?.progress?.lastPositionSec ?? 0;
            if (start > 3) {
              try {
                ev.target.seekTo(start, true);
              } catch {}
            }
          },
          onStateChange: async (ev: any) => {
            // 1 playing, 2 paused, 0 ended
            if (ev.data === 1) {
              startTick();
            } else if (ev.data === 2) {
              stopTick();
              try {
                const pos = playerRef.current?.getCurrentTime?.();
                if (typeof pos === "number") lastPosRef.current = pos;
              } catch {}
              await saveWatchSnapshot(false);
            } else if (ev.data === 0) {
              // ended
              stopTick();
              try {
                const dur = playerRef.current?.getDuration?.();
                const pos = playerRef.current?.getCurrentTime?.();
                if (typeof dur === "number" && dur > 0) lastPosRef.current = dur;
                else if (typeof pos === "number") lastPosRef.current = pos;
              } catch {}

              await saveWatchSnapshot(true); // ✅ server tamamlar
              await goSurveyOrDashboard();
            }
          },
        },
      });
    })();

    return () => {
      destroyed = true;
      stopTick();
      saveWatchSnapshot(false);
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYT, ytId, data?.progress?.lastPositionSec]);

  // 5) Survey yönlendirme helper
  async function goSurveyOrDashboard() {
    const res = await fetch(`/api/videos/${videoId}/survey`, {
      cache: "no-store",
    });

    const json = await res.json(); 

    console.log("Survey kontrol JSON:", json);

    if (json.surveyId && json.alreadyFilled === false) {
      console.log("➡️ Survey'e yönlendiriliyor:", json.surveyId);
      router.push(`/surveys/${json.surveyId}`);
      return;
    }

    console.log("➡️ Dashboard'a yönlendiriliyor");
    router.push("/dashboard");
  }

  // 6) Kullanıcı butona basarsa:
  // - video bitmese bile snapshot al
  // - survey’e yönlendir
  async function handleCompleteClick() {
    console.log("Tamamla butonuna basıldı");
    if (!videoId || saving) return;

    setSaving(true);
    setError(null);

    try {
      if (!isYT) {
        const el = nativeVideoRef.current;
        if (el) lastPosRef.current = Number(el.currentTime || 0);
      } else {
        const p = playerRef.current?.getCurrentTime?.();
        if (typeof p === "number") lastPosRef.current = p;
      }

      stopTick();

      const dur = Number(data?.video?.durationSeconds || 0);
      const pos = Number(lastPosRef.current || 0);
      const tol = 5;
      const reachedEnd = dur > 0 && pos >= Math.max(0, dur - tol);

      await saveWatchSnapshot(reachedEnd); // ✅
      console.log("Snapshot kaydedildi, survey/dashboard’a yönlendiriliyor...");
      await goSurveyOrDashboard();
    } finally {
      setSaving(false);
    }
  }

  // 7) Native ended
  async function handleEndedNative() {
    if (endedOnceRef.current) return;
    endedOnceRef.current = true;

    stopTick();

    try {
      const el = nativeVideoRef.current;
      if (el?.duration) lastPosRef.current = el.duration;
    } catch {}

    await saveWatchSnapshot(true); // ✅ server tamamlar
    await goSurveyOrDashboard();
  }

  // 8) Unmount safety
  useEffect(() => {
    return () => {
      stopTick();
      saveWatchSnapshot(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UI states
  if (loading) {
    return (
      <div className="app-shell">
        <div className="app-main">Yükleniyor...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="app-shell">
        <div className="app-main">
          <div className="dashboard-card">
            <h1>Video yüklenirken bir sorun oluştu</h1>
            <p style={{ marginTop: "0.5rem", color: "#b91c1c" }}>{error || "Video bulunamadı."}</p>
            <button type="button" onClick={() => router.push("/dashboard")}>
              ← Dashboard’a dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  const minutes =
    typeof data.video.durationSeconds === "number" && !isNaN(data.video.durationSeconds)
      ? Math.round(data.video.durationSeconds / 60)
      : null;

  const isCompleted = data.progress?.isCompleted ?? false;

  return (
    <div className="app-shell">
      <div className="app-main">
        <div className="video-page-header">
          <button type="button" className="video-back-link" onClick={() => router.push("/dashboard")}>
            ← Dashboard’a dön
          </button>
          <div className="video-title-block">
            <p className="video-section-label">Bölüm {data.video.order}</p>
            <h1 className="video-main-title">{data.video.title}</h1>
          </div>
        </div>

        <div className="video-layout">
          <section className="video-card">
            <div className="video-player-wrapper">
              {isYT ? (
                <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 16, overflow: "hidden" }}>
                  <div id="yt-player" style={{ width: "100%", height: "100%" }} />
                </div>
              ) : (
                <video
                  ref={nativeVideoRef}
                  className="video-player"
                  src={videoUrl || undefined}
                  controls
                  onPlay={() => startTick()}
                  onPause={async () => {
                    stopTick();
                    try {
                      const el = nativeVideoRef.current;
                      if (el) lastPosRef.current = Number(el.currentTime || 0);
                    } catch {}
                    await saveWatchSnapshot(false);
                  }}
                  onTimeUpdate={(e) => {
                    lastPosRef.current = Number(e.currentTarget.currentTime || 0);
                  }}
                  onEnded={handleEndedNative}
                >
                  Tarayıcınız video oynatmayı desteklemiyor.
                </video>
              )}
            </div>

            {data.video.description && <p className="video-description">{data.video.description}</p>}
          </section>

          <aside className="video-meta-card">
            <h2 className="video-meta-title">Eğitim Özeti</h2>
            <dl className="video-meta-list">
              <div className="video-meta-row">
                <dt>Süre</dt>
                <dd>{minutes !== null ? `${minutes} dakika` : "—"}</dd>
              </div>
              <div className="video-meta-row">
                <dt>Durum</dt>
                <dd>{isCompleted ? "Tamamlandı" : "Devam ediyor"}</dd>
              </div>
            </dl>

            <button type="button" onClick={handleCompleteClick} disabled={saving} className="video-complete-btn">
              {saving ? "Kaydediliyor..." : "Eğitimi Tamamla"}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}