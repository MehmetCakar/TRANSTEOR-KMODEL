"use client";

import { useEffect, useState } from "react";

type Video = {
  id: string;
  order: number;
  title: string;
  description: string | null;
  url: string;
  durationSeconds: number;
  isActive: boolean;
};

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    order: 1,
    title: "",
    description: "",
    url: "",
    durationSeconds: 600,
    isActive: true,
  });

  async function load() {
    setError(null);
    const res = await fetch("/api/admin/videos");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Hata");
    setVideos(json.videos || []);
  }

  useEffect(() => { load(); }, []);

  async function createVideo() {
    setError(null);
    const res = await fetch("/api/admin/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        description: form.description.trim() ? form.description.trim() : null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Hata");
    setForm((f) => ({ ...f, title: "", description: "", url: "" }));
    await load();
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="dashboard-card">
          <h1 style={{ marginBottom: "0.75rem" }}>Video Yönetimi</h1>
          {error && <p style={{ color: "#dc2626" }}>{error}</p>}

          <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
            <input placeholder="Sıra (1-8)" value={form.order}
              onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
            <input placeholder="Başlık" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input placeholder="URL (şimdilik link)" value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <input placeholder="Süre (sn)" value={form.durationSeconds}
              onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) })} />
            <input placeholder="Açıklama (opsiyonel)" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />

            <button className="dashboard-primary-btn" type="button" onClick={createVideo}>
              Video Ekle
            </button>
          </div>

          <hr style={{ margin: "1rem 0" }} />

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "0.5rem" }}>#</th>
                  <th style={{ padding: "0.5rem" }}>Başlık</th>
                  <th style={{ padding: "0.5rem" }}>Aktif</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v.id}>
                    <td style={{ padding: "0.5rem" }}>{v.order}</td>
                    <td style={{ padding: "0.5rem" }}>{v.title}</td>
                    <td style={{ padding: "0.5rem" }}>{v.isActive ? "Evet" : "Hayır"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </section>
      </main>
    </div>
  );
}