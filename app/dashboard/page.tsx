// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PerVideoSurveyItem = {
  videoId: string;
  order: number;
  surveyId: string | null;
  title: string | null;
  completed: boolean;
};

type DashboardData = {
  email: string;
  videos: {
    total: number;
    completed: number;
    nextVideo: { id: string; order: number; title: string } | null;
  };
  surveys?: {
    perVideo?: {
      items?: PerVideoSurveyItem[];
      total?: number;
      completed?: number;
    };
    followup?: {
      surveyId: string | null;
      needed: boolean;
      title: string | null;
    };
  };
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

   async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
      router.push("/login");
    } catch (e) {
      console.error(e);
      alert("Çıkış yapılırken bir hata oluştu.");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Bir hata oluştu");
        } else {
          setData(json);
        }
      } catch (err: any) {
        setError(err.message || "Bir hata oluştu");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
          <div className="dashboard-hero">
            <div className="dashboard-pill">Akademik Araştırma Portalı</div>
            <h1>Hoş geldin 👋</h1>
            <p className="dashboard-hero-sub">
              Görünüşe göre oturumun yok. Eğitime devam etmek için lütfen giriş yap.
            </p>
          </div>
          <p style={{ color: "#dc2626" }}>{error}</p>
          <p>
            <a href="/login">Giriş yap</a>
          </p>
        </div>
      </div>
    );
  }

  const { email, videos, surveys } = data;
  const progress =
    videos.total > 0 ? Math.round((videos.completed / videos.total) * 100) : 0;

  // 🔹 Anket ilerlemesini S A D E C E anketlerden hesapla
  const perVideoItems = surveys?.perVideo?.items ?? [];
  const perVideoTotal =
    surveys?.perVideo?.total ?? perVideoItems.length ?? 0;
  const perVideoCompleted =
    surveys?.perVideo?.completed ??
    perVideoItems.filter((s) => s.completed).length ??
    0;

  const followup = surveys?.followup;
  const followupNeeded = followup?.needed ?? false;
  const followupSurveyId = followup?.surveyId ?? null;

  return (
    <div className="app-shell">
      <main className="app-main">
        {/* ÜST HERO */}
        <section className="dashboard-hero">


          
          <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginBottom: "0.8rem",
    }}
  >
    <div className="dashboard-pill">Akademik Araştırma Portalı</div>

    <button
      type="button"
      onClick={handleLogout}
      style={{
        fontSize: "0.8rem",
        padding: "0.45rem 0.9rem",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,0.6)",
        background: "rgba(219, 234, 254, 0.8)",
        boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
        cursor: "pointer",
        color: "#6366f1",
        whiteSpace: "nowrap",
      }}
    >
      Çıkış yap
    </button>
  </div>
          <h1>Hoş geldin 👋</h1>
          <p className="dashboard-hero-sub">
            Bu bölümden eğitim ilerlemeni ve anket durumunu takip edebilirsin.
            Amaç, kendini suçlu hissetmek değil; bilgiyle güçlenmek. 💙
          </p>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.8rem",
              color: "#6b7280",
            }}
          >
            Giriş yaptığın e-posta: <b>{email}</b>
          </p>

          
        </section>
        

        {/* ORTA KARTLAR */}
        <section className="dashboard-grid">
          {/* Videolar kartı */}
          <article className="dashboard-card">
            <h2 style={{ marginBottom: "0.5rem" }}>Videoların durumu</h2>
            <p
              className="dashboard-meta"
              style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: 8 }}
            >
              GENEL İLERLEME{" "}
              <strong>
                {videos.completed} / {videos.total}
              </strong>{" "}
              video
            </p>

            <div className="dashboard-progress-wrapper">
              <div
                className="dashboard-progress-label"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  color: "#6b7280",
                  marginBottom: 4,
                }}
              >
                <span>Genel ilerleme</span>
                <span>{progress}%</span>
              </div>
              <div
                className="dashboard-progress-bar"
                style={{
                  width: "100%",
                  height: 6,
                  borderRadius: 999,
                  background: "#e5e7eb",
                  overflow: "hidden",
                }}
              >
                <div
                  className="dashboard-progress-fill"
                  style={{
                    width: `${progress}%`,
                    height: "100%",
                    borderRadius: 999,
                    background:
                      "linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: "1.1rem" }}>
              {videos.nextVideo ? (
                <>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#6b7280",
                      marginBottom: 2,
                    }}
                  >
                    Sıradaki video:
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      marginBottom: "0.85rem",
                    }}
                  >
                    {videos.nextVideo.order}. {videos.nextVideo.title}
                  </div>
                  <a
                    href={`/video/${videos.nextVideo.id}`}
                    className="dashboard-primary-btn"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0.7rem 1.3rem",
                      borderRadius: 999,
                      background:
                        "linear-gradient(135deg, #6366f1, #3b82f6, #22c1c3)",
                      color: "#ffffff",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                    }}
                  >
                    Videoya devam et
                  </a>
                </>
              ) : (
                <p style={{ fontSize: "0.9rem" }}>
                  Tüm videoları tamamladın. Harika bir iş çıkardın! 🎉
                </p>
              )}
            </div>
          </article>

          {/* Anketler kartı */}
          <article className="dashboard-card">
            <h2 style={{ marginBottom: "0.6rem" }}>Anketler</h2>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#6b7280",
                marginBottom: "1rem",
              }}
            >
              Her videodan sonra gelen kısa anketler, eğitimin senin için
              ne kadar faydalı olduğunu bilimsel olarak değerlendirmemize
              yardımcı olur. Cevapların gizlidir.
            </p>

            <div
              className="dashboard-tag-row"
              style={{ display: "grid", gap: "0.8rem" }}
            >
              {/* Video sonu anketleri özeti */}
              <div
                className="survey-row"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.88rem",
                }}
              >
                <div className="survey-label">
                  <span className="survey-name" style={{ fontWeight: 600 }}>
                    Video Sonu Anketleri
                  </span>{" "}
                  <span
                    className="survey-badge"
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.15rem 0.55rem",
                      borderRadius: 999,
                      background: "#e0f2fe",
                      color: "#0369a1",
                      marginLeft: 6,
                    }}
                  >
                    {perVideoCompleted} / {perVideoTotal} tamamlandı
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                    Videolar ilerledikçe açılır
                  </span>
                </div>
              </div>

              {/* 6 ay sonrası anketi */}
              <div
                className="survey-row"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.88rem",
                }}
              >
                <div className="survey-label">
                  <span className="survey-name" style={{ fontWeight: 600 }}>
                    6 Ay Sonrası
                  </span>{" "}
                  <span
                    className="survey-badge"
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.15rem 0.55rem",
                      borderRadius: 999,
                      background: "#fef3c7",
                      color: "#92400e",
                      marginLeft: 6,
                    }}
                  >
                    {followupNeeded
                      ? "Bekliyor"
                      : "Tamamlandı / zamanı değil"}
                  </span>
                </div>
                <div>
                  {followupNeeded && followupSurveyId ? (
                    <a
                      className="survey-link"
                      href={`/survey/${followupSurveyId}`}
                      style={{ fontSize: "0.82rem" }}
                    >
                      Başla ↗️
                    </a>
                  ) : (
                    <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                      Zamanı geldiğinde açılacak
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: "0.9rem", textAlign: "right" }}>
              <a
                href="/surveys"
                className="survey-link"
                style={{ fontSize: "0.8rem" }}
              >
                Tüm anketleri gör ↗
              </a>
            </div>
          </article>
        </section>

        {/* ALT – DEĞİŞİM SÜRECİ BASAMAKLARI */}
        <section className="dashboard-stages">
          <div className="dashboard-stages-title">
            DEĞİŞİM SÜRECİ BASAMAKLARI
          </div>
          <p className="dashboard-stages-sub">
            Şu an için varsayılan olarak “Hazırlık” basamağındasın. Eğitim
            ilerledikçe bu kısım kişisel hale getirilebilir.
          </p>

          <div className="dashboard-stage-list">
            <div className="dashboard-stage-item">
              <span>1</span>
              Niyet Öncesi
            </div>
            <div className="dashboard-stage-item">
              <span>2</span>
              Niyet
            </div>
            <div className="dashboard-stage-item is-current">
              <span>3</span>
              Hazırlık
            </div>
            <div className="dashboard-stage-item">
              <span>4</span>
              Eylem
            </div>
            <div className="dashboard-stage-item">
              <span>5</span>
              Sürdürme
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}