// app/admin/page.tsx
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
  type Opt = { text: string; isCorrect: boolean };
  type Q = { text: string; options: Opt[] };

  const makeQuestion = (): Q => ({
    text: "",
    options: [
      { text: "", isCorrect: true },  // default doğru şık 1. seçenek olsun
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
  });

  const [questions, setQuestions] = useState<Q[]>([makeQuestion()]);
  
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
    (async () => {
      const r = await fetch("/api/admin/videos");
      if (r.status === 401 || r.status === 403) {
        window.location.href = "/dashboard";
      }
    })();
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

 

  async function createSurvey() {
    setMsg("");

    if (!surveyTitle.trim()) return setMsg("Survey Title zorunlu");

    // Payload için temizle + order ekle
    const cleanedQuestions = questions
      .map((q, qi) => ({
        order: qi + 1,
        text: q.text.trim(),
        options: q.options
          .map((o, oi) => ({
            order: oi + 1,
            text: o.text.trim(),
            isCorrect: !!o.isCorrect,
          }))
          .filter(o => o.text.length > 0),
      }))
      .filter(q => q.text.length > 0);

    const payload: any = {
      type: surveyType,
      title: surveyTitle.trim(),
      questions: cleanedQuestions,
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
    setQuestions([makeQuestion()]);
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

              {questions.map((q, qi) => (
                <div key={qi} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <b>Soru {qi + 1}</b>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qi))}
                        style={{ marginLeft: "auto" }}
                      >
                        Sil
                      </button>
                    )}
                  </div>

                  <input
                    value={q.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQuestions(prev => prev.map((x, i) => i === qi ? { ...x, text: val } : x));
                    }}
                    placeholder="Soru metni"
                    style={{ marginTop: 8 }}
                  />

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {q.options.map((o, oi) => (
                      <div key={oi} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="radio"
                          name={`correct-${qi}`}
                          checked={o.isCorrect}
                          onChange={() => {
                            setQuestions(prev =>
                              prev.map((x, i) => {
                                if (i !== qi) return x;
                                return {
                                  ...x,
                                  options: x.options.map((op, j) => ({ ...op, isCorrect: j === oi })),
                                };
                              })
                            );
                          }}
                          title="Doğru şık"
                        />

                        <input
                          value={o.text}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuestions(prev =>
                              prev.map((x, i) => {
                                if (i !== qi) return x;
                                return {
                                  ...x,
                                  options: x.options.map((op, j) => j === oi ? { ...op, text: val } : op),
                                };
                              })
                            );
                          }}
                          placeholder={`Şık ${oi + 1}`}
                          style={{ flex: 1 }}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                    {q.options.length < 5 && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuestions(prev =>
                            prev.map((x, i) =>
                              i === qi ? { ...x, options: [...x.options, { text: "", isCorrect: false }] } : x
                            )
                          );
                        }}
                      >
                        + Şık ekle
                      </button>
                    )}

                    {q.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuestions(prev =>
                            prev.map((x, i) => {
                              if (i !== qi) return x;
                              const next = x.options.slice(0, -1); // sondan sil
                              // eğer silinen doğruysa, 1. şık doğru olsun
                              const hasCorrect = next.some(n => n.isCorrect);
                              return { ...x, options: hasCorrect ? next : next.map((n, k) => ({ ...n, isCorrect: k === 0 })) };
                            })
                          );
                        }}
                      >
                        - Şık sil
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button type="button" onClick={() => setQuestions(prev => [...prev, makeQuestion()])}>
                + Soru ekle
              </button>


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