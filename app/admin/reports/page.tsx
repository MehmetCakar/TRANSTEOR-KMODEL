// app/admin/reports/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ReportRow = {
  user: { id: string; email: string };
  watch: {
    watchedSeconds: number;
    durationSeconds: number;
    watchedPct: number;
    isCompleted: boolean;
    finishedAt: string | null;
  };
  survey: {
    surveyId: string | null;
    title: string | null;
    hasSurvey: boolean;
    filled?: boolean;
    total?: number;
    correct?: number;
    wrong?: number;
    scorePct?: number;
  };
};

type ReportItem = {
  video: { id: string; order: number; title: string; durationSeconds: number };
  users: ReportRow[];
};

function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m} dk ${r} sn`;
}

export default function AdminReportsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [report, setReport] = useState<ReportItem[]>([]);

  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // detail
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  async function loadReport() {
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error || "Rapor alınamadı");
        setReport([]);
        return;
      }
      const list: ReportItem[] = json.report || [];
      setReport(list);

      if (!selectedVideoId && list[0]?.video?.id) {
        setSelectedVideoId(list[0].video.id);
      }
    } catch (e: any) {
      setMsg(e?.message || "Rapor alınamadı");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(videoId: string, userId: string) {
    if (!videoId || !userId) return;
    setDetailLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/reports/user?videoId=${videoId}&userId=${userId}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error || "Detay alınamadı");
        setDetail(null);
        return;
      }
      setDetail(json);
    } catch (e: any) {
      setMsg(e?.message || "Detay alınamadı");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      // admin guard
      const r = await fetch("/api/admin/videos");
      if (r.status === 401 || r.status === 403) {
        router.push("/dashboard");
        return;
      }
      await loadReport();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedVideo = useMemo(
    () => report.find((x) => x.video.id === selectedVideoId) || null,
    [report, selectedVideoId]
  );

  const rows = selectedVideo?.users || [];

  // seçili video değişince kullanıcı seçimini resetle
  useEffect(() => {
    setSelectedUserId("");
    setDetail(null);
  }, [selectedVideoId]);

  // kullanıcı seçilince detail çek
  useEffect(() => {
    if (selectedVideoId && selectedUserId) {
      loadDetail(selectedVideoId, selectedUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideoId, selectedUserId]);

  return (
    <div className="app-shell">
      <div className="app-main">
        <div
          className="dashboard-card"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Admin Raporları</h1>
            <p style={{ marginTop: 6, opacity: 0.75 }}>Bölüm bazlı izleme + anket sonuçları (email ile)</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="dashboard-primary-btn" type="button" onClick={() => router.push("/admin")}>
              ← Admin Panel
            </button>
            <button className="dashboard-primary-btn" type="button" onClick={loadReport}>
              Yenile
            </button>
          </div>
        </div>

        {msg && (
          <div className="dashboard-card" style={{ marginTop: 12, borderColor: "rgba(239,68,68,.25)" }}>
            <b style={{ color: "#b91c1c" }}>{msg}</b>
          </div>
        )}

        {loading ? (
          <div className="dashboard-card" style={{ marginTop: 12 }}>
            Yükleniyor...
          </div>
        ) : (
          <div className="reports-grid" style={{ marginTop: 12 }}>
            {/* LEFT: video list */}
            <div className="dashboard-card">
              <h2 style={{ marginTop: 0 }}>Bölümler</h2>
              <div className="list">
                {report.map((it) => {
                  const active = it.video.id === selectedVideoId;
                  return (
                    <button
                      key={it.video.id}
                      type="button"
                      className={`list-item ${active ? "active" : ""}`}
                      onClick={() => setSelectedVideoId(it.video.id)}
                    >
                      <div style={{ fontWeight: 900 }}>Bölüm {it.video.order}</div>
                      <div style={{ opacity: 0.75, fontSize: 13 }}>{it.video.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MIDDLE: users */}
            <div className="dashboard-card">
              <h2 style={{ marginTop: 0 }}>
                {selectedVideo ? `Bölüm ${selectedVideo.video.order} — Katılımcılar` : "Katılımcılar"}
              </h2>

              {!selectedVideo ? (
                <div style={{ opacity: 0.7 }}>Bir bölüm seç.</div>
              ) : (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Kullanıcı</th>
                        <th>İzleme</th>
                        <th>Survey</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const active = r.user.id === selectedUserId;
                        const dur = r.watch.durationSeconds || 0;
                        const watched = r.watch.watchedSeconds || 0;

                        return (
                          <tr
                            key={r.user.id}
                            className={active ? "row-active" : ""}
                            onClick={() => setSelectedUserId(r.user.id)}
                            style={{ cursor: "pointer" }}
                          >
                            <td>
                              <div style={{ fontWeight: 800 }}>{r.user.email}</div>
                              <div style={{ fontSize: 12, opacity: 0.7 }}>
                                {r.watch.isCompleted ? "✅ Completed" : "⏳ In progress"}
                              </div>
                            </td>

                            <td>
                              <div style={{ fontWeight: 800 }}>{r.watch.watchedPct}%</div>
                              <div style={{ fontSize: 12, opacity: 0.7 }}>
                                {fmtTime(watched)} / {fmtTime(dur)}
                              </div>
                              <div className="mini-bar">
                                <div className="mini-bar-fill" style={{ width: `${r.watch.watchedPct}%` }} />
                              </div>
                            </td>

                            <td>
                              {!r.survey.hasSurvey ? (
                                <span style={{ opacity: 0.7 }}>—</span>
                              ) : r.survey.filled ? (
                                <div>
                                  <div style={{ fontWeight: 900 }}>{r.survey.scorePct}%</div>
                                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                                    {r.survey.correct}D / {r.survey.wrong}Y
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: "#b45309", fontWeight: 800 }}>Doldurulmadı</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={3} style={{ padding: 14, opacity: 0.7 }}>
                            Henüz kullanıcı yok.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* RIGHT: detail */}
            <div className="dashboard-card">
              <h2 style={{ marginTop: 0 }}>Detay</h2>

              {!selectedVideoId || !selectedUserId ? (
                <div style={{ opacity: 0.7 }}>Bir kullanıcı seç.</div>
              ) : detailLoading ? (
                <div>Detay yükleniyor...</div>
              ) : !detail?.ok ? (
                <div style={{ opacity: 0.7 }}>Detay alınamadı.</div>
              ) : (
                <div className="detail">
                  <div className="detail-block">
                    <div style={{ fontWeight: 900 }}>{detail.user.email}</div>
                    <div style={{ opacity: 0.75, fontSize: 13 }}>
                      Bölüm {detail.video.order} — {detail.video.title}
                    </div>
                  </div>

                  <div className="detail-block">
                    <h3 style={{ margin: 0, fontSize: 14 }}>İzleme</h3>
                    <div style={{ marginTop: 8 }}>
                     İzlenen: <b>{fmtTime(Number(detail.watchSummary?.watchedSeconds || 0))}</b> /{" "}
                    <b>{fmtTime(Number(detail.watchSummary?.durationSeconds || 0))}</b>
                    </div>
                    <div style={{ marginTop: 6 }}>
                         Completed: <b>{detail.watchSummary?.isCompleted ? "Evet" : "Hayır"}</b>
                    </div>
                  </div>

                  <div className="detail-block">
                    <h3 style={{ margin: 0, fontSize: 14 }}>Anket</h3>

                    {!detail.survey ? (
                      <div style={{ marginTop: 8, opacity: 0.7 }}>Bu bölüm için anket yok.</div>
                    ) : !detail.response ? (
                      <div style={{ marginTop: 8, color: "#b45309", fontWeight: 900 }}>Doldurulmadı</div>
                    ) : (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 900 }}>{detail.survey.title}</div>

                        {/* ✅ YENİ: Genel sonuç (6 doğru / 4 yanlış / %60) */}
                        {detail.stats && (
                          <div className="survey-summary">
                            <div className="sum-pill">
                              ✅ <b>{detail.stats.correct}</b> Doğru
                            </div>
                            <div className="sum-pill">
                              ❌ <b>{detail.stats.wrong}</b> Yanlış
                            </div>
                            <div className="sum-pill">
                              🎯 <b>{detail.stats.scorePct}%</b> Skor
                            </div>
                          </div>
                        )}

                        {/* ✅ Soru-soru kısmı aynı kaldı */}
                        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                          {(detail.survey.questions || []).map((q: any) => {
                            const answers: any[] = Array.isArray(detail.response.answers) ? detail.response.answers : [];
                            const a = answers.find((x) => x.questionId === q.id);
                            const chosen = a ? q.options.find((o: any) => o.id === a.optionId) : null;
                            const correct = q.options.find((o: any) => o.isCorrect) || null;

                            const isCorrect = chosen && correct && chosen.id === correct.id;

                            return (
                              <div key={q.id} className="qa">
                                <div style={{ fontWeight: 800 }}>
                                  {q.order}. {q.text}
                                </div>
                                <div style={{ marginTop: 6, fontSize: 13 }}>
                                  Seçilen:{" "}
                                  <b style={{ color: isCorrect ? "#166534" : "#b91c1c" }}>
                                    {chosen ? chosen.text : "(cevap yok)"}
                                  </b>
                                </div>
                                <div style={{ marginTop: 2, fontSize: 13, opacity: 0.85 }}>
                                  Doğru: <b>{correct ? correct.text : "(tanımlı değil)"}</b>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <Style />
      </div>
    </div>
  );
}

function Style() {
  return (
    <style jsx global>{`
      .reports-grid {
        display: grid;
        grid-template-columns: 1fr 1.6fr 1.2fr;
        gap: 14px;
        align-items: start;
      }

      .list {
        display: grid;
        gap: 10px;
      }

      .list-item {
        text-align: left;
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: rgba(255, 255, 255, 0.92);
        padding: 12px;
        border-radius: 16px;
        cursor: pointer;
        transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
      }
      .list-item:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        border-color: rgba(79, 70, 229, 0.35);
      }
      .list-item.active {
        border-color: rgba(79, 70, 229, 0.65);
        background: rgba(99, 102, 241, 0.08);
      }

      .table-wrap {
        overflow: auto;
      }

      .tbl {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }
      .tbl th {
        text-align: left;
        font-size: 12px;
        opacity: 0.7;
        padding: 10px 10px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.12);
      }
      .tbl td {
        padding: 12px 10px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        vertical-align: top;
      }
      .tbl tr:hover td {
        background: rgba(99, 102, 241, 0.06);
      }
      .row-active td {
        background: rgba(99, 102, 241, 0.10);
      }
        .dashboard-primary-btn{
        background: transparent;
        border: none;
        color: #4f46e5;
        cursor: pointer;
        font-weight: 700;
        padding: 6px 8px;
        border-radius: 10px;
        }
        .dashboard-primary-btn:hover{
        background: rgba(79, 70, 229, 0.08);
        }

      .mini-bar {
        margin-top: 6px;
        height: 8px;
        background: rgba(15, 23, 42, 0.08);
        border-radius: 999px;
        overflow: hidden;
      }
      .mini-bar-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #6366f1, #22d3ee);
      }

      .detail {
        display: grid;
        gap: 12px;
      }

      .detail-block {
        padding: 12px;
        border: 1px solid rgba(15, 23, 42, 0.1);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.92);
      }

      .qa {
        padding: 10px;
        border-radius: 14px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: rgba(255, 255, 255, 0.9);
      }

      /* ✅ yeni özet pill tasarımı */
      .survey-summary {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .sum-pill {
        padding: 8px 10px;
        border-radius: 999px;
        border: 1px solid rgba(15, 23, 42, 0.1);
        background: rgba(99, 102, 241, 0.08);
        font-size: 13px;
        font-weight: 700;
      }

      @media (max-width: 1100px) {
        .reports-grid {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}