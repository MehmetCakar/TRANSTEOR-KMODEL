"use client";

import { useEffect, useState } from "react";

type Video = { id: string; order: number; title: string; isActive: boolean };
type Survey = {
  id: string;
  title: string;
  type: "PRE" | "POST" | "FOLLOWUP" | "VIDEO";
  isActive: boolean;
  videoId: string | null;
  video?: Video | null;
  questions: { id: string; order: number; text: string }[];
  _count?: { responses: number };
};

export default function AdminSurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Survey["type"]>("VIDEO");
  const [videoId, setVideoId] = useState<string>("");

  async function refresh() {
    setErr(null);

    const [sRes, vRes] = await Promise.all([
      fetch("/api/admin/surveys"),
      fetch("/api/admin/videos"),
    ]);

    const sJson = await sRes.json().catch(() => ({}));
    const vJson = await vRes.json().catch(() => ({}));

    if (!sRes.ok) return setErr(sJson.error || "Surveys yüklenemedi");
    if (!vRes.ok) return setErr(vJson.error || "Videolar yüklenemedi");

    setSurveys(sJson.surveys || []);
    setVideos(vJson.videos || []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createSurvey() {
    setErr(null);
    const payload: any = { title, type, isActive: true };
    if (type === "VIDEO") payload.videoId = videoId || null;

    const res = await fetch("/api/admin/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(json.error || "Oluşturulamadı");

    setTitle(""); setType("VIDEO"); setVideoId("");
    refresh();
  }

  async function toggleActive(s: Survey) {
    await fetch(`/api/admin/surveys/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    refresh();
  }

  async function removeSurvey(id: string) {
    if (!confirm("Anket silinsin mi? (Sorularla birlikte)")) return;
    await fetch(`/api/admin/surveys/${id}`, { method: "DELETE" });
    refresh();
  }

  async function addQuestion(surveyId: string) {
    const orderStr = prompt("Soru sırası (1,2,3..):");
    const text = prompt("Soru metni:");
    if (!orderStr || !text) return;

    const res = await fetch(`/api/admin/surveys/${surveyId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: Number(orderStr), text }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json.error || "Soru eklenemedi");
    refresh();
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="dashboard-hero">
          <div className="dashboard-pill">Admin • Anketler</div>
          <h1>Anketleri Yönet</h1>
          <p className="dashboard-hero-sub">8 VIDEO + 1 FOLLOWUP anketi burada kuracağız.</p>
          <a href="/admin" style={{ fontSize: "0.85rem" }}>← Admin ana sayfa</a>
        </section>

        {err && (
          <div className="dashboard-card">
            <p style={{ color: "#b91c1c" }}>{err}</p>
          </div>
        )}

        <section className="dashboard-grid">
          <article className="dashboard-card">
            <h2>Yeni Anket Oluştur</h2>

            <div style={{ display: "grid", gap: 10 }}>
              <input className="auth-input" placeholder="Anket başlığı" value={title} onChange={(e) => setTitle(e.target.value)} />

              <select className="auth-input" value={type} onChange={(e) => setType(e.target.value as any)}>
                <option value="VIDEO">VIDEO (her videonun anketi)</option>
                <option value="FOLLOWUP">FOLLOWUP (6 ay sonrası)</option>
                <option value="PRE">PRE</option>
                <option value="POST">POST</option>
              </select>

              {type === "VIDEO" && (
                <select className="auth-input" value={videoId} onChange={(e) => setVideoId(e.target.value)}>
                  <option value="">Video seç</option>
                  {videos
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.order}. {v.title}
                      </option>
                    ))}
                </select>
              )}

              <button className="auth-button" type="button" onClick={createSurvey}>
                Oluştur
              </button>

              <p style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Not: VIDEO anketlerinde videoId benzersiz olduğu için aynı videoya ikinci anket eklenemez.
              </p>
            </div>
          </article>

          <article className="dashboard-card">
            <h2>Mevcut Anketler</h2>

            <div style={{ display: "grid", gap: 10 }}>
              {surveys.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: "0.9rem",
                    borderRadius: "0.9rem",
                    border: "1px solid rgba(148, 163, 184, 0.35)",
                    background: "rgba(255,255,255,0.75)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>
                        {s.title} <span style={{ fontSize: "0.8rem", color: "#64748b" }}>({s.type})</span>
                      </div>

                      {s.type === "VIDEO" && (
                        <div style={{ fontSize: "0.82rem", color: "#475569" }}>
                          Video: {s.video ? `${s.video.order}. ${s.video.title}` : s.videoId}
                        </div>
                      )}

                      <div style={{ fontSize: "0.8rem", color: s.isActive ? "#16a34a" : "#b45309" }}>
                        {s.isActive ? "Aktif" : "Pasif"} • {s.questions?.length ?? 0} soru • {s._count?.responses ?? 0} yanıt
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button className="auth-button" type="button" onClick={() => addQuestion(s.id)} style={{ padding: "0.55rem 0.9rem" }}>
                        Soru ekle
                      </button>
                      <button className="auth-button" type="button" onClick={() => toggleActive(s)} style={{ padding: "0.55rem 0.9rem" }}>
                        {s.isActive ? "Pasif yap" : "Aktif yap"}
                      </button>
                      <button className="auth-button" type="button" onClick={() => removeSurvey(s.id)} style={{ padding: "0.55rem 0.9rem", background: "#ef4444" }}>
                        Sil
                      </button>
                    </div>
                  </div>

                  {/* sorular */}
                  {s.questions?.length > 0 && (
                    <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                      {s.questions.map((q) => (
                        <div key={q.id} style={{ fontSize: "0.85rem", color: "#334155" }}>
                          <b>{q.order}.</b> {q.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}