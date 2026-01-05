// app/video/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

type VideoData = {
  id: string;
  order: number;
  title: string;
  description: string | null;
  url: string;
  durationSeconds: number;
  watchedSeconds: number;
  isCompleted: boolean;
};

export default function VideoPage() {
  const router = useRouter();

  // ✅ Next 14/15: params için useParams kullan
  const params = useParams<{ id: string }>();
  const videoId = params?.id;

  const [data, setData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Eğer herhangi bir sebeple id yoksa
  useEffect(() => {
    if (!videoId) {
      setError("Video bulunamadı (geçersiz adres).");
      setLoading(false);
    }
  }, [videoId]);

  // Video bilgisini çek
  useEffect(() => {
    if (!videoId) return;

    (async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Video bilgisi alınamadı.");
        } else {
          setData(json);
        }
      } catch (err: any) {
        setError(err.message || "Bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    })();
  }, [videoId]);

  async function handleComplete() {
    if (!data) return;
    setSaving(true);
    setError(null);

      try {
    // 1) videoyu tamamlandı olarak işaretle
    await fetch(`/api/videos/${videoId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        watchedSeconds: data.durationSeconds,
        isCompleted: true,
      }),
    });

    // 2) bu videoya bağlı survey var mı?
    const res = await fetch(`/api/videos/${videoId}/survey`);
    const json = await res.json();

    if (json.surveyId && !json.alreadyFilled) {
      router.push(`/survey/${json.surveyId}`);
    } else {
      // anket yoksa veya daha önce doldurmuşsa
      router.push("/dashboard");
    }
  } catch (e) {
    console.error(e);
    alert("Bir hata oluştu. Lütfen tekrar deneyin.");
  } finally {
      setSaving(false);
    }
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
  typeof data.durationSeconds === "number" && !isNaN(data.durationSeconds)
    ? Math.round(data.durationSeconds / 60)
    : null;

  return (
    <div className="app-shell">
      <div className="app-main">
        {/* Üst başlık ve breadcrumb */}
        <div className="video-page-header">
          <button
            type="button"
            className="video-back-link"
            onClick={() => router.push("/dashboard")}
          >
            ← Dashboard’a dön
          </button>

          <div className="video-title-block">
            <p className="video-section-label">Bölüm {data.order}</p>
            <h1 className="video-main-title">{data.title}</h1>
            <p className="video-subtitle">
              Evlilik öncesi riskli cinsel davranışlar eğitimi – Bölüm {data.order}
            </p>
          </div>
        </div>

        {/* Ana düzen: video + yan bilgiler */}
        <div className="video-layout">
          {/* Sol: Video kartı */}
          <section className="video-card">
            <div className="video-player-wrapper">
              <video
                className="video-player"
                src={data.url}
                controls
                controlsList="nodownload"
              >
                Tarayıcınız video oynatmayı desteklemiyor.
              </video>
            </div>

            {data.description && (
              <p className="video-description">{data.description}</p>
            )}
          </section>

          {/* Sağ: Bilgi kartı */}
          <aside className="video-meta-card">
            <h2 className="video-meta-title">Eğitim Özeti</h2>

            <dl className="video-meta-list">
              <div className="video-meta-row">
                <dt>Süre</dt>
                <dd>{minutes !== null ? `${minutes} dakika` : "—"}</dd>
              </div>
              <div className="video-meta-row">
                <dt>Durum</dt>
                <dd>{data.isCompleted ? "Tamamlandı" : "Devam ediyor"}</dd>
              </div>
            </dl>

            <p className="video-meta-note">
              Videoyu izlerken istediğin zaman duraklatabilir, kendine alan
              tanıyabilirsin. Amaç, seni zorlamak değil; yavaş yavaş bilgiyle
              güçlendirmek. 💙
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