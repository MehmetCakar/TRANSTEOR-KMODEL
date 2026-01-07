// app/surveys/page.tsx
"use client";

import { useEffect, useState } from "react";

type PerVideoSurveyItem = {
  videoId: string;
  order: number;
  surveyId: string | null;
  title: string | null;
  completed: boolean;
  videoCompleted: boolean;
};

type DashboardData = {
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

export default function SurveysPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Aynı dashboard API’sini kullanıyoruz
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (!res.ok) setError(json.error || "Bir hata oluştu");
        else setData(json);
      } catch (e: any) {
        setError(e.message || "Bir hata oluştu");
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
          <h1>Anketler</h1>
          <p style={{ color: "#dc2626" }}>{error}</p>
        </div>
      </div>
    );
  }

  const items =
    data.surveys?.perVideo?.items?.slice().sort((a, b) => a.order - b.order) ??
    [];

  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="dashboard-card">
          <h1 style={{ marginBottom: "0.75rem" }}>Video Sonu Anketleri</h1>
          <p
            style={{
              fontSize: "0.85rem",
              color: "#6b7280",
              marginBottom: "1.2rem",
            }}
          >
            Her videodan sonra kısa bir anket açılır. Videoyu bitirdikten sonra
            ilgili anketi buradan doldurabilirsin.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <th style={{ padding: "0.6rem 0.2rem" }}>Bölüm</th>
                  <th style={{ padding: "0.6rem 0.2rem" }}>Başlık</th>
                  <th style={{ padding: "0.6rem 0.2rem" }}>Durum</th>
                  <th style={{ padding: "0.6rem 0.2rem" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const locked = !item.videoCompleted;
                  const hasSurvey = !!item.surveyId;

                  let statusBadge;
                  if (!hasSurvey) {
                    statusBadge = (
                      <span style={{ color: "#9ca3af" }}>
                        Bu video için anket yok
                      </span>
                    );
                  } else if (item.completed) {
                    statusBadge = (
                      <span
                        style={{
                          padding: "0.15rem 0.6rem",
                          borderRadius: 999,
                          background: "#dcfce7",
                          color: "#15803d",
                          fontSize: "0.75rem",
                        }}
                      >
                        Tamamlandı
                      </span>
                    );
                  } else if (locked) {
                    statusBadge = (
                      <span
                        style={{
                          padding: "0.15rem 0.6rem",
                          borderRadius: 999,
                          background: "#fee2e2",
                          color: "#b91c1c",
                          fontSize: "0.75rem",
                        }}
                      >
                        Önce videoyu tamamla
                      </span>
                    );
                  } else {
                    statusBadge = (
                      <span
                        style={{
                          padding: "0.15rem 0.6rem",
                          borderRadius: 999,
                          background: "#fef3c7",
                          color: "#92400e",
                          fontSize: "0.75rem",
                        }}
                      >
                        Bekliyor
                      </span>
                    );
                  }

                  let action: React.ReactNode = null;
                  if (!hasSurvey) {
                    action = (
                      <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                        —
                      </span>
                    );
                  } else if (locked) {
                    action = (
                      <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                        Videoyu bitirince açılacak
                      </span>
                    );
                  } else if (item.completed) {
                    action = (
                      <a
                        href={`/survey/${item.surveyId}`}
                        style={{ fontSize: "0.8rem" }}
                      >
                        Cevapları gör ↗
                      </a>
                    );
                  } else {
                    action = (
                      <a
                        href={`/survey/${item.surveyId}`}
                        style={{ fontSize: "0.8rem" }}
                      >
                        Ankete başla ↗
                      </a>
                    );
                  }

                  return (
                    <tr key={item.videoId}>
                      <td style={{ padding: "0.55rem 0.2rem" }}>
                        Bölüm {item.order}
                      </td>
                      <td style={{ padding: "0.55rem 0.2rem" }}>
                        {item.title || `Video ${item.order} anketi`}
                      </td>
                      <td style={{ padding: "0.55rem 0.2rem" }}>
                        {statusBadge}
                      </td>
                      <td style={{ padding: "0.55rem 0.2rem" }}>{action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}