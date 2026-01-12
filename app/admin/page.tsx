"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>("");

  // video form state
  const [order, setOrder] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number>(60);
  const [description, setDescription] = useState("");

  // survey form state
  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyType, setSurveyType] = useState<"VIDEO" | "FOLLOWUP">("VIDEO");
  const [surveyVideoId, setSurveyVideoId] = useState<string>("");
  const [questionsText, setQuestionsText] = useState<string>("1) Soru 1\n2) Soru 2");

  async function loadVideos() {
    setMsg("");
    const res = await fetch("/api/admin/videos");
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error || "Videolar alınamadı (admin misin?)");
      return;
    }
    setVideos(json.videos || []);
    if (!surveyVideoId && (json.videos?.[0]?.id)) setSurveyVideoId(json.videos[0].id);
  }

  useEffect(() => {
    loadVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createVideo() {
    setMsg("");
    const res = await fetch("/api/admin/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order, title, url, durationSeconds, description }),
    });
    const json = await res.json();
    if (!res.ok) return setMsg(json.error || "Video eklenemedi");
    setMsg("✅ Video eklendi");
    setTitle(""); setUrl(""); setDescription("");
    await loadVideos();
  }

  function parseQuestions(input: string) {
    // "1) ...\n2) ..." formatını parse eder
    return input
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, idx) => {
        const m = line.match(/^(\d+)\)\s*(.*)$/);
        if (m) return { order: Number(m[1]), text: m[2] };
        return { order: idx + 1, text: line };
      })
      .filter((q) => q.order && q.text);
  }

  async function createSurvey() {
    setMsg("");
    const questions = parseQuestions(questionsText);

    const payload: any = {
      type: surveyType,
      title: surveyTitle,
      questions,
    };
    if (surveyType === "VIDEO") payload.videoId = surveyVideoId;

    const res = await fetch("/api/admin/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return setMsg(json.error || "Survey eklenemedi");

    setMsg("✅ Survey eklendi");
    setSurveyTitle("");
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="dashboard-card">
          <h1>Admin Panel</h1>
          {msg && <p style={{ marginTop: 8, color: "#b91c1c" }}>{msg}</p>}
        </section>

        <section className="dashboard-grid" style={{ marginTop: 16 }}>
          <article className="dashboard-card">
            <h2>Video Ekle</h2>

            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <input value={order} onChange={(e) => setOrder(Number(e.target.value))} placeholder="Order" />
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Video URL" />
              <input
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
                placeholder="Duration Seconds"
              />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />

              <button className="dashboard-primary-btn" type="button" onClick={createVideo}>
                Video oluştur
              </button>
            </div>
          </article>

          <article className="dashboard-card">
            <h2>Survey Ekle</h2>

            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <select value={surveyType} onChange={(e) => setSurveyType(e.target.value as any)}>
                <option value="VIDEO">VIDEO (video sonu)</option>
                <option value="FOLLOWUP">FOLLOWUP (6 ay sonrası)</option>
              </select>

              <input value={surveyTitle} onChange={(e) => setSurveyTitle(e.target.value)} placeholder="Survey Title" />

              {surveyType === "VIDEO" && (
                <select value={surveyVideoId} onChange={(e) => setSurveyVideoId(e.target.value)}>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>
                      Bölüm {v.order} - {v.title}
                    </option>
                  ))}
                </select>
              )}

              <textarea
                value={questionsText}
                onChange={(e) => setQuestionsText(e.target.value)}
                placeholder={"1) Soru 1\n2) Soru 2"}
                style={{ minHeight: 140 }}
              />

              <button className="dashboard-primary-btn" type="button" onClick={createSurvey}>
                Survey oluştur
              </button>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}