// app/video/[id]/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";

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
  } | null;
};

export default function VideoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const videoId = params?.id;

  const [data, setData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endedOnceRef = useRef(false);

  useEffect(() => {
    if (!videoId) {
      setError("Video bulunamadı (geçersiz adres).");
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;

    (async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}`);
        const json = await res.json();
        if (!res.ok) setError(json.error || "Video bilgisi alınamadı.");
        else setData(json);
      } catch (err: any) {
        setError(err.message || "Bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    })();
  }, [videoId]);

  async function handleComplete() {
    if (!videoId || !data) return;
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      // 1) videoyu tamamlandı işaretle
      await fetch(`/api/videos/${videoId}`, { method: "POST" });

      // 2) bu videonun anketi var mı?
      const res = await fetch(`/api/videos/${videoId}/survey`);
      const json = await res.json();

      if (json.surveyId && !json.alreadyFilled) {
        router.push(`/survey/${json.surveyId}`);
      } else {
        router.push("/dashboard");
      }
    } catch (e: any) {
      console.error(e);
      alert("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  // ✅ Video bitince otomatik çalışacak
  async function handleEnded() {
    if (endedOnceRef.current) return;
    endedOnceRef.current = true;
    await handleComplete();
  }

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
          <div className="video-page-header">
            <button
              type="button"
              className="video-back-link"
              onClick={() => router.push("/dashboard")}
            >
              ← Dashboard’a dön
            </button>
          </div>
          <div className="dashboard-card">
            <h1>Video yüklenirken bir sorun oluştu</h1>
            <p style={{ marginTop: "0.5rem", color: "#b91c1c", fontSize: "0.9rem" }}>
              {error || "Video bulunamadı."}
            </p>
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
          <button
            type="button"
            className="video-back-link"
            onClick={() => router.push("/dashboard")}
          >
            ← Dashboard’a dön
          </button>

          <div className="video-title-block">
            <p className="video-section-label">Bölüm {data.video.order}</p>
            <h1 className="video-main-title">{data.video.title}</h1>
            <p className="video-subtitle">
              Evlilik öncesi riskli cinsel davranışlar eğitimi – Bölüm {data.video.order}
            </p>
          </div>
        </div>

        <div className="video-layout">
          <section className="video-card">
            <div className="video-player-wrapper">
              <video
                className="video-player"
                src={data.video.url || undefined}
                controls
                controlsList="nodownload"
                onEnded={handleEnded} // ✅ EKLENDİ
              >
                Tarayıcınız video oynatmayı desteklemiyor.
              </video>
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

            <p className="video-meta-note">
              Videoyu izlerken istediğin zaman duraklatabilir, kendine alan tanıyabilirsin.
              Amaç, seni zorlamak değil; yavaş yavaş bilgiyle güçlendirmek. 💙
            </p>

            <button
              type="button"
              onClick={handleComplete}
              disabled={saving}
              className="video-complete-btn"
            >
              {saving ? "Kaydediliyor..." : "Eğitimi Tamamla"}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}